"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

/* ============================================================
   TYPES
============================================================ */

type IncomeRow = {
  id: string;
  amount?: number | null;
  mode?: string | null;
  status?: string | null;
  category?: string | null;
  income_category?: string | null;
  source?: string | null;
  income_date?: string | null;
  date?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

type ExpenseRow = {
  id: string;
  gross_amount?: number | null;
  net_amount?: number | null;
  tds_amount?: number | null;
  tds_rate?: number | null;
  payment_mode?: string | null;
  status?: string | null;
  category?: string | null;
  expense_category?: string | null;
  description?: string | null;
  vendor_name?: string | null;
  expense_date?: string | null;
  date?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

type TransferRow = {
  id: string;
  amount?: number | null;
  type?: string | null;
  direction?: string | null;
  transfer_date?: string | null;
  date?: string | null;
  transaction_date?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

type BankAccount = {
  id: string;
  account_name?: string | null;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
  is_active?: boolean | null;
};

type PettyCashAccount = {
  id: string;
  account_name?: string | null;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
  is_active?: boolean | null;
};

type MonthlyData = {
  month: string;
  shortMonth: string;
  income: number;
  expense: number;
  surplus: number;
};

type CategoryData = {
  name: string;
  value: number;
};

/* ============================================================
   CONSTANTS
============================================================ */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ============================================================
   HELPERS
============================================================ */

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const compactMoney = (n: number) => {
  const value = Number(n || 0);

  if (Math.abs(value) >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }

  if (Math.abs(value) >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }

  if (Math.abs(value) >= 1000) {
    return `₹${(value / 1000).toFixed(1)} K`;
  }

  return money(value);
};

const getNumber = (value: any) => Number(value || 0);

const normalise = (value: any) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getRowDate = (row: any) => {
  return (
    row.income_date ||
    row.expense_date ||
    row.transfer_date ||
    row.transaction_date ||
    row.date ||
    row.created_at ||
    null
  );
};

const getFinancialYearFromDate = (dateValue: string | null) => {
  if (!dateValue) return null;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }

  return `${year - 1}-${String(year).slice(-2)}`;
};

const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();

  if (now.getMonth() >= 3) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }

  return `${year - 1}-${String(year).slice(-2)}`;
};

const getFinancialYearRange = (financialYear: string) => {
  const startYear = Number(financialYear.split("-")[0]);

  const start = new Date(startYear, 3, 1);
  const end = new Date(startYear + 1, 2, 31, 23, 59, 59);

  return {
    start,
    end,
  };
};

const isWithinFinancialYear = (
  row: any,
  financialYear: string
) => {
  const dateValue = getRowDate(row);

  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const { start, end } =
    getFinancialYearRange(financialYear);

  return date >= start && date <= end;
};

