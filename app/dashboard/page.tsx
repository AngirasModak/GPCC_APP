"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type BankAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
};

type PettyCashAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
};

type DashboardSummary = {
  income: number;
  expense: number;
  tds: number;

  bankIncome: number;
  cashIncome: number;

  bankExpense: number;
  pettyCashExpense: number;

  bankToPettyCash: number;
  pettyCashToBank: number;

  bankAdjustmentCredit: number;
  bankAdjustmentDebit: number;

  cashAdjustmentCredit: number;
  cashAdjustmentDebit: number;

  bank: number;
  pettyCash: number;
  totalFunds: number;
};

/* =========================================================
   HELPERS
========================================================= */

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const normalize = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const initialSummary: DashboardSummary = {
  income: 0,
  expense: 0,
  tds: 0,

  bankIncome: 0,
  cashIncome: 0,

  bankExpense: 0,
  pettyCashExpense: 0,

  bankToPettyCash: 0,
  pettyCashToBank: 0,

  bankAdjustmentCredit: 0,
  bankAdjustmentDebit: 0,

  cashAdjustmentCredit: 0,
  cashAdjustmentDebit: 0,

  bank: 0,
  pettyCash: 0,
  totalFunds: 0,
};

/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [pettyCashAccount, setPettyCashAccount] =
    useState<PettyCashAccount | null>(null);

  const [msg, setMsg] = useState("");

  const [bankSetupForm, setBankSetupForm] =
    useState({
      account_name: "GPCC Cultural Bank Account",
      opening_balance: "",
      opening_balance_date: new Date()
        .toISOString()
        .slice(0, 10),
    });

  const [pettyCashSetupForm, setPettyCashSetupForm] =
    useState({
      account_name: "GPCC Petty Cash",
      opening_balance: "",
      opening_balance_date: new Date()
        .toISOString()
        .slice(0, 10),
    });

  const [s, setS] =
    useState<DashboardSummary>(initialSummary);

  /* =========================================================
     LOAD DASHBOARD
  ========================================================= */

  const loadDashboard = async () => {
    setLoading(true);
    setMsg("");

    try {
      /* -------------------------------------------------------
         1. ACTIVE BANK ACCOUNT
      ------------------------------------------------------- */

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

      setBankAccount(
        bankData as BankAccount | null
      );

      /* -------------------------------------------------------
         2. ACTIVE PETTY CASH ACCOUNT
      ------------------------------------------------------- */

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

      setPettyCashAccount(
        pettyCashData as PettyCashAccount | null
      );

      /*
       * Reset values if setup is incomplete.
       */

      if (!bankData || !pettyCashData) {
        setS(initialSummary);
        return;
      }

      /* -------------------------------------------------------
         3. CLEARED INCOME
      ------------------------------------------------------- */

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

      /* -------------------------------------------------------
         4. PAID EXPENSES
      ------------------------------------------------------- */

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

      /* -------------------------------------------------------
         5. VALID FUND TRANSFERS
         
         Include only Cleared or Completed transfers.
      ------------------------------------------------------- */

      const {
        data: transferData,
        error: transferError,
      } = await supabase
        .from("fund_transfers")
        .select("*")
        .is("deleted_at", null)
        .in("status", [
          "Cleared",
          "Completed",
        ]);

      if (transferError) {
        throw new Error(
          transferError.message
        );
      }

      const incomes = incomeData || [];
      const expenses = expenseData || [];
      const transfers = transferData || [];

      /* =======================================================
         INCOME
      ======================================================= */

      const totalIncome = incomes.reduce(
        (sum: number, row: any) =>
          sum + Number(row.amount || 0),
        0
      );

      /*
       * CASH INCOME
       */

      const totalCashIncome = incomes
        .filter(
          (row: any) =>
            normalize(row.mode) === "cash"
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.amount || 0),
          0
        );

      /*
       * BANK INCOME
       
       * Any non-cash cleared income is treated
       * as bank income.
       */

      const totalBankIncome = incomes
        .filter(
          (row: any) =>
            normalize(row.mode) !== "cash"
        )
        .reduce(
          (sum: number, row: any) =>
            sum + Number(row.amount || 0),
          0
        );

      /* =======================================================
         EXPENSE
      ======================================================= */

      const totalExpense = expenses.reduce(
        (sum: number, row: any) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

      /* -------------------------------------------------------
         TDS
      ------------------------------------------------------- */

      const totalTds = expenses.reduce(
        (sum: number, row: any) => {
          const gross = Number(
            row.gross_amount || 0
          );

          const tds =
            row.tds_amount !== null &&
            row.tds_amount !== undefined
              ? Number(row.tds_amount || 0)
              : gross *
                (Number(row.tds_rate || 0) / 100);

          return sum + tds;
        },
        0
      );

      /* -------------------------------------------------------
         NET PAYMENT
      ------------------------------------------------------- */

      const getNetPayment = (row: any) => {
        if (
          row.net_amount !== null &&
          row.net_amount !== undefined
        ) {
          return Number(
            row.net_amount || 0
          );
        }

        const gross = Number(
          row.gross_amount || 0
        );

        const tds =
          row.tds_amount !== null &&
          row.tds_amount !== undefined
            ? Number(row.tds_amount || 0)
            : gross *
              (Number(row.tds_rate || 0) / 100);

        return gross - tds;
      };

      /* -------------------------------------------------------
         PETTY CASH EXPENSE
      ------------------------------------------------------- */

      const totalPettyCashExpense =
        expenses
          .filter(
            (row: any) =>
              normalize(
                row.payment_mode
              ) === "petty cash"
          )
          .reduce(
            (sum: number, row: any) =>
              sum + getNetPayment(row),
            0
          );

      /* -------------------------------------------------------
         BANK EXPENSE

         Any paid expense which is not Petty Cash
         is treated as Bank expense.
      ------------------------------------------------------- */

      const totalBankExpense =
        expenses
          .filter(
            (row: any) =>
              normalize(
                row.payment_mode
              ) !== "petty cash"
          )
          .reduce(
            (sum: number, row: any) =>
              sum + getNetPayment(row),
            0
          );

      /* =======================================================
         FUND TRANSFERS
      ======================================================= */

      /* -------------------------------------------------------
         BANK → PETTY CASH
      ------------------------------------------------------- */

      const totalBankToPettyCash =
        transfers
          .filter((row: any) => {
            const type =
              normalize(row.type);

            return [
              "bank withdrawal",
              "withdrawal",
            ].includes(type);
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* -------------------------------------------------------
         PETTY CASH → BANK
      ------------------------------------------------------- */

      const totalPettyCashToBank =
        transfers
          .filter((row: any) => {
            const type =
              normalize(row.type);

            return [
              "petty cash to bank",
              "cash deposit",
              "deposit",
              "petty cash deposit",
              "return to bank",
            ].includes(type);
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =======================================================
         BANK ADJUSTMENTS
      ======================================================= */

      const totalBankAdjustmentCredit =
        transfers
          .filter(
            (row: any) =>
              normalize(row.type) ===
                "bank adjustment" &&
              normalize(row.direction) ===
                "in"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalBankAdjustmentDebit =
        transfers
          .filter(
            (row: any) =>
              normalize(row.type) ===
                "bank adjustment" &&
              normalize(row.direction) ===
                "out"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =======================================================
         CASH ADJUSTMENTS
      ======================================================= */

      const totalCashAdjustmentCredit =
        transfers
          .filter((row: any) => {
            const type =
              normalize(row.type);

            const direction =
              normalize(row.direction);

            return (
              [
                "cash adjustment",
                "cash adjustment +",
              ].includes(type) &&
              direction === "in"
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalCashAdjustmentDebit =
        transfers
          .filter((row: any) => {
            const type =
              normalize(row.type);

            const direction =
              normalize(row.direction);

            return (
              [
                "cash adjustment",
                "cash adjustment -",
              ].includes(type) &&
              direction === "out"
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =======================================================
         FINAL BANK POSITION
      ======================================================= */

      const currentBankBalance =
        Number(
          bankData.opening_balance || 0
        ) +
        totalBankIncome -
        totalBankExpense -
        totalBankToPettyCash +
        totalPettyCashToBank +
        totalBankAdjustmentCredit -
        totalBankAdjustmentDebit;

      /* =======================================================
         FINAL PETTY CASH POSITION
      ======================================================= */

      const currentPettyCashBalance =
        Number(
          pettyCashData.opening_balance || 0
        ) +
        totalCashIncome +
        totalBankToPettyCash -
        totalPettyCashExpense -
        totalPettyCashToBank +
        totalCashAdjustmentCredit -
        totalCashAdjustmentDebit;

      /* =======================================================
         TOTAL GPCC FUNDS
      ======================================================= */

      const totalAvailableFunds =
        currentBankBalance +
        currentPettyCashBalance;

      /* =======================================================
         UPDATE STATE
      ======================================================= */

      setS({
        income: totalIncome,
        expense: totalExpense,
        tds: totalTds,

        bankIncome: totalBankIncome,
        cashIncome: totalCashIncome,

        bankExpense: totalBankExpense,
        pettyCashExpense:
          totalPettyCashExpense,

        bankToPettyCash:
          totalBankToPettyCash,

        pettyCashToBank:
          totalPettyCashToBank,

        bankAdjustmentCredit:
          totalBankAdjustmentCredit,

        bankAdjustmentDebit:
          totalBankAdjustmentDebit,

        cashAdjustmentCredit:
          totalCashAdjustmentCredit,

        cashAdjustmentDebit:
          totalCashAdjustmentDebit,

        bank: currentBankBalance,

        pettyCash:
          currentPettyCashBalance,

        totalFunds:
          totalAvailableFunds,
      });
    } catch (error: any) {
      console.error(error);

      setMsg(
        error?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* =========================================================
     SAVE BANK OPENING BALANCE
  ========================================================= */

  const saveBankOpeningBalance =
    async () => {
      if (
        !bankSetupForm.account_name.trim() ||
        bankSetupForm.opening_balance === ""
      ) {
        setMsg(
          "Please enter the bank account name and opening balance."
        );

        return;
      }

      const openingBalance = Number(
        bankSetupForm.opening_balance
      );

      if (
        Number.isNaN(openingBalance) ||
        openingBalance < 0
      ) {
        setMsg(
          "Please enter a valid bank opening balance."
        );

        return;
      }

      setMsg("");

      const { error } = await supabase
        .from("bank_accounts")
        .insert({
          account_name:
            bankSetupForm.account_name.trim(),

          opening_balance:
            openingBalance,

          opening_balance_date:
            bankSetupForm.opening_balance_date,

          is_active: true,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      await loadDashboard();
    };

  /* =========================================================
     SAVE PETTY CASH OPENING BALANCE
  ========================================================= */

  const savePettyCashOpeningBalance =
    async () => {
      if (
        !pettyCashSetupForm.account_name.trim() ||
        pettyCashSetupForm.opening_balance === ""
      ) {
        setMsg(
          "Please enter the petty cash account name and opening balance."
        );

        return;
      }

      const openingBalance = Number(
        pettyCashSetupForm.opening_balance
      );

      if (
        Number.isNaN(openingBalance) ||
        openingBalance < 0
      ) {
        setMsg(
          "Please enter a valid petty cash opening balance."
        );

        return;
      }

      setMsg("");

      const { error } = await supabase
        .from("petty_cash_accounts")
        .insert({
          account_name:
            pettyCashSetupForm.account_name.trim(),

          opening_balance:
            openingBalance,

          opening_balance_date:
            pettyCashSetupForm.opening_balance_date,

          is_active: true,
        });

      if (error) {
        setMsg(error.message);
        return;
      }

      await loadDashboard();
    };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading GPCC Financial Dashboard...
        </h2>
      </div>
    );
  }

  /* =========================================================
     INITIAL SETUP
  ========================================================= */

  if (!bankAccount || !pettyCashAccount) {
    return (
      <div>
        <div className="pageHead">
          <div>
            <h1>
              Initial Financial Setup
            </h1>

            <p className="muted">
              Configure the GPCC Bank Account and
              Petty Cash opening balances.
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

        {!bankAccount && (
          <div
            className="card"
            style={{
              marginBottom: 20,
            }}
          >
            <h2>
              Set Opening Bank Balance
            </h2>

            <div className="formGrid">
              <label>
                Bank Account Name

                <input
                  className="input"
                  value={
                    bankSetupForm.account_name
                  }
                  onChange={(e) =>
                    setBankSetupForm({
                      ...bankSetupForm,
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
                    bankSetupForm.opening_balance
                  }
                  onChange={(e) =>
                    setBankSetupForm({
                      ...bankSetupForm,
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
                    bankSetupForm.opening_balance_date
                  }
                  onChange={(e) =>
                    setBankSetupForm({
                      ...bankSetupForm,
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
                  saveBankOpeningBalance
                }
              >
                Save Opening Bank Balance
              </button>
            </div>
          </div>
        )}

        {!pettyCashAccount && (
          <div className="card">
            <h2>
              Set Opening Petty Cash Balance
            </h2>

            <div className="formGrid">
              <label>
                Petty Cash Account Name

                <input
                  className="input"
                  value={
                    pettyCashSetupForm.account_name
                  }
                  onChange={(e) =>
                    setPettyCashSetupForm({
                      ...pettyCashSetupForm,
                      account_name:
                        e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Opening Petty Cash Balance

                <input
                  className="input"
                  type="number"
                  min="0"
                  value={
                    pettyCashSetupForm.opening_balance
                  }
                  onChange={(e) =>
                    setPettyCashSetupForm({
                      ...pettyCashSetupForm,
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
                    pettyCashSetupForm.opening_balance_date
                  }
                  onChange={(e) =>
                    setPettyCashSetupForm({
                      ...pettyCashSetupForm,
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
                  savePettyCashOpeningBalance
                }
              >
                Save Opening Petty Cash Balance
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* =========================================================
     MAIN DASHBOARD
  ========================================================= */

  return (
    <>
      <div className="pageHead">
        <div>
          <h1>
            Financial Dashboard
          </h1>

          <p className="muted">
            GPCC Financial Control Centre
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={loadDashboard}
        >
          Refresh
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

      {/* TOP SUMMARY */}

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
            Total Available Funds
          </div>

          <div className="metric">
            {money(s.totalFunds)}
          </div>
        </div>
      </div>

      {/* RECONCILIATION */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        {/* BANK */}

        <div className="card">
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
                    + Cleared Bank Income
                  </td>

                  <td>
                    {money(s.bankIncome)}
                  </td>
                </tr>

                <tr>
                  <td>
                    - Paid Bank Expenses
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
                      s.bankAdjustmentCredit
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    - Bank Adjustment Debit
                  </td>

                  <td>
                    {money(
                      s.bankAdjustmentDebit
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

        {/* PETTY CASH */}

        <div className="card">
          <h3>
            Petty Cash Reconciliation
          </h3>

          <div className="tableWrap">
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    Opening Petty Cash
                  </td>

                  <td>
                    {money(
                      pettyCashAccount.opening_balance
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    + Cleared Cash Income
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
                    - Paid Petty Cash Expenses
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
                  <td>
                    + Cash Adjustment Credit
                  </td>

                  <td>
                    {money(
                      s.cashAdjustmentCredit
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    - Cash Adjustment Debit
                  </td>

                  <td>
                    {money(
                      s.cashAdjustmentDebit
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
      </div>

      {/* GPCC FINANCIAL POSITION */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          GPCC Financial Position
        </h3>

        <div className="tableWrap">
          <table className="table">
            <tbody>
              <tr>
                <td>
                  Current Bank Position
                </td>

                <td>
                  {money(s.bank)}
                </td>
              </tr>

              <tr>
                <td>
                  Current Petty Cash
                </td>

                <td>
                  {money(s.pettyCash)}
                </td>
              </tr>

              <tr>
                <th>
                  Total Available GPCC Funds
                </th>

                <th>
                  {money(s.totalFunds)}
                </th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTROL CENTRE */}

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
          Financial positions are calculated from
          cleared income, paid expenses, valid
          fund transfers, and account-specific
          adjustments.
        </p>

        <p className="muted">
          Internal transfers between Bank and
          Petty Cash do not change Total Available
          GPCC Funds. They only move funds between
          the two accounts.
        </p>

        <p className="muted">
          Current Bank Position + Current Petty
          Cash = Total Available GPCC Funds.
        </p>
      </div>
    </>
  );
}