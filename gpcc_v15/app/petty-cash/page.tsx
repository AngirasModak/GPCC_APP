"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type TransferRow = {
  id: string;
  date: string;
  requisition_no: string | null;
  type: string;
  particulars: string;
  amount: number;
  reference: string | null;
  remarks: string | null;
  direction: "IN" | "OUT";
};

type IncomeRow = {
  id: string;
  date: string;
  contributor: string;
  flat_no: string | null;
  amount: number;
  mode: string;
  reference: string | null;
  status: string;
};

type ExpenseRow = {
  id: string;
  date: string;
  requisition_no: string | null;
  vendor: string;
  bill_no: string | null;
  gross_amount: number;
  net_amount: number | null;
  tds_amount: number | null;
  tds_rate: number | null;
  payment_mode: string;
  status: string;
};

type PettyCashAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
};

type LedgerRow = {
  id: string;
  date: string;
  source: "Income" | "Expense" | "Transfer";
  requisition_no: string | null;
  type: string;
  particulars: string;
  reference: string | null;
  amount_in: number;
  amount_out: number;
  editable: boolean;
  transferId?: string;
};

const blank = {
  date: new Date().toISOString().slice(0, 10),
  requisition_no: "",
  type: "Bank Withdrawal",
  particulars: "",
  amount: "",
  reference: "",
  remarks: "",
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export default function PettyCashPage() {
  const [transfers, setTransfers] = useState<
    TransferRow[]
  >([]);

  const [incomeRows, setIncomeRows] = useState<
    IncomeRow[]
  >([]);

  const [expenseRows, setExpenseRows] = useState<
    ExpenseRow[]
  >([]);

  const [pettyCashAccount, setPettyCashAccount] =
    useState<PettyCashAccount | null>(null);

  const [form, setForm] = useState<any>(blank);
  const [open, setOpen] = useState(false);

  const [editing, setEditing] =
    useState<string | null>(null);

  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  /*
   * ============================================
   * LOAD ALL DATA
   * ============================================
   */

  const load = async () => {
    setLoading(true);
    setMsg("");

    try {
      /*
       * 1. LOAD PETTY CASH ACCOUNT
       */

      const {
        data: pettyCashData,
        error: pettyCashError,
      } = await supabase
        .from("petty_cash_accounts")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (pettyCashError) {
        throw new Error(
          pettyCashError.message
        );
      }

      setPettyCashAccount(pettyCashData);

      /*
       * 2. LOAD FUND TRANSFERS
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

      setTransfers(
        (transferData || []) as TransferRow[]
      );

      /*
       * 3. LOAD CLEARED CASH INCOME
       */

      const {
        data: incomeData,
        error: incomeError,
      } = await supabase
        .from("income")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "Cleared")
        .order("date", {
          ascending: false,
        });

      if (incomeError) {
        throw new Error(
          incomeError.message
        );
      }

      setIncomeRows(
        (incomeData || []) as IncomeRow[]
      );

      /*
       * 4. LOAD PAID EXPENSES
       */

      const {
        data: expenseData,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .select("*")
        .is("deleted_at", null)
        .eq("status", "Paid")
        .order("date", {
          ascending: false,
        });

      if (expenseError) {
        throw new Error(
          expenseError.message
        );
      }

      setExpenseRows(
        (expenseData || []) as ExpenseRow[]
      );
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load petty cash data."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  /*
   * ============================================
   * CASH INCOME
   *
   * Only Cleared + Cash income
   * increases Petty Cash.
   * ============================================
   */

  const cashIncome = incomeRows.filter(
    (row) =>
      String(row.mode || "")
        .toLowerCase()
        .trim() === "cash"
  );

  /*
   * ============================================
   * PETTY CASH EXPENSES
   *
   * Only Paid + Petty Cash expenses
   * reduce Petty Cash.
   * ============================================
   */

  const pettyCashExpenses =
    expenseRows.filter(
      (row) =>
        String(row.payment_mode || "")
          .toLowerCase()
          .trim() === "petty cash"
    );

  /*
   * ============================================
   * BANK → PETTY CASH
   *
   * Cash increases.
   * ============================================
   */

  const bankToPettyCash =
    transfers.filter(
      (row) =>
        row.type ===
          "Bank Withdrawal" ||
        row.type === "Withdrawal"
    );

  /*
   * ============================================
   * PETTY CASH → BANK
   *
   * Cash decreases.
   * ============================================
   */

  const pettyCashToBank =
    transfers.filter(
      (row) =>
        row.type ===
          "Petty Cash to Bank" ||
        row.type === "Cash Deposit" ||
        row.type ===
          "Petty Cash Deposit" ||
        row.type ===
          "Return to Bank"
    );

  /*
   * ============================================
   * CASH ADJUSTMENTS
   *
   * Only Cash Adjustment records
   * affect Petty Cash.
   *
   * Bank Adjustment records must NOT
   * affect this balance.
   * ============================================
   */

  const cashAdjustmentIn =
    transfers.filter(
      (row) =>
        row.type ===
          "Cash Adjustment" &&
        row.direction === "IN"
    );

  const cashAdjustmentOut =
    transfers.filter(
      (row) =>
        row.type ===
          "Cash Adjustment" &&
        row.direction === "OUT"
    );

  /*
   * ============================================
   * TOTALS
   * ============================================
   */

  const totalCashIncome =
    cashIncome.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  const totalPettyCashExpense =
    pettyCashExpenses.reduce(
      (sum, row) => {
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

        return sum + netAmount;
      },
      0
    );

  const totalBankToPettyCash =
    bankToPettyCash.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  const totalPettyCashToBank =
    pettyCashToBank.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  const totalCashAdjustmentIn =
    cashAdjustmentIn.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  const totalCashAdjustmentOut =
    cashAdjustmentOut.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  /*
   * ============================================
   * FINAL PETTY CASH BALANCE
   * ============================================
   */

  const openingBalance =
    Number(
      pettyCashAccount?.opening_balance || 0
    );

  const balance =
    openingBalance +
    totalCashIncome +
    totalBankToPettyCash -
    totalPettyCashExpense -
    totalPettyCashToBank +
    totalCashAdjustmentIn -
    totalCashAdjustmentOut;

  /*
   * ============================================
   * CONSOLIDATED PETTY CASH LEDGER
   * ============================================
   */

  const ledger: LedgerRow[] = [
    /*
     * CASH INCOME
     */

    ...cashIncome.map((row) => ({
      id: `income-${row.id}`,
      date: row.date,
      source: "Income" as const,
      requisition_no: null,
      type: "Cash Income",
      particulars: row.contributor,
      reference: row.reference,
      amount_in: Number(row.amount || 0),
      amount_out: 0,
      editable: false,
    })),

    /*
     * PETTY CASH EXPENSE
     */

    ...pettyCashExpenses.map(
      (row) => {
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

        return {
          id: `expense-${row.id}`,
          date: row.date,
          source: "Expense" as const,
          requisition_no:
            row.requisition_no,
          type: "Petty Cash Expense",
          particulars: row.vendor,
          reference: row.bill_no,
          amount_in: 0,
          amount_out: netAmount,
          editable: false,
        };
      }
    ),

    /*
     * RELEVANT TRANSFERS ONLY
     *
     * Do not show Bank Adjustment
     * transactions in the Petty Cash
     * ledger.
     */

    ...transfers
      .filter(
        (row) =>
          row.type ===
            "Bank Withdrawal" ||
          row.type === "Withdrawal" ||
          row.type ===
            "Petty Cash to Bank" ||
          row.type ===
            "Cash Deposit" ||
          row.type ===
            "Petty Cash Deposit" ||
          row.type ===
            "Return to Bank" ||
          row.type ===
            "Cash Adjustment"
      )
      .map((row) => ({
        id: `transfer-${row.id}`,
        date: row.date,
        source: "Transfer" as const,
        requisition_no:
          row.requisition_no,
        type: row.type,
        particulars: row.particulars,
        reference: row.reference,

        amount_in:
          row.type ===
            "Bank Withdrawal" ||
          row.type === "Withdrawal" ||
          (
            row.type ===
              "Cash Adjustment" &&
            row.direction === "IN"
          )
            ? Number(row.amount || 0)
            : 0,

        amount_out:
          row.type ===
            "Petty Cash to Bank" ||
          row.type ===
            "Cash Deposit" ||
          row.type ===
            "Petty Cash Deposit" ||
          row.type ===
            "Return to Bank" ||
          (
            row.type ===
              "Cash Adjustment" &&
            row.direction === "OUT"
          )
            ? Number(row.amount || 0)
            : 0,

        editable: true,
        transferId: row.id,
      })),
  ].sort(
    (a, b) =>
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
  );

  /*
   * ============================================
   * SAVE CASH MOVEMENT
   * ============================================
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

    /*
     * Normalize UI type to database type.
     */

    const normalizedType =
      form.type === "Cash Adjustment +" ||
      form.type === "Cash Adjustment -"
        ? "Cash Adjustment"
        : form.type;

    /*
     * Determine direction.
     */

    let direction: "IN" | "OUT" = "OUT";

    if (
      form.type ===
        "Bank Withdrawal" ||
      form.type === "Withdrawal" ||
      form.type ===
        "Cash Adjustment +"
    ) {
      direction = "IN";
    }

    const payload = {
      date: form.date,

      requisition_no:
        form.requisition_no.trim() ||
        null,

      type: normalizedType,

      particulars:
        form.particulars.trim(),

      reference:
        form.reference.trim() ||
        null,

      amount: Number(form.amount),

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
   * ============================================
   * EDIT CASH MOVEMENT
   * ============================================
   */

  const edit = (
    row: TransferRow
  ) => {
    setEditing(row.id);

    let displayType = row.type;

    if (
      row.type ===
      "Cash Adjustment"
    ) {
      displayType =
        row.direction === "IN"
          ? "Cash Adjustment +"
          : "Cash Adjustment -";
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
   * ============================================
   * DELETE CASH MOVEMENT
   * ============================================
   */

  const del = async (
    id: string
  ) => {
    if (
      !confirm(
        "Delete this petty cash movement?"
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
   * ============================================
   * LOADING
   * ============================================
   */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Petty Cash...
        </h2>
      </div>
    );
  }

  /*
   * ============================================
   * PAGE
   * ============================================
   */

  return (
    <div>
      <div className="pageHead">
        <div>
          <h1>Petty Cash</h1>

          <p className="muted">
            {pettyCashAccount
              ? `${pettyCashAccount.account_name} · Opening balance as on ${pettyCashAccount.opening_balance_date}`
              : "Consolidated petty cash ledger"}
          </p>
        </div>

        <button
          className="btn"
          onClick={openNewEntry}
        >
          + Add Cash Movement
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
            Opening Petty Cash
          </div>

          <div className="metric">
            {money(openingBalance)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Cleared Cash Income
          </div>

          <div className="metric">
            {money(totalCashIncome)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Bank → Petty Cash
          </div>

          <div className="metric">
            {money(
              totalBankToPettyCash
            )}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Petty Cash Expenses
          </div>

          <div className="metric">
            {money(
              totalPettyCashExpense
            )}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Petty Cash → Bank
          </div>

          <div className="metric">
            {money(
              totalPettyCashToBank
            )}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Current Petty Cash
          </div>

          <div className="metric">
            {money(balance)}
          </div>
        </div>
      </div>

      <div className="card tableWrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th>Requisition No.</th>
              <th>Type</th>
              <th>Particulars</th>
              <th>Reference</th>
              <th>Cash In</th>
              <th>Cash Out</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {ledger.length ? (
              ledger.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>

                  <td>{row.source}</td>

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
                    {row.amount_in
                      ? money(row.amount_in)
                      : "-"}
                  </td>

                  <td>
                    {row.amount_out
                      ? money(row.amount_out)
                      : "-"}
                  </td>

                  <td className="actions">
                    {row.editable &&
                    row.transferId ? (
                      <>
                        <button
                          className="btn secondary"
                          onClick={() => {
                            const transfer =
                              transfers.find(
                                (x) =>
                                  x.id ===
                                  row.transferId
                              );

                            if (transfer) {
                              edit(transfer);
                            }
                          }}
                        >
                          Edit
                        </button>

                        <button
                          className="btn danger"
                          onClick={() =>
                            del(
                              row.transferId!
                            )
                          }
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="muted">
                        Edit from{" "}
                        {row.source} module
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={9}
                  className="empty"
                >
                  No petty cash movements yet.
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
                  ? "Edit Cash Movement"
                  : "Add Cash Movement"}
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
                Cash Movement Type

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

                  <option value="Cash Adjustment +">
                    Cash Adjustment (+)
                  </option>

                  <option value="Cash Adjustment -">
                    Cash Adjustment (-)
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
                label="Reference / Voucher / Bank Reference"
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
                  ? "Update Entry"
                  : "Save Entry"}
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