import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import * as XLSX from "xlsx";

const TABLES = [
  { key: "income", table: "income", permission: ["income", "view"] },
  { key: "expenses", table: "expenses", permission: ["expenses", "view"] },
  { key: "fund_transfers", table: "fund_transfers", permission: ["bank_transfers", "view"] },
  { key: "tds_payments", table: "tds_payments", permission: ["expenses", "view"] },
  { key: "bank_accounts", table: "bank_accounts", permission: ["bank_setup", "manage"] },
  { key: "petty_cash_accounts", table: "petty_cash_accounts", permission: ["petty_cash_setup", "manage"] },
] as const;

async function getClient(req: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await getClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const requested = (url.searchParams.get("sheets") || "all").split(",").filter(Boolean);

  const workbook = XLSX.utils.book_new();
  const exported: string[] = [];
  const errors: string[] = [];

  for (const spec of TABLES) {
    if (requested[0] !== "all" && !requested.includes(spec.key)) continue;

    const { data: allowed, error: permissionError } = await supabase.rpc("has_permission", {
      p_module: spec.permission[0], p_action: spec.permission[1],
    });
    if (permissionError || !allowed) continue;

    let query: any = supabase.from(spec.table).select("*");
    if (["income", "expenses", "fund_transfers", "tds_payments"].includes(spec.table)) {
      query = query.is("deleted_at", null);
      if (from) query = query.gte("date", from);
      if (to) query = query.lte("date", to);
      query = query.order("date", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) { errors.push(`${spec.key}: ${error.message}`); continue; }

    const rows = (data || []).map((row: any) => {
      const copy = { ...row };
      delete copy.created_by;
      delete copy.deleted_at;
      delete copy.updated_at;
      return copy;
    });
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(workbook, ws, spec.key.slice(0, 31));
    exported.push(spec.key);
  }

  if (!exported.length) return NextResponse.json({ error: errors.join("; ") || "No permitted data sheets available" }, { status: 403 });

  const info = [
    { ExportedAt: new Date().toISOString(), From: from || "", To: to || "", Sheets: exported.join(", ") },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(info), "Export Info");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="GPCC_Financial_Export_${new Date().toISOString().slice(0,10)}.xlsx"`,
      "Cache-Control": "no-store",
      "X-GPCC-Exported-Sheets": exported.join(","),
    },
  });
}
