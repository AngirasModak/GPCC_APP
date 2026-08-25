"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type NotificationItem = {
  id: string;
  level: "critical" | "warning" | "success" | "info";
  title: string;
  message: string;
};

type TrendPoint = {
  month: string;
  income: number;
  expense: number;
  surplus: number;
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

const compactMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

const normalize = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const getDate = (row: any) =>
  row.date ||
  row.transaction_date ||
  row.payment_date ||
  row.created_at ||
  null;

const getMonthKey = (dateValue: any) => {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const formatMonth = (key: string) => {
  const [year, month] = key.split("-");

  return new Date(
    Number(year),
    Number(month) - 1,
    1
  ).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const getNetPayment = (row: any) => {
  if (
    row.net_amount !== null &&
    row.net_amount !== undefined
  ) {
    return Number(row.net_amount || 0);
  }

  const gross = Number(row.gross_amount || 0);

  const tds =
    row.tds_amount !== null &&
    row.tds_amount !== undefined
      ? Number(row.tds_amount || 0)
      : gross *
        (Number(row.tds_rate || 0) / 100);

  return gross - tds;
};

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

  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  const [s, setS] =
    useState<DashboardSummary>(initialSummary);

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

  /* =========================================================
     LOAD DASHBOARD
  ========================================================= */

  const loadDashboard = async () => {
    setLoading(true);
    setMsg("");

    try {
      const [
        bankResponse,
        pettyCashResponse,
        incomeResponse,
        expenseResponse,
        transferResponse,
      ] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select("*")
          .eq("is_active", true)
          .maybeSingle(),

        supabase
          .from("petty_cash_accounts")
          .select("*")
          .eq("is_active", true)
          .maybeSingle(),

        supabase
          .from("income")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "Cleared"),

        supabase
          .from("expenses")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "Paid"),

        supabase
          .from("fund_transfers")
          .select("*")
          .is("deleted_at", null),
      ]);

      if (bankResponse.error) {
        throw new Error(bankResponse.error.message);
      }

      if (pettyCashResponse.error) {
        throw new Error(
          pettyCashResponse.error.message
        );
      }

      if (incomeResponse.error) {
        throw new Error(
          incomeResponse.error.message
        );
      }

      if (expenseResponse.error) {
        throw new Error(
          expenseResponse.error.message
        );
      }

      if (transferResponse.error) {
        throw new Error(
          transferResponse.error.message
        );
      }

      const bankData =
        bankResponse.data as BankAccount | null;

      const pettyCashData =
        pettyCashResponse.data as PettyCashAccount | null;

      const incomeRows =
        incomeResponse.data || [];

      const expenseRows =
        expenseResponse.data || [];

      const transferRows =
        transferResponse.data || [];

      setBankAccount(bankData);
      setPettyCashAccount(pettyCashData);

      setIncomes(incomeRows);
      setExpenses(expenseRows);
      setTransfers(transferRows);

      if (!bankData || !pettyCashData) {
        setS(initialSummary);
        return;
      }

      /* =====================================================
         INCOME CALCULATION
      ===================================================== */

      const totalIncome = incomeRows.reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

      const totalCashIncome = incomeRows
        .filter(
          (row) =>
            normalize(row.mode) === "cash"
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

      const totalBankIncome =
        incomeRows
          .filter(
            (row) =>
              normalize(row.mode) !== "cash"
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =====================================================
         EXPENSE CALCULATION
      ===================================================== */

      const totalExpense =
        expenseRows.reduce(
          (sum, row) =>
            sum +
            Number(row.gross_amount || 0),
          0
        );

      const totalTds =
        expenseRows.reduce(
          (sum, row) => {
            const gross = Number(
              row.gross_amount || 0
            );

            const tds =
              row.tds_amount !== null &&
              row.tds_amount !== undefined
                ? Number(
                    row.tds_amount || 0
                  )
                : gross *
                  (Number(
                    row.tds_rate || 0
                  ) /
                    100);

            return sum + tds;
          },
          0
        );

      const totalPettyCashExpense =
        expenseRows
          .filter(
            (row) =>
              normalize(
                row.payment_mode
              ) === "petty cash"
          )
          .reduce(
            (sum, row) =>
              sum + getNetPayment(row),
            0
          );

      const totalBankExpense =
        expenseRows
          .filter(
            (row) =>
              normalize(
                row.payment_mode
              ) !== "petty cash"
          )
          .reduce(
            (sum, row) =>
              sum + getNetPayment(row),
            0
          );

      /* =====================================================
         FUND TRANSFERS
      ===================================================== */

      const totalBankToPettyCash =
        transferRows
          .filter((row) =>
            [
              "bank withdrawal",
              "withdrawal",
            ].includes(
              normalize(row.type)
            )
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalPettyCashToBank =
        transferRows
          .filter((row) =>
            [
              "petty cash to bank",
              "cash deposit",
              "deposit",
              "petty cash deposit",
              "return to bank",
            ].includes(
              normalize(row.type)
            )
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =====================================================
         ADJUSTMENTS
      ===================================================== */

      const totalBankAdjustmentCredit =
        transferRows
          .filter(
            (row) =>
              normalize(row.type) ===
                "bank adjustment" &&
              normalize(row.direction) ===
                "in"
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalBankAdjustmentDebit =
        transferRows
          .filter(
            (row) =>
              normalize(row.type) ===
                "bank adjustment" &&
              normalize(row.direction) ===
                "out"
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalCashAdjustmentCredit =
        transferRows
          .filter(
            (row) =>
              [
                "cash adjustment",
                "cash adjustment +",
              ].includes(
                normalize(row.type)
              ) &&
              normalize(row.direction) ===
                "in"
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const totalCashAdjustmentDebit =
        transferRows
          .filter(
            (row) =>
              [
                "cash adjustment",
                "cash adjustment -",
              ].includes(
                normalize(row.type)
              ) &&
              normalize(row.direction) ===
                "out"
          )
          .reduce(
            (sum, row) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /* =====================================================
         FINAL POSITIONS
      ===================================================== */

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

      const totalAvailableFunds =
        currentBankBalance +
        currentPettyCashBalance;

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
     ANALYTICS ENGINE
  ========================================================= */

  const analytics = useMemo(() => {
    const monthly: Record<
      string,
      TrendPoint
    > = {};

    incomes.forEach((row) => {
      const key = getMonthKey(
        getDate(row)
      );

      if (!key) return;

      if (!monthly[key]) {
        monthly[key] = {
          month: formatMonth(key),
          income: 0,
          expense: 0,
          surplus: 0,
        };
      }

      monthly[key].income += Number(
        row.amount || 0
      );
    });

    expenses.forEach((row) => {
      const key = getMonthKey(
        getDate(row)
      );

      if (!key) return;

      if (!monthly[key]) {
        monthly[key] = {
          month: formatMonth(key),
          income: 0,
          expense: 0,
          surplus: 0,
        };
      }

      monthly[key].expense += Number(
        row.gross_amount || 0
      );
    });

    const trendData = Object.entries(
      monthly
    )
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([, value]) => ({
        ...value,
        surplus:
          value.income -
          value.expense,
      }));

    /* EXPENSE CATEGORIES */

    const categoryMap: Record<
      string,
      number
    > = {};

    expenses.forEach((row) => {
      const category =
        row.category ||
        row.expense_category ||
        "Uncategorized";

      categoryMap[category] =
        (categoryMap[category] || 0) +
        Number(row.gross_amount || 0);
    });

    const expenseCategories =
      Object.entries(categoryMap)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        )
        .slice(0, 8);

    /* LARGEST EXPENSES */

    const largestExpenses =
      [...expenses]
        .sort(
          (a, b) =>
            Number(
              b.gross_amount || 0
            ) -
            Number(
              a.gross_amount || 0
            )
        )
        .slice(0, 5);

    return {
      trendData,
      expenseCategories,
      largestExpenses,
    };
  }, [incomes, expenses]);

  /* =========================================================
     HEALTH SCORE
  ========================================================= */

  const financialHealth = useMemo(() => {
    let score = 100;

    const surplus =
      s.income - s.expense;

    if (surplus < 0) score -= 30;

    if (s.totalFunds < 0) score -= 40;

    if (
      s.totalFunds > 0 &&
      s.pettyCash > s.totalFunds * 0.5
    ) {
      score -= 10;
    }

    if (
      s.expense > s.income &&
      s.income > 0
    ) {
      score -= 15;
    }

    score = Math.max(
      0,
      Math.min(100, score)
    );

    let status = "Excellent";

    if (score < 40) {
      status = "Critical";
    } else if (score < 60) {
      status = "Needs Attention";
    } else if (score < 80) {
      status = "Healthy";
    }

    return {
      score,
      status,
      surplus,
    };
  }, [s]);

  /* =========================================================
     PREDICTIVE ANALYSIS
  ========================================================= */

  const prediction = useMemo(() => {
    const months =
      analytics.trendData.length;

    if (!months) {
      return {
        avgIncome: 0,
        avgExpense: 0,
        projectedSurplus: 0,
      };
    }

    const avgIncome =
      analytics.trendData.reduce(
        (sum, row) =>
          sum + row.income,
        0
      ) / months;

    const avgExpense =
      analytics.trendData.reduce(
        (sum, row) =>
          sum + row.expense,
        0
      ) / months;

    return {
      avgIncome,
      avgExpense,
      projectedSurplus:
        avgIncome - avgExpense,
    };
  }, [analytics]);

  /* =========================================================
     NOTIFICATIONS
  ========================================================= */

  const notifications =
    useMemo<NotificationItem[]>(() => {
      const list: NotificationItem[] =
        [];

      const surplus =
        s.income - s.expense;

      if (s.totalFunds < 0) {
        list.push({
          id: "negative-funds",
          level: "critical",
          title:
            "Negative Fund Position",
          message:
            "Total available funds are negative and require immediate attention.",
        });
      }

      if (surplus < 0) {
        list.push({
          id: "expense-alert",
          level: "critical",
          title:
            "Expenses Exceed Income",
          message: `Current deficit is ${money(
            Math.abs(surplus)
          )}.`,
        });
      }

      if (
        s.totalFunds > 0 &&
        s.pettyCash >
          s.totalFunds * 0.4
      ) {
        list.push({
          id: "cash-concentration",
          level: "warning",
          title:
            "High Petty Cash Concentration",
          message:
            "A significant proportion of GPCC funds are currently held as petty cash.",
        });
      }

      if (
        s.bank < 0 ||
        s.pettyCash < 0
      ) {
        list.push({
          id: "negative-account",
          level: "critical",
          title:
            "Negative Account Balance",
          message:
            "One or more financial positions have fallen below zero.",
        });
      }

      if (
        prediction.projectedSurplus < 0
      ) {
        list.push({
          id: "forecast-risk",
          level: "warning",
          title:
            "Projected Financial Deficit",
          message:
            "Current historical run-rate indicates a possible negative monthly surplus.",
        });
      }

      if (!list.length) {
        list.push({
          id: "healthy",
          level: "success",
          title:
            "Financial Position Stable",
          message:
            "No immediate financial control exception has been detected.",
        });
      }

      return list;
    }, [s, prediction]);

  /* =========================================================
     PRESCRIPTIVE RECOMMENDATIONS
  ========================================================= */

  const recommendations =
    useMemo(() => {
      const actions: string[] = [];

      if (s.expense > s.income) {
        actions.push(
          "Review discretionary expenses and introduce approval controls for high-value spending."
        );
      }

      if (
        s.totalFunds > 0 &&
        s.pettyCash >
          s.totalFunds * 0.4
      ) {
        actions.push(
          "Consider transferring excess petty cash back to the bank to improve financial control."
        );
      }

      if (
        prediction.projectedSurplus < 0
      ) {
        actions.push(
          "Prepare a cost-control plan because the current financial run-rate projects a monthly deficit."
        );
      }

      if (
        analytics.expenseCategories[0] &&
        s.expense > 0
      ) {
        const top =
          analytics.expenseCategories[0];

        const share =
          (top.value / s.expense) * 100;

        if (share > 35) {
          actions.push(
            `${top.name} represents approximately ${share.toFixed(
              0
            )}% of total expenses. Review this category for optimisation opportunities.`
          );
        }
      }

      if (!actions.length) {
        actions.push(
          "Maintain the current financial discipline and continue periodic reconciliation of Bank and Petty Cash."
        );

        actions.push(
          "Use monthly trend analysis to detect changes in income and expenditure patterns early."
        );
      }

      return actions;
    }, [
      s,
      prediction,
      analytics.expenseCategories,
    ]);

  /* =========================================================
     SAVE OPENING BALANCES
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
          Loading Financial Intelligence Centre...
        </h2>

        <p className="muted">
          Calculating financial position and
          generating analytics...
        </p>
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
              marginBottom: 20,
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
     CHART DATA
  ========================================================= */

  const fundDistribution = [
    {
      name: "Bank",
      value: Math.max(0, s.bank),
    },
    {
      name: "Petty Cash",
      value: Math.max(
        0,
        s.pettyCash
      ),
    },
  ];

  const cashFlowData = [
    {
      name: "Bank Income",
      value: s.bankIncome,
    },
    {
      name: "Bank Expense",
      value: s.bankExpense,
    },
    {
      name: "Cash Income",
      value: s.cashIncome,
    },
    {
      name: "Cash Expense",
      value: s.pettyCashExpense,
    },
  ];

  /* =========================================================
     MAIN DASHBOARD
  ========================================================= */

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        paddingBottom: 30,
      }}
    >
      {/* HEADER */}

      <div className="pageHead">
        <div>
          <h1>
            Financial Intelligence Centre
          </h1>

          <p className="muted">
            GPCC • Financial Performance,
            Intelligence & Control
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={loadDashboard}
        >
          ↻ Refresh Intelligence
        </button>
      </div>

      {msg && (
        <div
          className="card"
          style={{
            color: "#b42318",
          }}
        >
          {msg}
        </div>
      )}

      {/* =====================================================
         EXECUTIVE SUMMARY
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 18,
        }}
      >
        <div className="card">
          <div className="muted">
            Total Available Funds
          </div>

          <div className="metric">
            {money(s.totalFunds)}
          </div>

          <small className="muted">
            Overall GPCC liquidity
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Current Bank Position
          </div>

          <div className="metric">
            {money(s.bank)}
          </div>

          <small className="muted">
            Primary controlled funds
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Current Petty Cash
          </div>

          <div className="metric">
            {money(s.pettyCash)}
          </div>

          <small className="muted">
            Operational cash available
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Total Income
          </div>

          <div className="metric">
            {money(s.income)}
          </div>

          <small className="muted">
            Cleared income
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Total Expense
          </div>

          <div className="metric">
            {money(s.expense)}
          </div>

          <small className="muted">
            Paid expenditure
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Net Surplus
          </div>

          <div className="metric">
            {money(
              s.income - s.expense
            )}
          </div>

          <small className="muted">
            Income minus expenditure
          </small>
        </div>
      </div>

      {/* =====================================================
         FINANCIAL HEALTH + ALERTS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(300px, 0.8fr) minmax(400px, 1.2fr)",
          gap: 24,
        }}
      >
        <div className="card">
          <h3>
            Financial Health Index
          </h3>

          <div
            style={{
              height: 280,
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "Health",
                      value:
                        financialHealth.score,
                    },
                    {
                      name: "Remaining",
                      value:
                        100 -
                        financialHealth.score,
                    },
                  ]}
                  dataKey="value"
                  innerRadius={75}
                  outerRadius={105}
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell />
                  <Cell />
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: -165,
              paddingBottom: 105,
            }}
          >
            <div
              style={{
                fontSize: 38,
                fontWeight: 800,
              }}
            >
              {financialHealth.score}
            </div>

            <div className="muted">
              {financialHealth.status}
            </div>
          </div>

          <p className="muted">
            Health score evaluates fund
            availability, surplus position,
            account balance risk and cash
            concentration.
          </p>
        </div>

        <div className="card">
          <h3>
            Smart Financial Notifications
          </h3>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 18,
            }}
          >
            {notifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border:
                      "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <strong>
                    {notification.level ===
                      "critical" && "🔴 "}
                    {notification.level ===
                      "warning" && "🟡 "}
                    {notification.level ===
                      "success" && "🟢 "}
                    {notification.level ===
                      "info" && "🔵 "}

                    {notification.title}
                  </strong>

                  <div
                    className="muted"
                    style={{
                      marginTop: 6,
                    }}
                  >
                    {notification.message}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
         TREND + FUND DISTRIBUTION
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.6fr) minmax(320px, 0.8fr)",
          gap: 24,
        }}
      >
        <div className="card">
          <h3>
            Income vs Expense Trend
          </h3>

          <p className="muted">
            Historical financial movement based
            on recorded transactions.
          </p>

          <div
            style={{
              height: 380,
              marginTop: 20,
            }}
          >
            <ResponsiveContainer>
              <AreaChart
                data={
                  analytics.trendData
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="month"
                />

                <YAxis />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value)
                    )
                  }
                />

                <Legend />

                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  fillOpacity={0.25}
                />

                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expense"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>
            Fund Distribution
          </h3>

          <p className="muted">
            Current allocation of GPCC funds.
          </p>

          <div
            style={{
              height: 300,
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={
                    fundDistribution
                  }
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value)
                    )
                  }
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 10,
            }}
          >
            <strong>
              {money(s.totalFunds)}
            </strong>

            <div className="muted">
              Total GPCC Funds
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
         EXPENSE INTELLIGENCE
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
          gap: 24,
        }}
      >
        <div className="card">
          <h3>
            Expense Intelligence
          </h3>

          <p className="muted">
            Highest spending categories.
          </p>

          <div
            style={{
              height: 380,
              marginTop: 20,
            }}
          >
            <ResponsiveContainer>
              <BarChart
                data={
                  analytics.expenseCategories
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="name"
                />

                <YAxis />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value)
                    )
                  }
                />

                <Bar
                  dataKey="value"
                  name="Expense"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3>
            Top Expense Drivers
          </h3>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              marginTop: 20,
            }}
          >
            {analytics.largestExpenses
              .length === 0 && (
              <p className="muted">
                No expense data available.
              </p>
            )}

            {analytics.largestExpenses.map(
              (row, index) => (
                <div
                  key={
                    row.id || index
                  }
                  style={{
                    paddingBottom: 14,
                    borderBottom:
                      "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      gap: 10,
                    }}
                  >
                    <strong>
                      {row.category ||
                        row.expense_category ||
                        row.vendor ||
                        "Expense"}
                    </strong>

                    <strong>
                      {money(
                        Number(
                          row.gross_amount ||
                            0
                        )
                      )}
                    </strong>
                  </div>

                  <div className="muted">
                    {row.vendor ||
                      row.description ||
                      "Recorded expense"}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
         CASH FLOW
      ===================================================== */}

      <div className="card">
        <h3>
          Financial Flow Analysis
        </h3>

        <p className="muted">
          Comparison of income and expenditure
          across Bank and Petty Cash.
        </p>

        <div
          style={{
            height: 380,
            marginTop: 20,
          }}
        >
          <ResponsiveContainer>
            <BarChart
              data={cashFlowData}
            >
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip
                formatter={(value) =>
                  money(
                    Number(value)
                  )
                }
              />

              <Bar
                dataKey="value"
                name="Amount"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =====================================================
         FOUR LAYERS OF ANALYTICS
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        <div className="card">
          <h3>
            📊 Descriptive
          </h3>

          <p className="muted">
            What has happened?
          </p>

          <ul
            style={{
              paddingLeft: 20,
              lineHeight: 1.9,
            }}
          >
            <li>
              Total Income:{" "}
              {money(s.income)}
            </li>

            <li>
              Total Expense:{" "}
              {money(s.expense)}
            </li>

            <li>
              TDS Recorded:{" "}
              {money(s.tds)}
            </li>

            <li>
              Net Surplus:{" "}
              {money(
                s.income -
                  s.expense
              )}
            </li>
          </ul>
        </div>

        <div className="card">
          <h3>
            🔎 Diagnostic
          </h3>

          <p className="muted">
            Why is it happening?
          </p>

          <ul
            style={{
              paddingLeft: 20,
              lineHeight: 1.9,
            }}
          >
            <li>
              Bank Expense:{" "}
              {money(
                s.bankExpense
              )}
            </li>

            <li>
              Petty Cash Expense:{" "}
              {money(
                s.pettyCashExpense
              )}
            </li>

            <li>
              Largest expense categories are
              highlighted in Expense
              Intelligence.
            </li>
          </ul>
        </div>

        <div className="card">
          <h3>
            🔮 Predictive
          </h3>

          <p className="muted">
            What may happen next?
          </p>

          <ul
            style={{
              paddingLeft: 20,
              lineHeight: 1.9,
            }}
          >
            <li>
              Avg Income Run-rate:{" "}
              {money(
                prediction.avgIncome
              )}
            </li>

            <li>
              Avg Expense Run-rate:{" "}
              {money(
                prediction.avgExpense
              )}
            </li>

            <li>
              Projected Surplus:{" "}
              {money(
                prediction.projectedSurplus
              )}
            </li>
          </ul>
        </div>

        <div className="card">
          <h3>
            💡 Prescriptive
          </h3>

          <p className="muted">
            What should GPCC do?
          </p>

          <ul
            style={{
              paddingLeft: 20,
              lineHeight: 1.8,
            }}
          >
            {recommendations
              .slice(0, 3)
              .map(
                (
                  recommendation,
                  index
                ) => (
                  <li key={index}>
                    {recommendation}
                  </li>
                )
              )}
          </ul>
        </div>
      </div>

      {/* =====================================================
         PREDICTIVE TREND
      ===================================================== */}

      <div className="card">
        <h3>
          Surplus / Deficit Movement
        </h3>

        <p className="muted">
          Monthly financial performance
          trajectory.
        </p>

        <div
          style={{
            height: 350,
            marginTop: 20,
          }}
        >
          <ResponsiveContainer>
            <LineChart
              data={
                analytics.trendData
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="month"
              />

              <YAxis />

              <Tooltip
                formatter={(value) =>
                  money(
                    Number(value)
                  )
                }
              />

              <Line
                type="monotone"
                dataKey="surplus"
                name="Surplus / Deficit"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =====================================================
         RECONCILIATION
      ===================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(450px, 1fr))",
          gap: 24,
        }}
      >
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
                    {money(
                      s.bankIncome
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    - Paid Bank Expenses
                  </td>
                  <td>
                    {money(
                      s.bankExpense
                    )}
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
                    {money(
                      s.cashIncome
                    )}
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

      {/* =====================================================
         FINAL FINANCIAL POSITION
      ===================================================== */}

      <div className="card">
        <h3>
          GPCC Consolidated Financial Position
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

      {/* =====================================================
         FINANCIAL CONTROL NOTES
      ===================================================== */}

      <div className="card">
        <h3>
          Financial Intelligence & Control
        </h3>

        <p className="muted">
          The dashboard combines transactional
          financial data with descriptive,
          diagnostic, predictive and prescriptive
          analysis.
        </p>

        <p className="muted">
          Internal transfers between Bank and
          Petty Cash do not affect total GPCC
          funds. They only change the location
          of available funds.
        </p>

        <p className="muted">
          Current Bank Position + Current Petty
          Cash = Total Available GPCC Funds.
        </p>
      </div>
    </div>
  );
}