const getNetPayment = (row: ExpenseRow) => {
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

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [msg, setMsg] = useState("");

  const [financialYear, setFinancialYear] =
    useState(getCurrentFinancialYear());

  const [incomeRows, setIncomeRows] = useState<
    IncomeRow[]
  >([]);

  const [expenseRows, setExpenseRows] = useState<
    ExpenseRow[]
  >([]);

  const [transferRows, setTransferRows] = useState<
    TransferRow[]
  >([]);

  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [pettyCashAccount, setPettyCashAccount] =
    useState<PettyCashAccount | null>(null);

  /* ============================================================
     LOAD DATA
  ============================================================ */

  const loadData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMsg("");

    try {
      const [
        incomeResponse,
        expenseResponse,
        transferResponse,
        bankResponse,
        pettyCashResponse,
      ] = await Promise.all([
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
      ]);

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

      if (bankResponse.error) {
        throw new Error(
          bankResponse.error.message
        );
      }

      if (pettyCashResponse.error) {
        throw new Error(
          pettyCashResponse.error.message
        );
      }

      setIncomeRows(
        (incomeResponse.data || []) as IncomeRow[]
      );

      setExpenseRows(
        (expenseResponse.data || []) as ExpenseRow[]
      );

      setTransferRows(
        (transferResponse.data || []) as TransferRow[]
      );

      setBankAccount(
        bankResponse.data as BankAccount | null
      );

      setPettyCashAccount(
        pettyCashResponse.data as
          | PettyCashAccount
          | null
      );
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load Reports & Analytics."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ============================================================
     AVAILABLE FINANCIAL YEARS
  ============================================================ */

  const financialYears = useMemo(() => {
    const years = new Set<string>();

    incomeRows.forEach((row) => {
      const fy = getFinancialYearFromDate(
        getRowDate(row)
      );

      if (fy) years.add(fy);
    });

    expenseRows.forEach((row) => {
      const fy = getFinancialYearFromDate(
        getRowDate(row)
      );

      if (fy) years.add(fy);
    });

    const currentFY = getCurrentFinancialYear();

    years.add(currentFY);

    return Array.from(years).sort((a, b) =>
      b.localeCompare(a)
    );
  }, [incomeRows, expenseRows]);

  /* ============================================================
     FILTER DATA BY FINANCIAL YEAR
  ============================================================ */

  const filteredIncome = useMemo(() => {
    return incomeRows.filter((row) =>
      isWithinFinancialYear(row, financialYear)
    );
  }, [incomeRows, financialYear]);

  const filteredExpenses = useMemo(() => {
    return expenseRows.filter((row) =>
      isWithinFinancialYear(row, financialYear)
    );
  }, [expenseRows, financialYear]);

  /* ============================================================
     CORE FINANCIAL CALCULATIONS
  ============================================================ */

  const analytics = useMemo(() => {
    const totalIncome = filteredIncome.reduce(
      (sum, row) =>
        sum + getNumber(row.amount),
      0
    );

    const totalExpense = filteredExpenses.reduce(
      (sum, row) =>
        sum + getNumber(row.gross_amount),
      0
    );

    const totalTds = filteredExpenses.reduce(
      (sum, row) => {
        if (
          row.tds_amount !== null &&
          row.tds_amount !== undefined
        ) {
          return (
            sum +
            Number(row.tds_amount || 0)
          );
        }

        return (
          sum +
          Number(row.gross_amount || 0) *
            (Number(row.tds_rate || 0) / 100)
        );
      },
      0
    );

    const totalActualOutflow =
      filteredExpenses.reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const surplus =
      totalIncome - totalExpense;

    const bankIncome = filteredIncome
      .filter((row) => {
        const mode = normalise(row.mode);

        return [
          "cheque",
          "online",
          "bank transfer",
          "upi",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + getNumber(row.amount),
        0
      );

    const cashIncome = filteredIncome
      .filter(
        (row) =>
          normalise(row.mode) === "cash"
      )
      .reduce(
        (sum, row) =>
          sum + getNumber(row.amount),
        0
      );

    const bankExpense = filteredExpenses
      .filter((row) => {
        const mode = normalise(
          row.payment_mode
        );

        return [
          "bank transfer",
          "cheque",
          "online",
          "upi",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const pettyCashExpense =
      filteredExpenses
        .filter(
          (row) =>
            normalise(
              row.payment_mode
            ) === "petty cash"
        )
        .reduce(
          (sum, row) =>
            sum + getNetPayment(row),
          0
        );

    return {
      totalIncome,
      totalExpense,
      totalTds,
      totalActualOutflow,
      surplus,

      bankIncome,
      cashIncome,

      bankExpense,
      pettyCashExpense,
    };
  }, [filteredIncome, filteredExpenses]);

  /* ============================================================
     CURRENT FUND POSITION
     
     Uses all historical transactions because current
     bank/petty-cash balances should not reset when the
     analytics financial-year filter changes.
  ============================================================ */

  const fundPosition = useMemo(() => {
    const allBankIncome = incomeRows
      .filter((row) => {
        const mode = normalise(row.mode);

        return [
          "cheque",
          "online",
          "bank transfer",
          "upi",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + getNumber(row.amount),
        0
      );

    const allCashIncome = incomeRows
      .filter(
        (row) =>
          normalise(row.mode) === "cash"
      )
      .reduce(
        (sum, row) =>
          sum + getNumber(row.amount),
        0
      );

    const allBankExpense = expenseRows
      .filter((row) => {
        const mode = normalise(
          row.payment_mode
        );

        return [
          "bank transfer",
          "cheque",
          "online",
          "upi",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const allPettyCashExpense =
      expenseRows
        .filter(
          (row) =>
            normalise(
              row.payment_mode
            ) === "petty cash"
        )
        .reduce(
          (sum, row) =>
            sum + getNetPayment(row),
          0
        );

    const bankToPettyCash =
      transferRows
        .filter((row) => {
          const type = String(
            row.type || ""
          ).trim();

          return (
            type === "Bank Withdrawal" ||
            type === "Withdrawal"
          );
        })
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const pettyCashToBank =
      transferRows
        .filter((row) => {
          const type = String(
            row.type || ""
          ).trim();

          return [
            "Petty Cash to Bank",
            "Cash Deposit",
            "Deposit",
            "Petty Cash Deposit",
            "Return to Bank",
          ].includes(type);
        })
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const bankAdjustmentCredit =
      transferRows
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "IN"
        )
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const bankAdjustmentDebit =
      transferRows
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "OUT"
        )
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const cashAdjustmentCredit =
      transferRows
        .filter((row) => {
          const type = String(
            row.type || ""
          ).trim();

          return (
            [
              "Cash Adjustment",
              "Cash Adjustment +",
            ].includes(type) &&
            row.direction === "IN"
          );
        })
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const cashAdjustmentDebit =
      transferRows
        .filter((row) => {
          const type = String(
            row.type || ""
          ).trim();

          return (
            [
              "Cash Adjustment",
              "Cash Adjustment -",
            ].includes(type) &&
            row.direction === "OUT"
          );
        })
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

    const bank =
      Number(
        bankAccount?.opening_balance || 0
      ) +
      allBankIncome -
      allBankExpense -
      bankToPettyCash +
      pettyCashToBank +
      bankAdjustmentCredit -
      bankAdjustmentDebit;

    const pettyCash =
      Number(
        pettyCashAccount?.opening_balance ||
          0
      ) +
      allCashIncome +
      bankToPettyCash -
      allPettyCashExpense -
      pettyCashToBank +
      cashAdjustmentCredit -
      cashAdjustmentDebit;

    return {
      bank,
      pettyCash,
      total: bank + pettyCash,
      bankToPettyCash,
      pettyCashToBank,
    };
  }, [
    incomeRows,
    expenseRows,
    transferRows,
    bankAccount,
    pettyCashAccount,
  ]);

  /* ============================================================
     MONTHLY TREND
     
     Financial year starts in April and ends in March.
  ============================================================ */

  const monthlyData = useMemo(() => {
    const startYear = Number(
      financialYear.split("-")[0]
    );

    const months: MonthlyData[] = [];

    for (let position = 0; position < 12; position++) {
      const calendarMonth =
        (position + 3) % 12;

      const calendarYear =
        calendarMonth >= 3
          ? startYear
          : startYear + 1;

      const income = filteredIncome
        .filter((row) => {
          const value = getRowDate(row);

          if (!value) return false;

          const date = new Date(value);

          return (
            date.getMonth() ===
              calendarMonth &&
            date.getFullYear() ===
              calendarYear
          );
        })
        .reduce(
          (sum, row) =>
            sum + getNumber(row.amount),
          0
        );

      const expense = filteredExpenses
        .filter((row) => {
          const value = getRowDate(row);

          if (!value) return false;

          const date = new Date(value);

          return (
            date.getMonth() ===
              calendarMonth &&
            date.getFullYear() ===
              calendarYear
          );
        })
        .reduce(
          (sum, row) =>
            sum +
            getNumber(row.gross_amount),
          0
        );

      months.push({
        month: MONTHS[calendarMonth],
        shortMonth:
          SHORT_MONTHS[calendarMonth],
        income,
        expense,
        surplus: income - expense,
      });
    }

    return months;
  }, [
    filteredIncome,
    filteredExpenses,
    financialYear,
  ]);

  /* ============================================================
     INCOME CATEGORY ANALYSIS
  ============================================================ */

  const incomeCategories = useMemo(() => {
    const map = new Map<string, number>();

    filteredIncome.forEach((row) => {
      const category =
        row.category ||
        row.income_category ||
        row.source ||
        "Uncategorised";

      map.set(
        category,
        (map.get(category) || 0) +
          getNumber(row.amount)
      );
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredIncome]);

  /* ============================================================
     EXPENSE CATEGORY ANALYSIS
  ============================================================ */

  const expenseCategories = useMemo(() => {
    const map = new Map<string, number>();

    filteredExpenses.forEach((row) => {
      const category =
        row.category ||
        row.expense_category ||
        "Uncategorised";

      map.set(
        category,
        (map.get(category) || 0) +
          getNumber(row.gross_amount)
      );
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredExpenses]);

  /* ============================================================
     TOP EXPENSES
  ============================================================ */

  const topExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort(
        (a, b) =>
          getNumber(b.gross_amount) -
          getNumber(a.gross_amount)
      )
      .slice(0, 5);
  }, [filteredExpenses]);

  /* ============================================================
     FINANCIAL HEALTH SCORE
  ============================================================ */

  const health = useMemo(() => {
    let score = 50;

    const income =
      analytics.totalIncome;

    const expense =
      analytics.totalExpense;

    const surplus =
      analytics.surplus;

    /* Positive surplus */

    if (income > 0 && surplus >= 0) {
      score += 15;
    } else if (surplus < 0) {
      score -= 15;
    }

    /* Expense ratio */

    if (income > 0) {
      const expenseRatio =
        expense / income;

      if (expenseRatio <= 0.7) {
        score += 15;
      } else if (expenseRatio <= 0.9) {
        score += 8;
      } else if (expenseRatio > 1) {
        score -= 10;
      }
    }

    /* Available funds */

    if (fundPosition.total > 0) {
      score += 10;
    }

    /* Bank liquidity */

    if (fundPosition.bank > 0) {
      score += 5;
    }

    /* Petty cash should not be negative */

    if (fundPosition.pettyCash >= 0) {
      score += 5;
    } else {
      score -= 10;
    }

    score = Math.max(
      0,
      Math.min(100, Math.round(score))
    );

    let label = "Critical";

    if (score >= 85) {
      label = "Excellent";
    } else if (score >= 70) {
      label = "Healthy";
    } else if (score >= 50) {
      label = "Needs Attention";
    }

    return {
      score,
      label,
    };
  }, [analytics, fundPosition]);

  /* ============================================================
     SMART INSIGHTS
  ============================================================ */

  const insights = useMemo(() => {
    const list: {
      icon: string;
      title: string;
      description: string;
    }[] = [];

    if (
      analytics.totalIncome === 0 &&
      analytics.totalExpense === 0
    ) {
      list.push({
        icon: "ℹ️",
        title: "No transactions found",
        description:
          "There are no cleared income or paid expense transactions for the selected financial year.",
      });

      return list;
    }

    if (analytics.surplus >= 0) {
      list.push({
        icon: "📈",
        title: "Positive financial position",
        description: `GPCC has generated a surplus of ${money(
          analytics.surplus
        )} for FY ${financialYear}.`,
      });
    } else {
      list.push({
        icon: "⚠️",
        title: "Expenditure exceeds income",
        description: `Expenses are higher than income by ${money(
          Math.abs(
            analytics.surplus
          )
        )}.`,
      });
    }

    if (expenseCategories.length > 0) {
      const top =
        expenseCategories[0];

      const percentage =
        analytics.totalExpense > 0
          ? (
              (top.value /
                analytics.totalExpense) *
              100
            ).toFixed(1)
          : "0";

      list.push({
        icon: "💸",
        title: "Largest expense concentration",
        description: `${top.name} represents ${percentage}% of total expenditure.`,
      });
    }

    if (
      fundPosition.bank >
      fundPosition.pettyCash
    ) {
      list.push({
        icon: "🏦",
        title: "Bank-dominant liquidity",
        description: `The majority of available GPCC funds are currently held in the bank account.`,
      });
    } else if (
      fundPosition.pettyCash > 0
    ) {
      list.push({
        icon: "💵",
        title: "Higher petty cash concentration",
        description:
          "Review whether the current petty cash level is aligned with GPCC operational requirements.",
      });
    }

    if (analytics.totalTds > 0) {
      list.push({
        icon: "🧾",
        title: "TDS monitoring required",
        description: `Total TDS recorded for this financial year is ${money(
          analytics.totalTds
        )}.`,
      });
    }

    return list.slice(0, 4);
  }, [
    analytics,
    expenseCategories,
    fundPosition,
    financialYear,
  ]);

  /* ============================================================
     CHART VALUES
  ============================================================ */

  const maxMonthlyValue =
    Math.max(
      ...monthlyData.flatMap((row) => [
        row.income,
        row.expense,
      ]),
      1
    );

  const bankShare =
    fundPosition.total !== 0
      ? Math.max(
          0,
          Math.min(
            100,
            (fundPosition.bank /
              fundPosition.total) *
              100
          )
        )
      : 0;

  const pettyCashShare =
    fundPosition.total !== 0
      ? Math.max(
          0,
          Math.min(
            100,
            (fundPosition.pettyCash /
              fundPosition.total) *
              100
          )
        )
      : 0;

  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Financial Intelligence...
        </h2>

        <p className="muted">
          Analysing GPCC financial data.
        </p>
      </div>
    );
  }

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <div>
      {/* ========================================================
          PAGE HEADER
      ========================================================= */}

      <div className="pageHead">
        <div>
          <h1>
            Reports & Analytics
          </h1>

          <p className="muted">
            GPCC Financial Intelligence Centre
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            className="input"
            value={financialYear}
            onChange={(e) =>
              setFinancialYear(
                e.target.value
              )
            }
            style={{
              minWidth: 130,
            }}
          >
            {financialYears.map((fy) => (
              <option
                key={fy}
                value={fy}
              >
                FY {fy}
              </option>
            ))}
          </select>

          <button
            className="btn secondary"
            onClick={() =>
              loadData(true)
            }
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
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

      {/* ========================================================
          EXECUTIVE KPI SECTION
      ========================================================= */}

      <div className="grid">
        <div className="card">
          <div className="muted">
            💰 Total Income
          </div>

          <div className="metric">
            {compactMoney(
              analytics.totalIncome
            )}
          </div>

          <div
            className="muted"
            style={{
              marginTop: 8,
              fontSize: 13,
            }}
          >
            FY {financialYear}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            💸 Total Expenditure
          </div>

          <div className="metric">
            {compactMoney(
              analytics.totalExpense
            )}
          </div>

          <div
            className="muted"
            style={{
              marginTop: 8,
              fontSize: 13,
            }}
          >
            Gross expenditure
          </div>
        </div>

        <div className="card">
          <div className="muted">
            📈 Net Surplus / Deficit
          </div>

          <div className="metric">
            {compactMoney(
              analytics.surplus
            )}
          </div>

          <div
            className="muted"
            style={{
              marginTop: 8,
              fontSize: 13,
            }}
          >
            {analytics.surplus >= 0
              ? "Positive financial position"
              : "Attention required"}
          </div>
        </div>

        <div className="card">
          <div className="muted">
            🏦 Total Available Funds
          </div>

          <div className="metric">
            {compactMoney(
              fundPosition.total
            )}
          </div>

          <div
            className="muted"
            style={{
              marginTop: 8,
              fontSize: 13,
            }}
          >
            Current bank + petty cash
          </div>
        </div>
      </div>

      {/* ========================================================
          FINANCIAL PERFORMANCE TREND
      ========================================================= */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <h3
              style={{
                marginBottom: 5,
              }}
            >
              📈 Financial Performance Trend
            </h3>

            <p className="muted">
              Monthly income versus
              expenditure
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 14,
              fontSize: 13,
            }}
          >
            <span>
              ● Income
            </span>

            <span>
              ● Expense
            </span>
          </div>
        </div>

        <div
          style={{
            overflowX: "auto",
          }}
        >
          <div
            style={{
              minWidth: 700,
              height: 310,
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              padding:
                "20px 10px 0 10px",
              borderBottom:
                "1px solid var(--border, #ddd)",
            }}
          >
            {monthlyData.map(
              (item) => {
                const incomeHeight =
                  (item.income /
                    maxMonthlyValue) *
                  220;

                const expenseHeight =
                  (item.expense /
                    maxMonthlyValue) *
                  220;

                return (
                  <div
                    key={item.month}
                    style={{
                      flex: 1,
                      minWidth: 45,
                      height: "100%",
                      display: "flex",
                      flexDirection:
                        "column",
                      justifyContent:
                        "flex-end",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 235,
                        display: "flex",
                        alignItems:
                          "flex-end",
                        justifyContent:
                          "center",
                        gap: 5,
                      }}
                    >
                      <div
                        title={`Income: ${money(
                          item.income
                        )}`}
                        style={{
                          width: 16,
                          minHeight:
                            item.income > 0
                              ? 4
                              : 0,
                          height:
                            incomeHeight,
                          background:
                            "var(--primary, #16a34a)",
                          borderRadius:
                            "5px 5px 0 0",
                        }}
                      />

                      <div
                        title={`Expense: ${money(
                          item.expense
                        )}`}
                        style={{
                          width: 16,
                          minHeight:
                            item.expense > 0
                              ? 4
                              : 0,
                          height:
                            expenseHeight,
                          background:
                            "var(--danger, #dc2626)",
                          borderRadius:
                            "5px 5px 0 0",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        textAlign:
                          "center",
                      }}
                    >
                      {item.shortMonth}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          CATEGORY INTELLIGENCE
      ========================================================= */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        {/* INCOME INTELLIGENCE */}

        <div className="card">
          <h3>
            💰 Income Intelligence
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 20,
            }}
          >
            Top income sources for FY{" "}
            {financialYear}
          </p>

          {incomeCategories.length === 0 ? (
            <p className="muted">
              No income data available.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 16,
              }}
            >
              {incomeCategories.map(
                (item) => {
                  const percentage =
                    analytics.totalIncome > 0
                      ? Math.max(
                          3,
                          (item.value /
                            analytics.totalIncome) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={item.name}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          marginBottom: 7,
                        }}
                      >
                        <span>
                          {item.name}
                        </span>

                        <strong>
                          {compactMoney(
                            item.value
                          )}
                        </strong>
                      </div>

                      <div
                        style={{
                          height: 8,
                          background:
                            "rgba(127,127,127,0.15)",
                          borderRadius: 99,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background:
                              "var(--primary, #16a34a)",
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* EXPENSE INTELLIGENCE */}

        <div className="card">
          <h3>
            💸 Expense Intelligence
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 20,
            }}
          >
            Where GPCC funds are being
            utilised
          </p>

          {expenseCategories.length === 0 ? (
            <p className="muted">
              No expenditure data
              available.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection:
                  "column",
                gap: 16,
              }}
            >
              {expenseCategories.map(
                (item) => {
                  const percentage =
                    analytics.totalExpense > 0
                      ? Math.max(
                          3,
                          (item.value /
                            analytics.totalExpense) *
                            100
                        )
                      : 0;

                  return (
                    <div
                      key={item.name}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          marginBottom: 7,
                        }}
                      >
                        <span>
                          {item.name}
                        </span>

                        <strong>
                          {compactMoney(
                            item.value
                          )}
                        </strong>
                      </div>

                      <div
                        style={{
                          height: 8,
                          background:
                            "rgba(127,127,127,0.15)",
                          borderRadius: 99,
                          overflow:
                            "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background:
                              "var(--danger, #dc2626)",
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          FUND FLOW + FINANCIAL HEALTH
      ========================================================= */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        {/* FUND FLOW */}

        <div className="card">
          <h3>
            🏦 Current Fund Distribution
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 25,
            }}
          >
            Real-time distribution of
            GPCC available funds
          </p>

          <div
            style={{
              display: "flex",
              height: 22,
              borderRadius: 99,
              overflow: "hidden",
              background:
                "rgba(127,127,127,0.15)",
              marginBottom: 25,
            }}
          >
            {bankShare > 0 && (
              <div
                style={{
                  width: `${bankShare}%`,
                  background:
                    "var(--primary, #16a34a)",
                }}
              />
            )}

            {pettyCashShare > 0 && (
              <div
                style={{
                  width: `${pettyCashShare}%`,
                  background:
                    "#f59e0b",
                }}
              />
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 15,
            }}
          >
            <div
              style={{
                padding: 16,
                border:
                  "1px solid var(--border, #ddd)",
                borderRadius: 12,
              }}
            >
              <div className="muted">
                🏦 Bank Position
              </div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 7,
                }}
              >
                {compactMoney(
                  fundPosition.bank
                )}
              </div>

              <div
                className="muted"
                style={{
                  marginTop: 5,
                  fontSize: 12,
                }}
              >
                {bankShare.toFixed(1)}%
                of total funds
              </div>
            </div>

            <div
              style={{
                padding: 16,
                border:
                  "1px solid var(--border, #ddd)",
                borderRadius: 12,
              }}
            >
              <div className="muted">
                💵 Petty Cash
              </div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 7,
                }}
              >
                {compactMoney(
                  fundPosition.pettyCash
                )}
              </div>

              <div
                className="muted"
                style={{
                  marginTop: 5,
                  fontSize: 12,
                }}
              >
                {pettyCashShare.toFixed(
                  1
                )}
                % of total funds
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop:
                "1px solid var(--border, #ddd)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <span>
                Bank → Petty Cash
              </span>

              <strong>
                {money(
                  fundPosition.bankToPettyCash
                )}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                marginTop: 12,
              }}
            >
              <span>
                Petty Cash → Bank
              </span>

              <strong>
                {money(
                  fundPosition.pettyCashToBank
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* FINANCIAL HEALTH */}

        <div className="card">
          <h3>
            ❤️ Financial Health Score
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 20,
            }}
          >
            Automated assessment of
            GPCC financial stability
          </p>

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              margin: "20px 0 30px",
            }}
          >
            <div
              style={{
                width: 190,
                height: 190,
                borderRadius: "50%",
                display: "flex",
                flexDirection:
                  "column",
                justifyContent:
                  "center",
                alignItems: "center",
                border:
                  "10px solid var(--primary, #16a34a)",
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {health.score}
              </div>

              <div
                className="muted"
                style={{
                  marginTop: 8,
                }}
              >
                / 100
              </div>
            </div>
          </div>

          <div
            style={{
              textAlign: "center",
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 25,
            }}
          >
            {health.label}
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <span>
                Income vs Expense
              </span>

              <strong>
                {analytics.totalIncome > 0
                  ? `${(
                      (analytics.totalExpense /
                        analytics.totalIncome) *
                      100
                    ).toFixed(1)}%`
                  : "N/A"}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <span>
                Available Liquidity
              </span>

              <strong>
                {compactMoney(
                  fundPosition.total
                )}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <span>
                TDS Recorded
              </span>

              <strong>
                {compactMoney(
                  analytics.totalTds
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          SMART INSIGHTS
      ========================================================= */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 24,
            }}
          >
            🤖
          </div>

          <div>
            <h3
              style={{
                margin: 0,
              }}
            >
              GPCC Smart Financial Insights
            </h3>

            <p
              className="muted"
              style={{
                marginTop: 5,
              }}
            >
              Automated insights generated
              from your financial records
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 15,
            marginTop: 22,
          }}
        >
          {insights.map(
            (insight, index) => (
              <div
                key={`${insight.title}-${index}`}
                style={{
                  border:
                    "1px solid var(--border, #ddd)",
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    marginBottom: 10,
                  }}
                >
                  {insight.icon}
                </div>

                <strong>
                  {insight.title}
                </strong>

                <p
                  className="muted"
                  style={{
                    marginTop: 8,
                    lineHeight: 1.6,
                    fontSize: 13,
                  }}
                >
                  {insight.description}
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* ========================================================
          TOP EXPENSES + CONTROL SUMMARY
      ========================================================= */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        {/* TOP EXPENSES */}

        <div className="card">
          <h3>
            🔥 Top 5 Expenses
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 20,
            }}
          >
            Largest expenditure
            transactions in FY{" "}
            {financialYear}
          </p>

          {topExpenses.length === 0 ? (
            <p className="muted">
              No expense transactions
              available.
            </p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>
                      Description
                    </th>

                    <th>
                      Category
                    </th>

                    <th
                      style={{
                        textAlign:
                          "right",
                      }}
                    >
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {topExpenses.map(
                    (row, index) => (
                      <tr key={row.id}>
                        <td>
                          {row.description ||
                            row.vendor_name ||
                            `Expense ${
                              index + 1
                            }`}
                        </td>

                        <td>
                          {row.category ||
                            row.expense_category ||
                            "Uncategorised"}
                        </td>

                        <td
                          style={{
                            textAlign:
                              "right",
                            fontWeight: 600,
                          }}
                        >
                          {money(
                            getNumber(
                              row.gross_amount
                            )
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CONTROL SUMMARY */}

        <div className="card">
          <h3>
            🛡 Financial Control Summary
          </h3>

          <p
            className="muted"
            style={{
              marginBottom: 20,
            }}
          >
            Key financial governance
            indicators
          </p>

          <div
            style={{
              display: "flex",
              flexDirection:
                "column",
              gap: 15,
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border:
                  "1px solid var(--border, #ddd)",
              }}
            >
              <div className="muted">
                Gross Expenditure
              </div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {money(
                  analytics.totalExpense
                )}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border:
                  "1px solid var(--border, #ddd)",
              }}
            >
              <div className="muted">
                Actual Payment Outflow
              </div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {money(
                  analytics.totalActualOutflow
                )}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border:
                  "1px solid var(--border, #ddd)",
              }}
            >
              <div className="muted">
                Total TDS
              </div>

              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {money(
                  analytics.totalTds
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          FOOTER / ANALYTICS NOTE
      ========================================================= */}

      <div
        className="card"
        style={{
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <h3>
          ℹ️ Analytics Methodology
        </h3>

        <p className="muted">
          Income analytics include only
          transactions with status
          <strong> Cleared</strong>. Expense
          analytics include only transactions
          with status <strong>Paid</strong>.
        </p>

        <p className="muted">
          Current available funds are
          calculated independently of the
          selected financial year using the
          active opening balances, all
          applicable cleared income, paid
          expenses, internal fund transfers
          and account-specific adjustments.
        </p>

        <p className="muted">
          Internal transfers between Bank and
          Petty Cash do not change total GPCC
          funds; they only redistribute
          liquidity between accounts.
        </p>
      </div>
    </div>
  );
}