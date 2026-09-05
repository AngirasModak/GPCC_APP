"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const SHEETS = [
  { key: "income", label: "Income", permission: "Income → Create" },
  { key: "expenses", label: "Expenses", permission: "Expenses → Create" },
  { key: "fund_transfers", label: "Fund Transfers", permission: "Bank & Transfers → Create" },
  { key: "tds_payments", label: "TDS Payments", permission: "Expenses → Create" },
  { key: "bank_accounts", label: "Bank Accounts", permission: "Bank Setup → Manage" },
  { key: "petty_cash_accounts", label: "Petty Cash Accounts", permission: "Petty Cash Setup → Manage" },
];

const templates: Record<string, any[]> = {
  income: [{ date: "2026-09-01", contributor: "Example Resident", flat_no: "A-101", amount: 5000, mode: "UPI", reference: "UPI-001", status: "Cleared" }],
  expenses: [{ date: "2026-09-01", requisition_no: "REQ-001", vendor: "Example Vendor", bill_no: "B-001", gross_amount: 10000, tds_rate: 0, tds_amount: 0, net_amount: 10000, category: "Maintenance", payment_mode: "Bank Transfer", status: "Paid" }],
  fund_transfers: [{ date: "2026-09-01", requisition_no: "TR-001", type: "Bank Withdrawal", particulars: "Petty cash top-up", amount: 5000, reference: "TRF-001", direction: "OUT", remarks: "Example" }],
  tds_payments: [{ date: "2026-09-07", amount: 1000, challan_no: "CH-001" }],
  bank_accounts: [{ account_name: "Main Bank Account", opening_balance: 0, opening_balance_date: "2026-04-01", is_active: true }],
  petty_cash_accounts: [{ account_name: "Main Petty Cash", opening_balance: 0, opening_balance_date: "2026-04-01", is_active: true }],
};

function downloadWorkbook() {
  const wb = XLSX.utils.book_new();
  Object.entries(templates).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["GPCC Excel Centre Template"],["Delete example rows before import. Keep column names unchanged."]]), "Instructions");
  XLSX.writeFile(wb, "GPCC_Excel_Import_Template.xlsx");
}

