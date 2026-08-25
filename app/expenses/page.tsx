"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Expense = {
  id: string;
  date: string;
  requisition_no: string;
  vendor: string;
  bill_no: string;
  bill_date: string;
  payment_mode: string;
  cheque_or_utr: string;
  payment_date: string;
  gross_amount: number;
  tds_rate: number;
  tds_amount: number;
  net_amount: number;
  category: string;
  remarks: string;
  status: string;
};

const blank = {
  date: new Date().toISOString().slice(0, 10),
  requisition_no: "",
  vendor: "",
  bill_no: "",
  bill_date: "",
  payment_mode: "Bank Transfer",
  cheque_or_utr: "",
  payment_date: "",
  gross_amount: "",
  tds_rate: "0",
  category: "",
  remarks: "",
  status: "Paid",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export default function ExpensesPage() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [form, setForm] = useState<any>(blank);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false });

    if (error) {
      setMsg(error.message);
    } else {
      setRows((data || []) as Expense[]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const gross = Number(form.gross_amount || 0);
  const rate = Number(form.tds_rate || 0);

  const tdsAmount = gross * rate / 100;
  const netAmount = gross - tdsAmount;

  const save = async () => {
    if (
      !form.requisition_no ||
      !form.vendor ||
      !form.gross_amount
    ) {
      setMsg(
        "Requisition Number, Vendor and Gross Amount are required."
      );
      return;
    }

    if (gross <= 0) {
      setMsg("Gross Amount must be greater than zero.");
      return;
    }

    if (rate < 0 || rate > 100) {
      setMsg("TDS Rate must be between 0 and 100.");
      return;
    }

    const payload = {
      date: form.date,
      requisition_no: form.requisition_no.trim(),
      vendor: form.vendor.trim(),
      bill_no: form.bill_no.trim() || null,
      bill_date: form.bill_date || null,
      payment_mode: form.payment_mode,
      cheque_or_utr: form.cheque_or_utr.trim() || null,
      payment_date: form.payment_date || null,
      gross_amount: gross,
      tds_rate: rate,
      tds_amount: tdsAmount,
      net_amount: netAmount,
      category: form.category.trim() || null,
      remarks: form.remarks.trim() || null,
      status: form.status,
    };

    let error: any;

    if (editing) {
      ({ error } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editing));
    } else {
      ({ error } = await supabase
        .from("expenses")
        .insert(payload));
    }

    if (error) {
      setMsg(error.message);
      return;
    }

    setOpen(false);
    setEditing(null);
    setForm(blank);
    setMsg("");

    load();
  };

  const edit = (r: Expense) => {
    setEditing(r.id);

    setForm({
      ...r,
      gross_amount: String(r.gross_amount),
      tds_rate: String(r.tds_rate),
      bill_date: r.bill_date || "",
      payment_date: r.payment_date || "",
    });

    setOpen(true);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this expenditure entry?")) return;

    const { error } = await supabase
      .from("expenses")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
    } else {
      load();
    }
  };

  const paidRows = rows.filter(
    (r) => String(r.status).toLowerCase() === "paid"
  );

  const totalGross = paidRows.reduce(
    (sum, r) => sum + Number(r.gross_amount || 0),
    0
  );

  const totalTds = paidRows.reduce(
    (sum, r) => sum + Number(r.tds_amount || 0),
    0
  );

  const totalNet = paidRows.reduce(
    (sum, r) => sum + Number(r.net_amount || 0),
    0
  );

  const pettyCashExpense = paidRows
    .filter(
      (r) =>
        String(r.payment_mode).toLowerCase() ===
        "petty cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.net_amount || 0),
      0
    );

  const bankExpense = paidRows
    .filter(
      (r) =>
        String(r.payment_mode).toLowerCase() !==
        "petty cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.net_amount || 0),
      0
    );

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1>Expenditure & TDS</h1>

          <p className="muted">
            Paid expenses automatically reduce the
            selected fund: Bank or Petty Cash.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setForm(blank);
            setOpen(true);
          }}
        >
          + Add Expenditure
        </button>
      </div>

      <div
        className="grid"
        style={{ marginBottom: 20 }}
      >
        <div className="card">
          <div className="muted">
            Paid Gross Expenditure
          </div>

          <div className="metric">
            {money(totalGross)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Total TDS
          </div>

          <div className="metric">
            {money(totalTds)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Bank Paid
          </div>

          <div className="metric">
            {money(bankExpense)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Petty Cash Paid
          </div>

          <div className="metric">
            {money(pettyCashExpense)}
          </div>
        </div>
      </div>

      {msg && (
        <div
          className="card"
          style={{
            marginBottom: 14,
            color: "#b42318",
          }}
        >
          {msg}
        </div>
      )}

      <div className="card tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Req. No.</th>
              <th>In favour of M/S</th>
              <th>Bill No.</th>
              <th>Mode</th>
              <th>Cheque / UTR</th>
              <th>Gross</th>
              <th>TDS</th>
              <th>Net Paid</th>
              <th>Status</th>
              <th>Fund Impact</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const isPaid =
                  String(r.status).toLowerCase() ===
                  "paid";

                const isPettyCash =
                  String(
                    r.payment_mode
                  ).toLowerCase() === "petty cash";

                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>

                    <td>{r.requisition_no}</td>

                    <td>{r.vendor}</td>

                    <td>{r.bill_no || "-"}</td>

                    <td>{r.payment_mode}</td>

                    <td>
                      {r.cheque_or_utr || "-"}
                    </td>

                    <td>
                      {money(r.gross_amount)}
                    </td>

                    <td>
                      {money(r.tds_amount)}
                    </td>

                    <td>
                      {money(r.net_amount)}
                    </td>

                    <td>
                      <span className="status">
                        {r.status}
                      </span>
                    </td>

                    <td>
                      {!isPaid
                        ? "No balance impact"
                        : isPettyCash
                        ? "Petty Cash −"
                        : "Bank −"}
                    </td>

                    <td className="actions">
                      <button
                        className="btn secondary"
                        onClick={() => edit(r)}
                      >
                        Edit
                      </button>

                      <button
                        className="btn danger"
                        onClick={() => del(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={12}
                  className="empty"
                >
                  No expenditure entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modalBg">
          <div className="modal">
            <div className="pageHead">
              <h2>
                {editing
                  ? "Edit Expenditure"
                  : "Add Expenditure"}
              </h2>

              <button
                className="btn secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="formGrid">
              <Field
                label="Transaction Date"
                type="date"
                value={form.date}
                set={(v) =>
                  setForm({
                    ...form,
                    date: v,
                  })
                }
              />

              <Field
                label="Requisition Number *"
                value={form.requisition_no}
                set={(v) =>
                  setForm({
                    ...form,
                    requisition_no: v,
                  })
                }
              />

              <Field
                label="In favour of M/S *"
                value={form.vendor}
                set={(v) =>
                  setForm({
                    ...form,
                    vendor: v,
                  })
                }
              />

              <Field
                label="Category"
                value={form.category}
                set={(v) =>
                  setForm({
                    ...form,
                    category: v,
                  })
                }
              />

              <Field
                label="Bill Number"
                value={form.bill_no}
                set={(v) =>
                  setForm({
                    ...form,
                    bill_no: v,
                  })
                }
              />

              <Field
                label="Bill Date"
                type="date"
                value={form.bill_date || ""}
                set={(v) =>
                  setForm({
                    ...form,
                    bill_date: v,
                  })
                }
              />

              <label>
                Payment Mode

                <select
                  className="input"
                  value={form.payment_mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      payment_mode: e.target.value,
                    })
                  }
                >
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Petty Cash</option>
                </select>
              </label>

              <Field
                label="Cheque Number / UTR"
                value={form.cheque_or_utr}
                set={(v) =>
                  setForm({
                    ...form,
                    cheque_or_utr: v,
                  })
                }
              />

              <Field
                label="Cheque / Transfer Issue Date"
                type="date"
                value={form.payment_date || ""}
                set={(v) =>
                  setForm({
                    ...form,
                    payment_date: v,
                  })
                }
              />

              <Field
                label="Gross Amount *"
                type="number"
                value={form.gross_amount}
                set={(v) =>
                  setForm({
                    ...form,
                    gross_amount: v,
                  })
                }
              />

              <Field
                label="TDS Rate (%)"
                type="number"
                value={form.tds_rate}
                set={(v) =>
                  setForm({
                    ...form,
                    tds_rate: v,
                  })
                }
              />

              <label>
                Status

                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value,
                    })
                  }
                >
                  <option>Paid</option>
                  <option>Pending</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </div>

            <div
              className="card"
              style={{
                marginTop: 16,
                background: "#f7fbfa",
              }}
            >
              <b>
                Calculated TDS: {money(tdsAmount)}
              </b>

              <br />

              <span className="muted">
                Net payment: {money(netAmount)}
              </span>
            </div>

            <label
              style={{
                display: "block",
                marginTop: 14,
              }}
            >
              Remarks

              <textarea
                className="input"
                rows={3}
                value={form.remarks}
                onChange={(e) =>
                  setForm({
                    ...form,
                    remarks: e.target.value,
                  })
                }
              />
            </label>

            <div style={{ marginTop: 20 }}>
              <button
                className="btn"
                onClick={save}
              >
                {editing
                  ? "Update Expenditure"
                  : "Save Expenditure"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  set,
}: {
  label: string;
  type?: string;
  value: any;
  set: (v: string) => void;
}) {
  return (
    <label>
      {label}

      <input
        className="input"
        type={type}
        value={value ?? ""}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}