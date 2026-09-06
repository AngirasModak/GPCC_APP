"use client";

import { DragEvent, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const SHEETS = [
  { key: "income", label: "Income", icon: "↗", permission: "Income → Create", tone: "income" },
  { key: "expenses", label: "Expenses", icon: "↘", permission: "Expenses → Create", tone: "expense" },
  { key: "fund_transfers", label: "Fund Transfers", icon: "⇄", permission: "Bank & Transfers → Create", tone: "transfer" },
  { key: "tds_payments", label: "TDS Payments", icon: "₹", permission: "Expenses → Create", tone: "tds" },
  { key: "bank_accounts", label: "Bank Accounts", icon: "⌂", permission: "Bank Setup → Manage", tone: "master" },
  { key: "petty_cash_accounts", label: "Petty Cash", icon: "▣", permission: "Petty Cash Setup → Manage", tone: "master" },
];

const templates: Record<string, any[]> = {
  income: [{
    date: "2026-09-01", contributor: "Example Resident", flat_no: "MIG/1A1",
    amount: 5000, mode: "UPI", reference: "UPI-001", status: "Cleared",
    income_type_id: "", income_category_id: "", contributor_source: "Owner",
    event_id: "", contact_person: "", contact_mobile: "", contact_email: "",
    sponsor_benefit_details: ""
  }],
  expenses: [{
    date: "2026-09-01", requisition_no: "REQ-001", vendor: "Example Vendor",
    bill_no: "B-001", gross_amount: 10000, tds_rate: 0, tds_amount: 0,
    net_amount: 10000, category: "Maintenance", payment_mode: "Bank Transfer",
    status: "Paid", event_id: "", responsible_person_name: "", beneficiary_pan: ""
  }],
  fund_transfers: [{ date: "2026-09-01", requisition_no: "TR-001", type: "Bank Withdrawal", particulars: "Petty cash top-up", amount: 5000, reference: "TRF-001", direction: "OUT", remarks: "Example" }],
  tds_payments: [{ date: "2026-09-07", amount: 1000, challan_no: "CH-001" }],
  bank_accounts: [{ account_name: "Main Bank Account", opening_balance: 0, opening_balance_date: "2026-04-01", is_active: true }],
  petty_cash_accounts: [{ account_name: "Main Petty Cash", opening_balance: 0, opening_balance_date: "2026-04-01", is_active: true }],
};

function downloadWorkbook() {
  const wb = XLSX.utils.book_new();
  Object.entries(templates).forEach(([name, rows]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name));
  const instructions = [
    ["GPCC Excel Centre — Controlled Import Template"],
    ["Workflow", "1. Fill workbook", "2. Validate", "3. Review", "4. Commit"],
    ["Income note", "Use the current master UUIDs for income_type_id, income_category_id and event_id when importing linked records."],
    ["Expense note", "event_id links an expense to the Event / Campaign master; beneficiary_pan must be a valid PAN when provided."],
    ["Safety", "Delete example rows before importing. Keep supported sheet names and column names unchanged."]
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), "Instructions");
  XLSX.writeFile(wb, "GPCC_Controlled_Import_Template.xlsx");
}

