"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Row = {
  id: string;
  date: string;
  requisition_no: string | null;
  type: string;
  particulars: string;
  amount: number;
  reference: string | null;
  remarks: string | null;
  direction: "IN" | "OUT";
  deleted_at?: string | null;
};

type BankAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const blank = {
  date: new Date().toISOString().slice(0, 10),
  requisition_no: "",
  type: "Bank Withdrawal",
  particulars: "",
  amount: "",
  reference: "",
  remarks: "",
};

export default function BankTransfersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [bankIncome, setBankIncome] = useState(0);
  const [bankExpenses, setBankExpenses] =
    useState(0);

  const [form, setForm] = useState<any>(blank);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] =
    useState<string | null>(null);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMsg("");

    try {
      /*
       * ========================================
       * 1. LOAD ACTIVE BANK ACCOUNT
       * ========================================
       */

      const {
        data: bankData,
        error: bankError,
      } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (bankError) {
        throw new Error(bankError.message);
      }

      setBankAccount(bankData);

      /*
       * ========================================
       * 2. LOAD FUND TRANSFERS
       * ========================================
       */

      const {
        data: transferData,
        error: transferError,
      } = await supabase
        .from("fund_transfers")
        .select("*")
        .is("deleted_at", null)
        .order("date", {
          ascending: false,
        });

      if (transferError) {
        throw new Error(
          transferError.message
        );
      }

      setRows(
        (transferData || []) as Row[]
      );

      /*
       * ========================================
       * 3. LOAD CLEARED INCOME
       *
       * Only non-cash income increases Bank.
       * ========================================
       */

      const {
        data: incomeData,
        error: incomeError,
      } = await supabase
        .from("income")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "Cleared");

      if (incomeError) {
        throw new Error(
          incomeError.message
        );
      }

      const totalBankIncome =
        (incomeData || [])
          .filter((row: any) => {
            const mode = String(
              row.mode || ""
            ).toLowerCase();

            return (
              mode === "cheque" ||
              mode === "online" ||
              mode === "bank transfer" ||
              mode === "upi"
            );
          })
          .reduce(
            (total: number, row: any) =>
              total +
              Number(row.amount || 0),
            0
          );

      setBankIncome(totalBankIncome);

      /*
       * ========================================
       * 4. LOAD PAID EXPENSES
       *
       * Only Bank / Cheque / Online / UPI
       * payments reduce Bank.
       *
       * Net amount is used because TDS does
       * not leave the bank as vendor payment.
       * ========================================
       */

      const {
        data: expenseData,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "Paid");

      if (expenseError) {
        throw new Error(
          expenseError.message
        );
      }

      const totalBankExpenses =
        (expenseData || [])
          .filter((row: any) => {
            const mode = String(
              row.payment_mode || ""
            ).toLowerCase();

            return (
              mode === "bank transfer" ||
              mode === "cheque" ||
              mode === "online" ||
              mode === "upi"
            );
          })
          .reduce(
            (total: number, row: any) => {
              const netAmount =
                row.net_amount !== null &&
                row.net_amount !== undefined
                  ? Number(row.net_amount)
                  : Number(
                      row.gross_amount || 0
                    ) -
                    Number(
                      row.tds_amount || 0
                    );

              return total + netAmount;
            },
            0
          );

      setBankExpenses(
        totalBankExpenses
      );
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load bank data."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * ========================================
   * BANK TRANSFER CALCULATIONS
   * ========================================
   */

  /*
   * BANK → PETTY CASH
   */

  const bankToPettyCash = rows
    .filter(
      (row) =>
        row.type ===
          "Bank Withdrawal" ||
        row.type === "Withdrawal"
    )
    .reduce(
      (total, row) =>
        total +
        Number(row.amount || 0),
      0
    );

  /*
   * PETTY CASH → BANK
   */

  const pettyCashToBank = rows
    .filter(
      (row) =>
        row.type ===
          "Petty Cash to Bank" ||
        row.type === "Cash Deposit" ||
        row.type ===
          "Petty Cash Deposit" ||
        row.type ===
          "Return to Bank"
    )
    .reduce(
      (total, row) =>
        total +
        Number(row.amount || 0),
      0
    );

  /*
   * BANK ADJUSTMENT CREDIT
   */

  const bankAdjustmentCredit =
    rows
      .filter(
        (row) =>
          row.type ===
            "Bank Adjustment" &&
          row.direction === "IN"
      )
      .reduce(
        (total, row) =>
          total +
          Number(row.amount || 0),
        0
      );

  /*
   * BANK ADJUSTMENT DEBIT
   */

  const bankAdjustmentDebit =
    rows
      .filter(
        (row) =>
          row.type ===
            "Bank Adjustment" &&
          row.direction === "OUT"
      )
      .reduce(
        (total, row) =>
          total +
          Number(row.amount || 0),
        0
      );

  /*
   * ========================================
   * FINAL BANK BALANCE
   * ========================================
   */

  const openingBalance =
    Number(
      bankAccount?.opening_balance || 0
    );

  const currentBank =
    openingBalance +
    bankIncome -
    bankExpenses -
    bankToPettyCash +
    pettyCashToBank +
    bankAdjustmentCredit -
    bankAdjustmentDebit;

  /*
   * ========================================
   * SAVE TRANSACTION
   * ========================================
   */

  const save = async () => {
    if (
      !form.particulars.trim() ||
      !form.amount
    ) {
      setMsg(
        "Particulars and amount are required."
      );
      return;
    }

    if (Number(form.amount) <= 0) {
      setMsg(
        "Amount must be greater than zero."
      );
      return;
    }

    let direction: "IN" | "OUT" =
      "OUT";

    if (
      form.type ===
        "Petty Cash to Bank" ||
      form.type ===
        "Bank Adjustment Credit"
    ) {
      direction = "IN";
    }

    const normalizedType =
      form.type ===
        "Bank Adjustment Credit" ||
      form.type ===
        "Bank Adjustment Debit"
        ? "Bank Adjustment"
        : form.type;

    const payload = {
      date: form.date,

      requisition_no:
        form.requisition_no.trim() ||
        null,

      type: normalizedType,

      particulars:
        form.particulars.trim(),

      amount: Number(form.amount),

      reference:
        form.reference.trim() ||
        null,

      remarks:
        form.remarks.trim() ||
        null,

      direction,
    };

    let error: any;

    if (editing) {
      ({ error } = await supabase
        .from("fund_transfers")
        .update(payload)
        .eq("id", editing));
    } else {
      ({ error } = await supabase
        .from("fund_transfers")
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

    await load();
  };

  /*
   * ========================================
   * EDIT TRANSACTION
   * ========================================
   */

  const edit = (row: Row) => {
    setEditing(row.id);

    let displayType = row.type;

    if (
      row.type ===
      "Bank Adjustment"
    ) {
      displayType =
        row.direction === "IN"
          ? "Bank Adjustment Credit"
          : "Bank Adjustment Debit";
    }

    setForm({
      ...row,

      type: displayType,

      amount: String(row.amount),

      requisition_no:
        row.requisition_no || "",

      reference:
        row.reference || "",

      remarks:
        row.remarks || "",
    });

    setOpen(true);
  };

  /*
   * ========================================
   * DELETE TRANSACTION
   * ========================================
   */

  const del = async (id: string) => {
    if (
      !confirm(
        "Delete this bank transaction?"
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("fund_transfers")
      .update({
        deleted_at:
          new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    await load();
  };

  const openNewEntry = () => {
    setEditing(null);
    setForm(blank);
    setMsg("");
    setOpen(true);
  };

  /*
   * ========================================
   * LOADING
   * ========================================
   */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Bank Transactions...
        </h2>
      </div>
    );
  }

  /*
   * ========================================
   * PAGE
   * ========================================
   */

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1>
            Bank & Transfers
          </h1>

          <p className="muted">
            {bankAccount
              ? `${bankAccount.account_name} · Opening balance as on ${bankAccount.opening_balance_date}`
              : "Bank movements and transfers between GPCC Bank and Petty Cash"}
          </p>
        </div>

        <button
          className="btn"
          onClick={openNewEntry}
        >
          + Add Bank Transaction
        </button>
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

      <div
        className="grid"
        style={{
          marginBottom: 20,
        }}
      >
        <div className="card">
          <div className="muted">
            Opening Bank Balance
          </div>

          <div className="metric">
            {money(openingBalance)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Cleared Bank Income
          </div>

          <div className="metric">
            {money(bankIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Paid Bank Expenses
          </div>

          <div className="metric">
            {money(bankExpenses)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Bank → Petty Cash
          </div>

          <div className="metric">
            {money(bankToPettyCash)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Petty Cash → Bank
          </div>

          <div className="metric">
            {money(pettyCashToBank)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Current Bank Position
          </div>

          <div className="metric">
            {money(currentBank)}
          </div>
        </div>
      </div>

      <div className="card tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Requisition No.</th>
              <th>Transaction</th>
              <th>Particulars</th>
              <th>Reference</th>
              <th>Direction</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>

                  <td>
                    {row.requisition_no ||
                      "-"}
                  </td>

                  <td>{row.type}</td>

                  <td>
                    {row.particulars}
                  </td>

                  <td>
                    {row.reference || "-"}
                  </td>

                  <td>
                    {row.direction}
                  </td>

                  <td>
                    {money(
                      Number(row.amount)
                    )}
                  </td>

                  <td className="actions">
                    <button
                      className="btn secondary"
                      onClick={() =>
                        edit(row)
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="btn danger"
                      onClick={() =>
                        del(row.id)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="empty"
                >
                  No bank transactions yet.
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
                  ? "Edit Bank Transaction"
                  : "Add Bank Transaction"}
              </h2>

              <button
                className="btn secondary"
                onClick={() =>
                  setOpen(false)
                }
              >
                Close
              </button>
            </div>

            <div className="formGrid">
              <Field
                label="Date"
                type="date"
                value={form.date}
                set={(value) =>
                  setForm({
                    ...form,
                    date: value,
                  })
                }
              />

              <Field
                label="Requisition Number"
                value={
                  form.requisition_no
                }
                set={(value) =>
                  setForm({
                    ...form,
                    requisition_no:
                      value,
                  })
                }
              />

              <label>
                Transaction Type

                <select
                  className="input"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type:
                        e.target.value,
                    })
                  }
                >
                  <option value="Bank Withdrawal">
                    Bank → Petty Cash
                  </option>

                  <option value="Petty Cash to Bank">
                    Petty Cash → Bank
                  </option>

                  <option value="Bank Adjustment Credit">
                    Bank Adjustment Credit
                  </option>

                  <option value="Bank Adjustment Debit">
                    Bank Adjustment Debit
                  </option>
                </select>
              </label>

              <Field
                label="Amount"
                type="number"
                value={form.amount}
                set={(value) =>
                  setForm({
                    ...form,
                    amount: value,
                  })
                }
              />

              <Field
                label="Particulars"
                value={form.particulars}
                set={(value) =>
                  setForm({
                    ...form,
                    particulars: value,
                  })
                }
              />

              <Field
                label="Reference / Voucher / Bill No."
                value={form.reference}
                set={(value) =>
                  setForm({
                    ...form,
                    reference: value,
                  })
                }
              />
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
                    remarks:
                      e.target.value,
                  })
                }
              />
            </label>

            <div
              style={{
                marginTop: 20,
              }}
            >
              <button
                className="btn"
                onClick={save}
              >
                {editing
                  ? "Update Transaction"
                  : "Save Transaction"}
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
  set: (value: string) => void;
}) {
  return (
    <label>
      {label}

      <input
        className="input"
        type={type}
        value={value ?? ""}
        onChange={(e) =>
          set(e.target.value)
        }
      />
    </label>
  );
}