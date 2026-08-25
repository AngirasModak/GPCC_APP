"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row = {
  id: string;
  date: string;
  contributor: string;
  flat_no: string;
  amount: number;
  mode: string;
  reference: string;
  status: string;
};

const initial = {
  date: new Date().toISOString().slice(0, 10),
  contributor: "",
  flat_no: "",
  amount: "",
  mode: "Cash",
  reference: "",
  status: "Cleared",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export default function Income() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<any>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setMsg("");

    const { data, error } = await supabase
      .from("income")
      .select("*")
      .is("deleted_at", null)
      .order("date", { ascending: false });

    if (error) {
      setMsg(error.message);
    } else {
      setRows((data || []) as Row[]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.contributor || !form.amount) {
      setMsg("Contributor and amount are required.");
      return;
    }

    if (Number(form.amount) <= 0) {
      setMsg("Amount must be greater than zero.");
      return;
    }

    const payload = {
      date: form.date,
      contributor: form.contributor.trim(),
      flat_no: form.flat_no.trim() || null,
      amount: Number(form.amount),
      mode: form.mode,
      reference: form.reference.trim() || null,
      status: form.status,
    };

    let error: any;

    if (editing) {
      ({ error } = await supabase
        .from("income")
        .update(payload)
        .eq("id", editing));
    } else {
      ({ error } = await supabase
        .from("income")
        .insert(payload));
    }

    if (error) {
      setMsg(error.message);
      return;
    }

    setOpen(false);
    setEditing(null);
    setForm(initial);
    setMsg("");

    load();
  };

  const edit = (r: Row) => {
    setEditing(r.id);

    setForm({
      ...r,
      amount: String(r.amount),
    });

    setOpen(true);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this income entry?")) return;

    const { error } = await supabase
      .from("income")
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

    /*
   * ============================================
   * FINANCIAL IMPACT CALCULATIONS
   *
   * Only CLEARED income affects GPCC balances.
   *
   * Cash      → Petty Cash
   * Non-Cash  → Bank
   * ============================================
   */

  const clearedRows = rows.filter(
    (r) =>
      String(r.status || "")
        .trim()
        .toLowerCase() === "cleared"
  );

  const totalIncome = clearedRows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );

  const cashIncome = clearedRows
    .filter(
      (r) =>
        String(r.mode || "")
          .trim()
          .toLowerCase() === "cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );


   const bankIncome = clearedRows
    .filter(
      (r) =>
        String(r.mode || "")
          .trim()
          .toLowerCase() !== "cash"
    )
    .reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

  return (
    <>
      <div className="pageHead">
        <div>
          <h1>Income & Puja Subscription</h1>

          <p className="muted">
            Cash receipts automatically contribute to
            Petty Cash. Non-cash receipts contribute
            to the Bank position.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setEditing(null);
            setForm(initial);
            setOpen(true);
          }}
        >
          + Add Income
        </button>
      </div>

      <div
        className="grid"
        style={{ marginBottom: 20 }}
      >
        <div className="card">
          <div className="muted">
            Cleared Income
          </div>

          <div className="metric">
            {money(totalIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Cash → Petty Cash
          </div>

          <div className="metric">
            {money(cashIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Non-Cash → Bank
          </div>

          <div className="metric">
            {money(bankIncome)}
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
              <th>Contributor</th>
              <th>Flat</th>
              <th>Receipt Mode</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Fund Impact</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((r) => {
                const isCash =
                    String(r.mode || "")
                        .trim()
                        .toLowerCase() === "cash";

                const isCleared =
                    String(r.status || "")
                        .trim()
                        .toLowerCase() === "cleared";

                return (
                  <tr key={r.id}>
                    <td>{r.date}</td>

                    <td>{r.contributor}</td>

                    <td>
                      {r.flat_no || "-"}
                    </td>

                    <td>{r.mode}</td>

                    <td>
                      {r.reference || "-"}
                    </td>

                    <td>
                      {money(Number(r.amount))}
                    </td>

                    <td>
                      <span className="status">
                        {r.status}
                      </span>
                    </td>

                    <td>
                      {!isCleared
                        ? "No balance impact"
                        : isCash
                        ? "Petty Cash +"
                        : "Bank +"}
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
                  colSpan={9}
                  className="empty"
                >
                  No income entries yet.
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
                  ? "Edit Income"
                  : "Add Income"}
              </h2>

              <button
                className="btn secondary"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="formGrid">
              <label>
                Date

                <input
                  className="input"
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      date: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Contributor Name

                <input
                  className="input"
                  value={form.contributor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contributor: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Flat / House No.

                <input
                  className="input"
                  value={form.flat_no}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      flat_no: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Amount

                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amount: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Receipt Mode

                <select
                  className="input"
                  value={form.mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      mode: e.target.value,
                    })
                  }
                >
                  <option>Cash</option>
                  <option>Online</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </label>

              <label>
                Reference / Cheque / UTR / Receipt No.

                <input
                  className="input"
                  value={form.reference}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reference: e.target.value,
                    })
                  }
                />
              </label>

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
                  <option>Cleared</option>
                  <option>Pending</option>
                  <option>Cancelled</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: 20 }}>
              <button
                className="btn"
                onClick={save}
              >
                {editing
                  ? "Update Entry"
                  : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}