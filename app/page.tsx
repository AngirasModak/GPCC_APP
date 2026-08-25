"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [msg, setMsg] = useState("");

  const [setupForm, setSetupForm] = useState({
    account_name: "GPCC Cultural Bank Account",
    opening_balance: "",
    opening_balance_date: new Date()
      .toISOString()
      .slice(0, 10),
  });

  const [s, setS] = useState({
    income: 0,
    expense: 0,
    tds: 0,

    cashIncome: 0,
    pettyCashExpense: 0,

    bankIncome: 0,
    bankExpense: 0,

    bankToPettyCash: 0,
    pettyCashToBank: 0,

    bankCreditAdjustment: 0,
    bankDebitAdjustment: 0,

    pettyCash: 0,
    bank: 0,
  });

  const loadDashboard = async () => {
    setLoading(true);
    setMsg("");

    try {
      /*
       * ============================================
       * 1. LOAD ACTIVE BANK ACCOUNT
       * ============================================
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
       * If no bank account is configured,
       * show first-time setup.
       */

      if (!bankData) {
        setLoading(false);
        return;
      }

      /*
       * ============================================
       * 2. LOAD ALL FINANCIAL DATA
       * ============================================
       */

      const [
        incomeResult,
        expenseResult,
        transferResult,
        pettyCashSettingResult,
      ] = await Promise.all([
        supabase
          .from("income")
          .select("*")
          .is("deleted_at", null),

        supabase
          .from("expenses")
          .select("*")
          .is("deleted_at", null),

        supabase
          .from("fund_transfers")
          .select("*")
          .is("deleted_at", null),

        supabase
          .from("settings")
          .select("*")
          .eq(
            "key",
            "opening_petty_cash_balance"
          )
          .maybeSingle(),
      ]);

      if (incomeResult.error) {
        throw new Error(
          incomeResult.error.message
        );
      }

      if (expenseResult.error) {
        throw new Error(
          expenseResult.error.message
        );
      }

      if (transferResult.error) {
        throw new Error(
          transferResult.error.message
        );
      }

      const incomeData =
        incomeResult.data || [];

      const expenseData =
        expenseResult.data || [];

      const transferData =
        transferResult.data || [];

      /*
       * ============================================
       * 3. TOTAL INCOME
       * ============================================
       */

      const totalIncome =
        incomeData.reduce(
          (sum: number, row: any) =>
            sum +
            Number(row.amount || 0),
          0
        );

      /*
       * ============================================
       * 4. CASH INCOME
       *
       * Cash income increases Petty Cash.
       * ============================================
       */

      const cashIncome =
        incomeData
          .filter((row: any) => {
            const mode = String(
              row.mode || ""
            )
              .trim()
              .toLowerCase();

            const status = String(
              row.status || ""
            )
              .trim()
              .toLowerCase();

            return (
              mode === "cash" &&
              [
                "",
                "cleared",
                "received",
                "paid",
              ].includes(status)
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /*
       * ============================================
       * 5. BANK-CREDITED INCOME
       *
       * Non-cash cleared income
       * increases Bank.
       * ============================================
       */

      const bankIncome =
        incomeData
          .filter((row: any) => {
            const mode = String(
              row.mode || ""
            )
              .trim()
              .toLowerCase();

            const status = String(
              row.status || ""
            )
              .trim()
              .toLowerCase();

            if (mode === "cash") {
              return false;
            }

            return [
              "",
              "cleared",
              "received",
              "paid",
            ].includes(status);
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /*
       * ============================================
       * 6. TOTAL EXPENDITURE
       *
       * Gross expenditure is retained
       * for financial reporting.
       * ============================================
       */

      const totalExpense =
        expenseData.reduce(
          (sum: number, row: any) =>
            sum +
            Number(
              row.gross_amount || 0
            ),
          0
        );

      /*
       * ============================================
       * 7. TOTAL TDS
       * ============================================
       */

      const totalTds =
        expenseData.reduce(
          (sum: number, row: any) => {
            const tdsAmount =
              row.tds_amount !== null &&
              row.tds_amount !== undefined
                ? Number(
                    row.tds_amount
                  )
                : Number(
                    row.gross_amount || 0
                  ) *
                    Number(
                      row.tds_rate || 0
                    ) /
                    100;

            return sum + tdsAmount;
          },
          0
        );

      /*
       * ============================================
       * 8. PETTY CASH EXPENSES
       *
       * Only paid petty cash expenses.
       *
       * Use net_amount where available.
       * ============================================
       */

      const pettyCashExpense =
        expenseData
          .filter((row: any) => {
            const mode = String(
              row.payment_mode || ""
            )
              .trim()
              .toLowerCase();

            const status = String(
              row.status || ""
            )
              .trim()
              .toLowerCase();

            return (
              mode === "petty cash" &&
              (
                status === "paid" ||
                status === "cleared"
              )
            );
          })
          .reduce(
            (sum: number, row: any) => {
              const amount =
                row.net_amount !== null &&
                row.net_amount !== undefined
                  ? Number(
                      row.net_amount
                    )
                  : Number(
                      row.gross_amount || 0
                    );

              return sum + amount;
            },
            0
          );

      /*
       * ============================================
       * 9. BANK EXPENSES
       *
       * Only actual paid bank transactions.
       *
       * Cash and Petty Cash are excluded.
       * ============================================
       */

      const bankExpense =
        expenseData
          .filter((row: any) => {
            const mode = String(
              row.payment_mode || ""
            )
              .trim()
              .toLowerCase();

            const status = String(
              row.status || ""
            )
              .trim()
              .toLowerCase();

            if (
              status !== "paid" &&
              status !== "cleared"
            ) {
              return false;
            }

            return [
              "bank",
              "bank transfer",
              "cheque",
              "online",
              "upi",
            ].includes(mode);
          })
          .reduce(
            (sum: number, row: any) => {
              const amount =
                row.net_amount !== null &&
                row.net_amount !== undefined
                  ? Number(
                      row.net_amount
                    )
                  : Number(
                      row.gross_amount || 0
                    );

              return sum + amount;
            },
            0
          );

      /*
       * ============================================
       * 10. BANK → PETTY CASH
       *
       * Bank decreases.
       * Petty Cash increases.
       * ============================================
       */

      const bankToPettyCash =
        transferData
          .filter(
            (row: any) =>
              row.type ===
                "Bank Withdrawal" ||
              row.type ===
                "Withdrawal"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(
                row.amount || 0
              ),
            0
          );

      /*
       * ============================================
       * 11. PETTY CASH → BANK
       *
       * Bank increases.
       * Petty Cash decreases.
       *
       * Supporting both old and
       * new transaction naming.
       * ============================================
       */

      const pettyCashToBank =
        transferData
          .filter(
            (row: any) =>
              [
                "Petty Cash to Bank",
                "Cash Deposit",
                "Deposit",
                "Petty Cash Deposit",
                "Return to Bank",
              ].includes(row.type)
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(
                row.amount || 0
              ),
            0
          );

      /*
       * ============================================
       * 12. BANK ADJUSTMENTS
       * ============================================
       */

      const bankCreditAdjustment =
        transferData
          .filter(
            (row: any) =>
              row.type ===
                "Bank Adjustment" &&
              row.direction === "IN"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(
                row.amount || 0
              ),
            0
          );

      const bankDebitAdjustment =
        transferData
          .filter(
            (row: any) =>
              row.type ===
                "Bank Adjustment" &&
              row.direction === "OUT"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(
                row.amount || 0
              ),
            0
          );

      /*
       * ============================================
       * 13. OPENING PETTY CASH
       * ============================================
       */

      const openingPettyCash =
        Number(
          pettyCashSettingResult
            .data?.value || 0
        );

      /*
       * ============================================
       * 14. CURRENT PETTY CASH
       * ============================================
       */

      const currentPettyCash =
        openingPettyCash +
        cashIncome +
        bankToPettyCash -
        pettyCashExpense -
        pettyCashToBank;

      /*
       * ============================================
       * 15. CURRENT BANK POSITION
       * ============================================
       */

      const currentBank =
        Number(
          bankData.opening_balance || 0
        ) +
        bankIncome -
        bankExpense -
        bankToPettyCash +
        pettyCashToBank +
        bankCreditAdjustment -
        bankDebitAdjustment;

      /*
       * ============================================
       * 16. SAVE DASHBOARD DATA
       * ============================================
       */

      setS({
        income: totalIncome,
        expense: totalExpense,
        tds: totalTds,

        cashIncome,
        pettyCashExpense,

        bankIncome,
        bankExpense,

        bankToPettyCash,
        pettyCashToBank,

        bankCreditAdjustment,
        bankDebitAdjustment,

        pettyCash: currentPettyCash,
        bank: currentBank,
      });
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load dashboard data."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /*
   * ============================================
   * FIRST-TIME BANK SETUP
   * ============================================
   */

  const saveOpeningBalance =
    async () => {
      if (
        !setupForm.account_name.trim() ||
        setupForm.opening_balance === ""
      ) {
        setMsg(
          "Please enter the bank account name and opening balance."
        );
        return;
      }

      const openingBalance = Number(
        setupForm.opening_balance
      );

      if (
        Number.isNaN(openingBalance) ||
        openingBalance < 0
      ) {
        setMsg(
          "Please enter a valid opening balance."
        );
        return;
      }

      const { error } = await supabase
        .from("bank_accounts")
        .insert({
          account_name:
            setupForm.account_name.trim(),

          opening_balance:
            openingBalance,

          opening_balance_date:
            setupForm.opening_balance_date,

          is_active: true,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      await loadDashboard();
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
          Loading GPCC Financial Dashboard...
        </h2>
      </div>
    );
  }

  /*
   * ============================================
   * INITIAL BANK SETUP
   * ============================================
   */

  if (!bankAccount) {
    return (
      <div>
        <div className="pageHead">
          <div>
            <h1>
              Initial Bank Setup
            </h1>

            <p className="muted">
              Configure the GPCC Cultural
              Committee bank account and
              opening balance.
            </p>
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

        <div
          className="card"
          style={{
            maxWidth: 750,
          }}
        >
          <h2>
            Set Opening Bank Balance
          </h2>

          <p className="muted">
            This balance will be used as
            the starting point for all
            future bank calculations.
          </p>

          <div className="formGrid">
            <label>
              Bank Account Name

              <input
                className="input"
                value={
                  setupForm.account_name
                }
                onChange={(e) =>
                  setSetupForm({
                    ...setupForm,
                    account_name:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              Opening Balance

              <input
                className="input"
                type="number"
                min="0"
                value={
                  setupForm.opening_balance
                }
                onChange={(e) =>
                  setSetupForm({
                    ...setupForm,
                    opening_balance:
                      e.target.value,
                  })
                }
              />
            </label>

            <label>
              Balance As On Date

              <input
                className="input"
                type="date"
                value={
                  setupForm.opening_balance_date
                }
                onChange={(e) =>
                  setSetupForm({
                    ...setupForm,
                    opening_balance_date:
                      e.target.value,
                  })
                }
              />
            </label>
          </div>

          <div
            style={{
              marginTop: 20,
            }}
          >
            <button
              className="btn"
              onClick={
                saveOpeningBalance
              }
            >
              Save Opening Balance
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================
   * MAIN DASHBOARD
   * ============================================
   */

  return (
    <>
      <div className="pageHead">
        <div>
          <h1>
            Financial Dashboard
          </h1>

          <p className="muted">
            {bankAccount.account_name}
            {" · "}
            Opening balance as on{" "}
            {
              bankAccount.opening_balance_date
            }
          </p>
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

      <div className="grid">
        <div className="card">
          <div className="muted">
            Current Bank Position
          </div>

          <div className="metric">
            {money(s.bank)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Current Petty Cash
          </div>

          <div className="metric">
            {money(s.pettyCash)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Total Income
          </div>

          <div className="metric">
            {money(s.income)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Total Expenditure
          </div>

          <div className="metric">
            {money(s.expense)}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            TDS Calculated
          </div>

          <div className="metric">
            {money(s.tds)}
          </div>
        </div>
      </div>

      {/* BANK RECONCILIATION */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          Bank Reconciliation
        </h3>

        <div className="tableWrap">
          <table className="table">
            <tbody>
              <tr>
                <td>
                  Opening Bank Balance
                </td>

                <td>
                  {money(
                    bankAccount.opening_balance
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  + Bank-Credited Income
                </td>

                <td>
                  {money(s.bankIncome)}
                </td>
              </tr>

              <tr>
                <td>
                  - Bank Payments
                </td>

                <td>
                  {money(s.bankExpense)}
                </td>
              </tr>

              <tr>
                <td>
                  - Bank → Petty Cash
                </td>

                <td>
                  {money(
                    s.bankToPettyCash
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  + Petty Cash → Bank
                </td>

                <td>
                  {money(
                    s.pettyCashToBank
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  + Bank Adjustment Credit
                </td>

                <td>
                  {money(
                    s.bankCreditAdjustment
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  - Bank Adjustment Debit
                </td>

                <td>
                  {money(
                    s.bankDebitAdjustment
                  )}
                </td>
              </tr>

              <tr>
                <th>
                  Current Bank Position
                </th>

                <th>
                  {money(s.bank)}
                </th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* PETTY CASH RECONCILIATION */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          Petty Cash Reconciliation
        </h3>

        <div className="tableWrap">
          <table className="table">
            <tbody>
              <tr>
                <td>
                  + Cash Income
                </td>

                <td>
                  {money(s.cashIncome)}
                </td>
              </tr>

              <tr>
                <td>
                  + Bank → Petty Cash
                </td>

                <td>
                  {money(
                    s.bankToPettyCash
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  - Petty Cash Expenses
                </td>

                <td>
                  {money(
                    s.pettyCashExpense
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  - Petty Cash → Bank
                </td>

                <td>
                  {money(
                    s.pettyCashToBank
                  )}
                </td>
              </tr>

              <tr>
                <th>
                  Current Petty Cash
                </th>

                <th>
                  {money(s.pettyCash)}
                </th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          Financial Control Centre
        </h3>

        <p className="muted">
          Bank and petty cash balances are
          calculated dynamically from income,
          expenses, opening balances and
          transfers.
        </p>
      </div>
    </>
  );
}