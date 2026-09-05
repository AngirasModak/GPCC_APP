import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

const MAX = 10 * 1024 * 1024;
const LIMIT = 5000;
const REQUIRED: Record<string, string[]> = {
  income: ["date", "contributor", "amount", "mode"],
  expenses: ["date", "requisition_no", "vendor", "gross_amount"],
  fund_transfers: ["date", "type", "particulars", "amount", "direction"],
  tds_payments: ["date", "amount"],
  bank_accounts: ["account_name", "opening_balance", "opening_balance_date"],
  petty_cash_accounts: ["account_name", "opening_balance", "opening_balance_date"],
};
const PERMISSION: Record<string, [string, string]> = {
  income: ["income", "create"],
  expenses: ["expenses", "create"],
  fund_transfers: ["bank_transfers", "create"],
  tds_payments: ["expenses", "create"],
  bank_accounts: ["bank_setup", "manage"],
  petty_cash_accounts: ["petty_cash_setup", "manage"],
};
const ALLOWED_SHEETS = Object.keys(REQUIRED);

function clean(v: any) { return typeof v === "string" ? v.trim() : v; }
function asNumber(v: any) { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) ? n : null; }
function asDate(v: any) {
  if (v instanceof Date) return v.toISOString().slice(0,10);
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`; }
  const s = clean(v); if (!s) return null;
  const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0,10);
}
function normalizeRow(sheet: string, raw: any, index: number) {
  const row: any = {};
  Object.keys(raw || {}).forEach(k => { row[String(k).trim().toLowerCase()] = raw[k]; });
  const errors: string[] = [];
  for (const field of REQUIRED[sheet]) if (row[field] === "" || row[field] == null) errors.push(`missing ${field}`);
  if (row.date !== undefined) { const d = asDate(row.date); if (!d) errors.push("invalid date"); else row.date = d; }
  for (const f of ["amount","gross_amount","tds_amount","net_amount","tds_rate","opening_balance"]) if (row[f] !== undefined && row[f] !== "") { const n=asNumber(row[f]); if(n===null) errors.push(`invalid ${f}`); else row[f]=n; }
  for (const f of Object.keys(row)) row[f] = clean(row[f]);
  if (sheet === "income" && row.amount <= 0) errors.push("amount must be > 0");
  if (sheet === "expenses" && row.gross_amount <= 0) errors.push("gross_amount must be > 0");
  if (sheet === "fund_transfers" && row.amount <= 0) errors.push("amount must be > 0");
  if (sheet === "fund_transfers" && !["IN","OUT"].includes(String(row.direction || "").toUpperCase())) errors.push("direction must be IN or OUT");
  if (sheet === "income" && !["Cash","Cheque","Online","Bank Transfer","UPI"].includes(String(row.mode))) errors.push("invalid income mode");
  if (sheet === "expenses") {
    row.tds_rate = row.tds_rate == null || row.tds_rate === "" ? 0 : row.tds_rate;
    row.tds_amount = row.tds_amount == null || row.tds_amount === "" ? 0 : row.tds_amount;
    row.net_amount = row.net_amount == null || row.net_amount === "" ? Math.max(0, Number(row.gross_amount || 0) - Number(row.tds_amount || 0)) : row.net_amount;
    row.status = row.status || "Paid";
  }
  if (sheet === "fund_transfers") row.direction = String(row.direction).toUpperCase();
  return { row, errors: errors.map(e => `Row ${index}: ${e}`) };
}

async function client(req: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } });
}
async function permitted(supabase: any, sheet: string) {
  const [module, action] = PERMISSION[sheet];
  const { data, error } = await supabase.rpc("has_permission", { p_module: module, p_action: action });
  return !error && !!data;
}

async function recordHistory(supabase: any, file: File, status: "VALIDATED" | "COMPLETED" | "FAILED", totalRows: number, insertedRows: number, sheets: any, errors: string[]) {
  await supabase.rpc("record_excel_import", {
    p_file_name: file.name, p_file_size: file.size, p_status: status,
    p_total_rows: totalRows, p_inserted_rows: insertedRows,
    p_sheets: sheets || {}, p_errors: errors || []
  });
}

export async function POST(req: NextRequest) {
  const supabase = await client(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  const commit = form.get("commit") === "true";
  if (!(file instanceof File)) return NextResponse.json({ error: "Excel file required" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Maximum file size is 10 MB" }, { status: 413 });

  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true }); }
  catch { return NextResponse.json({ error: "Invalid or unreadable Excel workbook" }, { status: 400 }); }

  const sheets: any[] = [];
  const allErrors: string[] = [];
  let total = 0;
  for (const name of wb.SheetNames) {
    const sheet = name.trim().toLowerCase();
    if (sheet === "export info" || !ALLOWED_SHEETS.includes(sheet)) continue;
    if (!(await permitted(supabase, sheet))) { allErrors.push(`${name}: insufficient privilege`); continue; }
    const ws = wb.Sheets[name];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (rawRows.length > LIMIT) { allErrors.push(`${name}: maximum ${LIMIT} rows`); continue; }
    if (!rawRows.length) continue;
    const normalized = rawRows.map((r, i) => normalizeRow(sheet, r, i + 2));
    const errors = normalized.flatMap(x => x.errors);
    allErrors.push(...errors.map(e => `${name}: ${e}`));
    sheets.push({ sheet, rows: normalized.map(x => x.row), valid: errors.length === 0, inputRows: rawRows.length });
    total += rawRows.length;
  }
  if (!sheets.length) return NextResponse.json({ error: "No supported, permitted sheets found", errors: allErrors }, { status: 400 });

  if (!commit) return NextResponse.json({ preview: true, totalRows: total, errors: allErrors.slice(0, 200), sheets: sheets.map(s => ({ sheet: s.sheet, inputRows: s.inputRows, valid: s.valid, sample: s.rows.slice(0, 5) })) });
  if (allErrors.length) return NextResponse.json({ error: "Import validation failed. No data was written.", errors: allErrors.slice(0, 200) }, { status: 400 });

  const inserted: Record<string, number> = {};
  const failures: string[] = [];
  for (const s of sheets) {
    const payload = s.rows.map((row: any) => ({ ...row, created_by: user.id }));
    const { error } = await supabase.from(s.sheet).insert(payload);
    if (error) { failures.push(`${s.sheet}: ${error.message}`); break; }
    inserted[s.sheet] = payload.length;
  }
  if (failures.length) {
    await recordHistory(supabase, file, "FAILED", total, Object.values(inserted).reduce((a:number,b:number)=>a+b,0), sheets.map((s:any)=>({sheet:s.sheet,inputRows:s.inputRows})), failures).catch(()=>{});
    return NextResponse.json({ error: "Import stopped. Some earlier sheets may already have been written; review the result before retrying.", inserted, failures }, { status: 500 });
  }
  await recordHistory(supabase, file, "COMPLETED", total, Object.values(inserted).reduce((a:number,b:number)=>a+b,0), sheets.map((s:any)=>({sheet:s.sheet,inputRows:s.inputRows})), []).catch(()=>{});
  return NextResponse.json({ success: true, inserted });
}