function downloadErrors(errors: string[]) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(errors.map((error, i) => ({ Row: i + 1, Error: error }))), "Errors");
  XLSX.writeFile(wb, `GPCC_Import_Errors_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function money(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n || 0);
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
  const [tab, setTab] = useState<"workspace" | "history" | "reconcile">("workspace");
  const [history, setHistory] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [dragging, setDragging] = useState(false);

  const selectedLabel = useMemo(() => sheets.includes("all") ? "All permitted data" : `${sheets.length} selected`, [sheets]);
  const selectedCount = sheets.includes("all") ? SHEETS.length : sheets.length;

  const toggleSheet = (key: string) => setSheets(prev => {
    if (key === "all") return ["all"];
    const base = prev.filter(x => x !== "all");
    const next = base.includes(key) ? base.filter(x => x !== key) : [...base, key];
    return next.length ? next : ["all"];
  });

  const clearStatus = () => { setError(""); setMessage(""); };

  const chooseFile = (next: File | null) => {
    if (!next) return;
    setFile(next);
    setPreview(null);
    setRecon(null);
    setResult(null);
    clearStatus();
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0] || null);
  };

  async function exportData() {
    if (from && to && to < from) { setError("To date cannot be earlier than From date."); return; }
    setBusy(true); clearStatus();
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      p.set("sheets", sheets.join(","));
      const res = await fetch(`/api/export?${p}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `GPCC_Financial_Export_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      setMessage("Financial data exported successfully.");
    } catch (e: any) { setError(e.message || "Unable to export data."); }
    finally { setBusy(false); }
  }

  async function previewImport() {
    if (!file) return setError("Choose an Excel workbook first.");
    setBusy(true); clearStatus(); setResult(null);
    const f = new FormData(); f.append("file", file); f.append("commit", "false");
    try {
      const res = await fetch("/api/import", { method: "POST", body: f });
      const j = await res.json();
      if (!res.ok) throw new Error(j.errors?.slice(0, 3).join(" | ") || j.error || "Preview failed");
      setPreview(j);
      setMessage("Validation complete. Nothing has been written to GPCC.");
    } catch (e: any) { setError(e.message || "Unable to validate workbook."); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!file || !preview || preview.errors?.length) return;
    if (!window.confirm("Commit this validated workbook into GPCC? This creates records and cannot be automatically undone.")) return;
    setBusy(true); clearStatus();
    const f = new FormData(); f.append("file", file); f.append("commit", "true");
    try {
      const res = await fetch("/api/import", { method: "POST", body: f });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || j.failures?.join(" | ") || "Import failed");
      setResult(j); setPreview(null); setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("Import completed successfully."); loadHistory();
    } catch (e: any) { setError(e.message || "Unable to import workbook."); loadHistory(); }
    finally { setBusy(false); }
  }

  async function loadHistory() {
    try {
      const r = await fetch("/api/import-history");
      const j = await r.json();
      if (r.ok) setHistory(j.history || []);
    } catch {}
  }

  async function reconcile() {
    if (!file) return setError("Choose an Excel workbook to reconcile.");
    setBusy(true); clearStatus(); setRecon(null);
    const f = new FormData(); f.append("file", file);
    try {
      const r = await fetch("/api/reconcile", { method: "POST", body: f });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Reconciliation failed");
      setRecon(j); setMessage("Reconciliation completed. No data was written.");
    } catch (e: any) { setError(e.message || "Unable to reconcile workbook."); }
    finally { setBusy(false); }
  }

  const openTab = (t: "workspace" | "history" | "reconcile") => { setTab(t); if (t === "history") loadHistory(); };
  const tabs = [
    { key: "workspace" as const, icon: "▦", title: "Data Workspace", subtitle: "Import & export" },
    { key: "reconcile" as const, icon: "⇄", title: "Reconciliation", subtitle: "Compare before commit" },
    { key: "history" as const, icon: "◷", title: "Import History", subtitle: "Data lineage" },
  ];

  return <div className="excel-centre-v2">
    <div className="excel-hero">
      <div>
        <span className="excel-kicker">CONTROLLED FINANCIAL OPERATIONS</span>
        <h1>Excel Centre</h1>
        <p>One controlled workspace for GPCC financial imports, exports, validation, reconciliation and audit lineage.</p>
      </div>
      <div className="excel-hero-controls">
        <div className="excel-security-chip"><span>✓</span> Validate before write</div>
        <div className="excel-security-chip"><span>◷</span> Audit-backed history</div>
      </div>
    </div>

    <div className="excel-metric-grid">
      <div className="excel-metric-card"><span className="excel-metric-icon">⇩</span><div><small>EXPORT FORMAT</small><b>XLSX</b><em>Permission-controlled data</em></div></div>
      <div className="excel-metric-card"><span className="excel-metric-icon">5000</span><div><small>ROW LIMIT</small><b>5,000</b><em>Per supported sheet</em></div></div>
      <div className="excel-metric-card"><span className="excel-metric-icon">10</span><div><small>FILE LIMIT</small><b>10 MB</b><em>Maximum workbook size</em></div></div>
      <div className="excel-metric-card excel-metric-flow"><span className="excel-metric-icon">✓</span><div><small>CONTROL FLOW</small><b>Validate → Review → Commit</b><em>No database write during validation</em></div></div>
    </div>

    {(error || message) && <div className={`excel-status-banner ${error ? "error" : "success"}`}>
      <span>{error ? "⚠" : "✓"}</span><div><b>{error ? "Action required" : "Completed"}</b><small>{error || message}</small></div>
    </div>}

    <div className="excel-tabbar excel-tabbar-v2" role="tablist" aria-label="Excel Centre sections">
      {tabs.map(t => <button key={t.key} role="tab" aria-selected={tab === t.key} className={`excel-tab ${tab === t.key ? "active" : ""}`} onClick={() => openTab(t.key)}>
        <span className="excel-tab-icon">{t.icon}</span><span><b>{t.title}</b><small>{t.subtitle}</small></span>
      </button>)}
    </div>

    {tab === "workspace" && <>
      <div className="excel-workspace-grid">
        <section className="excel-panel-card">
          <div className="excel-panel-head">
            <div><span className="excel-panel-eyebrow">OUTBOUND DATA</span><h2>Export Financial Data</h2><p>Build a clean workbook from the financial records you are permitted to view.</p></div>
            <span className="excel-panel-mark">↗</span>
          </div>

          <div className="formGrid excel-date-grid">
            <label>From date<input className="input" type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); if (to && to < e.target.value) setTo(e.target.value); }}/><small className="field-hint">Start of export period</small></label>
            <label>To date<input className="input" type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); if (from && e.target.value < from) setFrom(e.target.value); }}/><small className="field-hint">Cannot be earlier than From date</small></label>
          </div>

          <div className="excel-dataset-head">
            <div><b>Datasets</b><small>Select the records to include</small></div>
            <button className="excel-text-button" onClick={() => setSheets(["all"])}>Select all</button>
          </div>

          <div className="excel-dataset-grid">
            {SHEETS.map(s => {
              const checked = sheets.includes("all") || sheets.includes(s.key);
              return <label key={s.key} className={`excel-dataset-card ${checked ? "selected" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleSheet(s.key)} />
                <span className={`excel-dataset-icon ${s.tone}`}>{s.icon}</span>
                <span className="excel-dataset-copy"><b>{s.label}</b><small>{s.permission}</small></span>
                <span className="excel-check">{checked ? "✓" : ""}</span>
              </label>;
            })}
          </div>

          <div className="excel-footer-action">
            <button className="btn" disabled={busy} onClick={exportData}>{busy ? "Preparing…" : "Export Financial Data"}</button>
            <span className="excel-selection"><span className="excel-selection-dot" />{selectedLabel} · {selectedCount} datasets</span>
          </div>
        </section>

        <section className="excel-panel-card excel-import-panel">
          <div className="excel-panel-head">
            <div><span className="excel-panel-eyebrow">INBOUND DATA</span><h2>Import Financial Data</h2><p>Upload, validate, review and explicitly commit. GPCC never writes during validation.</p></div>
            <span className="excel-panel-mark">⇩</span>
          </div>

          <div className="excel-process-rail">
            <div className="active"><span>1</span><b>Upload</b><small>Choose workbook</small></div><i />
            <div className={preview ? "active" : ""}><span>2</span><b>Validate</b><small>Check structure</small></div><i />
            <div className={preview && !preview.errors?.length ? "active" : ""}><span>3</span><b>Commit</b><small>Write approved data</small></div>
          </div>

          <div
            className={`excel-dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={e => chooseFile(e.target.files?.[0] || null)} />
            <span className="excel-dropzone-icon">{file ? "✓" : "⇧"}</span>
            <div>{file ? <><b>{file.name}</b><small>{(file.size / 1024).toFixed(1)} KB · Ready for validation</small></> : <><b>Drop an Excel workbook here</b><small>or click to browse · .xlsx or .xls · max 10 MB</small></>}</div>
            <button type="button" className="excel-browse" onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}>{file ? "Change file" : "Browse"}</button>
          </div>

          <div className="excel-import-note"><span>ⓘ</span><p>Use the official template for predictable imports. Validation checks file structure and required fields before any database write.</p></div>

          <div className="excel-import-actions">
            <button className="btn secondary" onClick={downloadWorkbook}>↓ Download Template</button>
            <button className="btn" disabled={!file || busy} onClick={previewImport}>{busy ? "Validating…" : "✓ Validate Workbook"}</button>
            <button className="btn secondary" disabled={!file || busy} onClick={reconcile}>⇄ Reconcile</button>
          </div>

          {preview && <div className={`excel-validation-card ${preview.errors?.length ? "invalid" : "valid"}`}>
            <div className="excel-validation-summary">
              <span>{preview.errors?.length ? "!" : "✓"}</span>
              <div><b>{preview.errors?.length ? "Validation found issues" : "Workbook validated successfully"}</b><small>{preview.totalRows} rows found · {preview.errors?.length || 0} errors</small></div>
            </div>
            {preview.errors?.length ? <>
              <pre>{preview.errors.join("\n")}</pre>
              <button className="btn secondary" onClick={() => downloadErrors(preview.errors)}>Download Error Report</button>
            </> : <button className="btn" onClick={commitImport}>Commit Import</button>}
          </div>}

          {result && <div className="excel-result-strip"><b>Imported successfully</b><span>{Object.entries(result.inserted || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span></div>}
        </section>
      </div>

      <section className="excel-contract-v2">
        <div className="excel-contract-head">
          <div><span className="excel-kicker">DATA CONTRACT</span><h2>Workbook Requirements</h2><p>Supported sheets and the minimum fields required for a controlled GPCC import.</p></div>
          <div className="excel-contract-badges"><span>{SHEETS.length} supported sheets</span><span>Version-aware fields</span></div>
        </div>
        <div className="excel-contract-grid">
          <div className="excel-contract-item"><b>Income</b><small>date, contributor, amount, mode</small><p>Supports sponsorship and event-linked fields.</p></div>
          <div className="excel-contract-item"><b>Expenses</b><small>date, requisition_no, vendor, gross_amount</small><p>Supports event, responsible person and PAN fields.</p></div>
          <div className="excel-contract-item"><b>Fund Transfers</b><small>date, type, particulars, amount, direction</small><p>Bank and petty-cash movements.</p></div>
          <div className="excel-contract-item"><b>TDS Payments</b><small>date, amount</small><p>Challan payment records.</p></div>
          <div className="excel-contract-item"><b>Bank Accounts</b><small>account_name, opening_balance, opening_balance_date</small><p>Administrator master setup.</p></div>
          <div className="excel-contract-item"><b>Petty Cash</b><small>account_name, opening_balance, opening_balance_date</small><p>Petty-cash master setup.</p></div>
        </div>
      </section>
    </>}

    {tab === "reconcile" && <section className="excel-panel-card excel-reconcile-panel">
      <div className="excel-panel-head">
        <div><span className="excel-panel-eyebrow">PRE-IMPORT CONTROL</span><h2>Data Reconciliation</h2><p>Compare workbook records against current GPCC data. This operation is read-only.</p></div>
        <span className="excel-readonly">READ ONLY</span>
      </div>
      {!file ? <div className="excel-empty-state"><span>⇄</span><b>No workbook selected</b><small>Select a workbook in Data Workspace first, then return here to reconcile it.</small></div> :
        <><div className="excel-recon-file"><span>▣</span><div><b>{file.name}</b><small>Ready for a read-only comparison against GPCC</small></div><button className="btn" disabled={busy} onClick={reconcile}>{busy ? "Reconciling…" : "Run Reconciliation"}</button></div>
        {recon && <div className="tableWrap excel-recon-table"><table className="table"><thead><tr><th>Sheet</th><th>Workbook</th><th>Database</th><th>Matched</th><th>New</th><th>Duplicates</th><th>Workbook total</th><th>DB total</th><th>Difference</th></tr></thead><tbody>{recon.results.map((r: any) => <tr key={r.sheet}><td><b>{r.sheet}</b></td><td>{r.workbookRows}</td><td>{r.databaseRows}</td><td>{r.matchedRows}</td><td>{r.newRows}</td><td>{r.duplicateRows}</td><td>{money(r.workbookTotal)}</td><td>{money(r.databaseTotal)}</td><td>{money(r.difference)}</td></tr>)}</tbody></table></div>}</>}
    </section>}

    {tab === "history" && <section className="excel-panel-card excel-history-panel">
      <div className="excel-panel-head">
        <div><span className="excel-panel-eyebrow">DATA LINEAGE</span><h2>Import History</h2><p>Latest completed or failed workbook imports visible to the current user.</p></div>
        <button className="btn secondary" onClick={loadHistory}>↻ Refresh</button>
      </div>
      <div className="excel-history-summary"><span>{history.length}</span><div><b>Recorded import events</b><small>Refresh to retrieve the latest audit history</small></div></div>
      <div className="tableWrap"><table className="table"><thead><tr><th>Date</th><th>Workbook</th><th>Status</th><th>Rows</th><th>Inserted</th><th>Sheets</th></tr></thead><tbody>{history.length ? history.map((h: any) => <tr key={h.id}><td>{new Date(h.imported_at).toLocaleString("en-IN")}</td><td><b>{h.file_name}</b></td><td><span className={`status-pill ${String(h.status).toLowerCase()}`}>{h.status}</span></td><td>{h.total_rows}</td><td>{h.inserted_rows}</td><td>{Array.isArray(h.sheets) ? h.sheets.map((s: any) => s.sheet).join(", ") : "—"}</td></tr>) : <tr><td colSpan={6} className="muted">No import history available yet.</td></tr>}</tbody></table></div>
    </section>}
  </div>;
}