export default function ExcelCentrePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sheets, setSheets] = useState<string[]>(["all"]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);

  const selectedLabel = useMemo(() => sheets.includes("all") ? "All permitted data" : `${sheets.length} selected`, [sheets]);

  const toggleSheet = (key: string) => {
    setSheets(prev => {
      if (key === "all") return ["all"];
      const base = prev.filter(x => x !== "all");
      const next = base.includes(key) ? base.filter(x => x !== key) : [...base, key];
      return next.length ? next : ["all"];
    });
  };

  async function exportData() {
    setBusy(true); setError(""); setMessage("");
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from); if (to) params.set("to", to); params.set("sheets", sheets.join(","));
      const res = await fetch(`/api/export?${params.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `GPCC_Financial_Export_${new Date().toISOString().slice(0,10)}.xlsx`; a.click(); URL.revokeObjectURL(url);
      setMessage("Financial data exported successfully.");
    } catch (e:any) { setError(e.message || "Unable to export data."); }
    finally { setBusy(false); }
  }

  async function previewImport() {
    if (!file) return setError("Choose an Excel workbook first.");
    setBusy(true); setError(""); setMessage(""); setResult(null);
    const form = new FormData(); form.append("file", file); form.append("commit", "false");
    try { const res = await fetch("/api/import", { method: "POST", body: form }); const j = await res.json(); if (!res.ok) throw new Error(j.errors?.slice(0,3).join(" | ") || j.error || "Preview failed"); setPreview(j); setMessage("Validation preview generated. Nothing has been written."); }
    catch (e:any) { setError(e.message || "Unable to validate workbook."); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!file || !preview || preview.errors?.length) return;
    if (!window.confirm("Import the validated workbook into GPCC? This will create financial records and cannot be automatically undone.")) return;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(); form.append("file", file); form.append("commit", "true");
    try { const res = await fetch("/api/import", { method: "POST", body: form }); const j = await res.json(); if (!res.ok) throw new Error(j.error || j.failures?.join(" | ") || "Import failed"); setResult(j); setPreview(null); setFile(null); if (inputRef.current) inputRef.current.value = ""; setMessage("Import completed successfully."); }
    catch (e:any) { setError(e.message || "Unable to import workbook."); }
    finally { setBusy(false); }
  }

  return <div>
    <div className="pageHead"><div><h1>Excel Centre</h1><p className="muted">Controlled import, export, validation and reconciliation of GPCC financial data.</p></div></div>

    <div className="grid">
      <div className="card"><span className="muted">Export</span><div className="metric">XLSX</div><small className="muted">Download permitted financial data</small></div>
      <div className="card"><span className="muted">Import limit</span><div className="metric">5,000</div><small className="muted">Rows per supported sheet</small></div>
      <div className="card"><span className="muted">File limit</span><div className="metric">10 MB</div><small className="muted">Maximum workbook size</small></div>
      <div className="card"><span className="muted">Workflow</span><div className="metric">Validate → Commit</div><small className="muted">Nothing is written during preview</small></div>
    </div>

    {(error || message) && <div className={`admin-alert ${error ? "error" : "success"}`} style={{marginTop:18}}>{error ? `⚠ ${error}` : `✓ ${message}`}</div>}

    <div className="admin-two-col" style={{marginTop:18}}>
      <section className="card">
        <div className="admin-card-title"><div><h2>Export Financial Data</h2><p className="muted">Build a controlled workbook from the data you are allowed to view.</p></div></div>
        <div className="formGrid" style={{marginTop:18}}>
          <label>From date<input className="input" type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
          <label>To date<input className="input" type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
        </div>
        <div style={{marginTop:18}}><b>Sheets</b><div className="permission-check-list" style={{marginTop:10}}>{SHEETS.map(s=><label key={s.key} className="permission-toggle"><input type="checkbox" checked={sheets.includes("all") || sheets.includes(s.key)} onChange={()=>toggleSheet(s.key)} />{s.label}<small>{s.permission}</small></label>)}</div></div>
        <div className="actions" style={{marginTop:20}}><button className="btn" disabled={busy} onClick={exportData}>{busy ? "Preparing…" : "Export Financial Data"}</button><span className="muted" style={{alignSelf:"center",fontSize:13}}>{selectedLabel}</span></div>
      </section>

      <section className="card">
        <div className="admin-card-title"><div><h2>Import Financial Data</h2><p className="muted">Upload the standard GPCC workbook, validate it, then commit only after review.</p></div></div>
        <div className="admin-note" style={{marginTop:18}}>Use the official template. Column names are the import contract. Example rows are for guidance only.</div>
        <div style={{marginTop:18}}><input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={e=>{setFile(e.target.files?.[0]||null);setPreview(null);setResult(null);setError("")}} /></div>
        <div className="actions" style={{marginTop:18}}><button className="btn secondary" onClick={downloadWorkbook}>Download Import Template</button><button className="btn" disabled={!file||busy} onClick={previewImport}>{busy ? "Validating…" : "Validate Workbook"}</button></div>
        {file && <div className="admin-note" style={{marginTop:14}}><b>{file.name}</b> · {(file.size/1024).toFixed(1)} KB</div>}
        {preview && <div className="card" style={{marginTop:16,background:"#f8fafb"}}><b>Validation preview</b><p className="muted">{preview.totalRows} rows found. {preview.errors?.length ? `${preview.errors.length} validation errors.` : "No validation errors."}</p>{preview.errors?.length ? <pre style={{whiteSpace:"pre-wrap",maxHeight:180,overflow:"auto"}}>{preview.errors.join("\n")}</pre> : <button className="btn" onClick={commitImport}>Commit Import</button>}</div>}
        {result && <div className="admin-note" style={{marginTop:14}}><b>Imported:</b> {Object.entries(result.inserted||{}).map(([k,v])=>`${k}: ${v}`).join(" · ")}</div>}
      </section>
    </div>

    <section className="card" style={{marginTop:18}}><h2>Import Contract</h2><p className="muted">Supported sheets and mandatory fields.</p><div className="tableWrap"><table className="table"><thead><tr><th>Sheet</th><th>Mandatory fields</th><th>Use</th></tr></thead><tbody>
      <tr><td>Income</td><td>date, contributor, amount, mode</td><td>Income records</td></tr><tr><td>Expenses</td><td>date, requisition_no, vendor, gross_amount</td><td>Expense + TDS data</td></tr><tr><td>Fund Transfers</td><td>date, type, particulars, amount, direction</td><td>Bank / petty-cash movements</td></tr><tr><td>TDS Payments</td><td>date, amount</td><td>TDS challan payments</td></tr><tr><td>Bank Accounts</td><td>account_name, opening_balance, opening_balance_date</td><td>Administrator master setup</td></tr><tr><td>Petty Cash Accounts</td><td>account_name, opening_balance, opening_balance_date</td><td>Administrator master setup</td></tr>
    </tbody></table></div></section>
  </div>;
}
