"use client";

import { useEffect, useMemo, useState } from "react";
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
import { supabase } from "../../lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type IncomeRow = {
  id?: string;
  date?: string;
  income_date?: string;
  amount?: number | string;
  mode?: string;
  category?: string;
  status?: string;
  deleted_at?: string | null;
};

type ExpenseRow = {
  id?: string;
  date?: string;
  expense_date?: string;
  gross_amount?: number | string;
  net_amount?: number | string | null;
  tds_amount?: number | string | null;
  tds_rate?: number | string | null;
  payment_mode?: string;
  category?: string;
  expense_category?: string;
  status?: string;
  deleted_at?: string | null;
};

type TransferRow = {
  id?: string;
  date?: string;
  transfer_date?: string;
  amount?: number | string;
  type?: string;
  direction?: string;
  deleted_at?: string | null;
};

type BankAccount = {
  id?: string;
  account_name?: string;
  opening_balance?: number | string;
  opening_balance_date?: string;
  is_active?: boolean;
};

type PettyCashAccount = {
  id?: string;
  account_name?: string;
  opening_balance?: number | string;
  opening_balance_date?: string;
  is_active?: boolean;
};

type NotificationItem = {
  id: string;
  priority: "critical" | "warning" | "info" | "success";
  title: string;
  message: string;
};

type RecommendationItem = {
  title: string;
  description: string;
  priority: "High" | "Medium" | "Low";
};

type TrendItem = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

type CategoryItem = {
  name: string;
  value: number;
};

type PaymentModeItem = {
  name: string;
  value: number;
};

type ForecastItem = {
  month: string;
  actual: number | null;
  forecast: number;
};

type HealthMetric = {
  score: number;
  label: string;
  description: string;
};

/* =========================================================
   CONSTANTS
========================================================= */

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#db2777",
];

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const numberValue = (value: unknown) => Number(value || 0);

const getIncomeDate = (row: IncomeRow) =>
  row.income_date || row.date || "";

const getExpenseDate = (row: ExpenseRow) =>
  row.expense_date || row.date || "";

const getTransferDate = (row: TransferRow) =>
  row.transfer_date || row.date || "";

const monthKey = (dateValue: string) => {
  if (!dateValue) return "Unknown";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const monthLabel = (key: string) => {
  if (key === "Unknown") return "Unknown";

  const [year, month] = key.split("-");

  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const getNetPayment = (row: ExpenseRow) => {
  if (
    row.net_amount !== null &&
    row.net_amount !== undefined
  ) {
    return numberValue(row.net_amount);
  }

  const gross = numberValue(row.gross_amount);

  const tds =
    row.tds_amount !== null &&
    row.tds_amount !== undefined
      ? numberValue(row.tds_amount)
      : gross *
        (numberValue(row.tds_rate) / 100);

  return gross - tds;
};

/* =========================================================
   PAGE
========================================================= */

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [incomes, setIncomes] = useState<IncomeRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);

  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [pettyCashAccount, setPettyCashAccount] =
    useState<PettyCashAccount | null>(null);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  const loadData = async () => {
    try {
      setError("");

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
        throw new Error(incomeResponse.error.message);
      }

      if (expenseResponse.error) {
        throw new Error(expenseResponse.error.message);
      }

      if (transferResponse.error) {
        throw new Error(transferResponse.error.message);
      }

      if (bankResponse.error) {
        throw new Error(bankResponse.error.message);
      }

      if (pettyCashResponse.error) {
        throw new Error(pettyCashResponse.error.message);
      }

      setIncomes(
        (incomeResponse.data || []) as IncomeRow[]
      );

      setExpenses(
        (expenseResponse.data || []) as ExpenseRow[]
      );

      setTransfers(
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
    } catch (err: any) {
      setError(
        err?.message ||
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  /* =======================================================
     CORE CALCULATIONS
  ======================================================= */

  const analytics = useMemo(() => {
    const clearedIncomes = incomes.filter(
      (row) =>
        !row.status ||
        String(row.status)
          .trim()
          .toLowerCase() === "cleared"
    );

    const paidExpenses = expenses.filter(
      (row) =>
        !row.status ||
        String(row.status)
          .trim()
          .toLowerCase() === "paid"
    );

    const totalIncome = clearedIncomes.reduce(
      (sum, row) =>
        sum + numberValue(row.amount),
      0
    );

    const totalExpense = paidExpenses.reduce(
      (sum, row) =>
        sum + numberValue(row.gross_amount),
      0
    );

    const totalNetExpense = paidExpenses.reduce(
      (sum, row) =>
        sum + getNetPayment(row),
      0
    );

    const totalTds = paidExpenses.reduce(
      (sum, row) => {
        const gross = numberValue(
          row.gross_amount
        );

        const tds =
          row.tds_amount !== null &&
          row.tds_amount !== undefined
            ? numberValue(row.tds_amount)
            : gross *
              (numberValue(row.tds_rate) /
                100);

        return sum + tds;
      },
      0
    );

    /* -------------------------------
       INCOME BY PAYMENT MODE
    -------------------------------- */

    const bankIncome = clearedIncomes
      .filter((row) => {
        const mode = String(
          row.mode || ""
        )
          .trim()
          .toLowerCase();

        return [
          "bank transfer",
          "online",
          "upi",
          "cheque",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + numberValue(row.amount),
        0
      );

    const cashIncome = clearedIncomes
      .filter(
        (row) =>
          String(
            row.mode || ""
          )
            .trim()
            .toLowerCase() === "cash"
      )
      .reduce(
        (sum, row) =>
          sum + numberValue(row.amount),
        0
      );

    /* -------------------------------
       EXPENSE BY PAYMENT MODE
    -------------------------------- */

    const bankExpense = paidExpenses
      .filter((row) => {
        const mode = String(
          row.payment_mode || ""
        )
          .trim()
          .toLowerCase();

        return [
          "bank transfer",
          "online",
          "upi",
          "cheque",
        ].includes(mode);
      })
      .reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const pettyCashExpense =
      paidExpenses
        .filter(
          (row) =>
            String(
              row.payment_mode || ""
            )
              .trim()
              .toLowerCase() ===
            "petty cash"
        )
        .reduce(
          (sum, row) =>
            sum + getNetPayment(row),
          0
        );

    /* -------------------------------
       TRANSFERS
    -------------------------------- */

    const bankToPettyCash = transfers
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
          sum + numberValue(row.amount),
        0
      );

    const pettyCashToBank = transfers
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
          sum + numberValue(row.amount),
        0
      );

    const bankAdjustmentCredit =
      transfers
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "IN"
        )
        .reduce(
          (sum, row) =>
            sum + numberValue(row.amount),
          0
        );

    const bankAdjustmentDebit =
      transfers
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "OUT"
        )
        .reduce(
          (sum, row) =>
            sum + numberValue(row.amount),
          0
        );

    const cashAdjustmentCredit =
      transfers
        .filter(
          (row) =>
            [
              "Cash Adjustment",
              "Cash Adjustment +",
            ].includes(
              String(row.type || "")
            ) &&
            row.direction === "IN"
        )
        .reduce(
          (sum, row) =>
            sum + numberValue(row.amount),
          0
        );

    const cashAdjustmentDebit =
      transfers
        .filter(
          (row) =>
            [
              "Cash Adjustment",
              "Cash Adjustment -",
            ].includes(
              String(row.type || "")
            ) &&
            row.direction === "OUT"
        )
        .reduce(
          (sum, row) =>
            sum + numberValue(row.amount),
          0
        );

    /* -------------------------------
       CURRENT POSITIONS
    -------------------------------- */

    const openingBank = numberValue(
      bankAccount?.opening_balance
    );

    const openingCash = numberValue(
      pettyCashAccount?.opening_balance
    );

    const currentBank =
      openingBank +
      bankIncome -
      bankExpense -
      bankToPettyCash +
      pettyCashToBank +
      bankAdjustmentCredit -
      bankAdjustmentDebit;

    const currentPettyCash =
      openingCash +
      cashIncome +
      bankToPettyCash -
      pettyCashExpense -
      pettyCashToBank +
      cashAdjustmentCredit -
      cashAdjustmentDebit;

    const totalFunds =
      currentBank + currentPettyCash;

    const netPosition =
      totalIncome - totalExpense;

    /* -------------------------------
       MONTHLY TREND
    -------------------------------- */

    const monthlyMap: Record<
      string,
      {
        income: number;
        expense: number;
      }
    > = {};

    clearedIncomes.forEach((row) => {
      const key = monthKey(
        getIncomeDate(row)
      );

      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          income: 0,
          expense: 0,
        };
      }

      monthlyMap[key].income +=
        numberValue(row.amount);
    });

    paidExpenses.forEach((row) => {
      const key = monthKey(
        getExpenseDate(row)
      );

      if (!monthlyMap[key]) {
        monthlyMap[key] = {
          income: 0,
          expense: 0,
        };
      }

      monthlyMap[key].expense +=
        numberValue(row.gross_amount);
    });

    const monthlyTrend: TrendItem[] =
      Object.entries(monthlyMap)
        .filter(([key]) => key !== "Unknown")
        .sort(([a], [b]) =>
          a.localeCompare(b)
        )
        .map(([key, value]) => ({
          month: monthLabel(key),
          income: value.income,
          expense: value.expense,
          net:
            value.income -
            value.expense,
        }));

    /* -------------------------------
       EXPENSE CATEGORY ANALYSIS
    -------------------------------- */

    const categoryMap: Record<
      string,
      number
    > = {};

    paidExpenses.forEach((row) => {
      const category =
        row.expense_category ||
        row.category ||
        "Uncategorised";

      categoryMap[category] =
        (categoryMap[category] || 0) +
        numberValue(row.gross_amount);
    });

    const expenseCategories: CategoryItem[] =
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

    /* -------------------------------
       PAYMENT MODE ANALYSIS
    -------------------------------- */

    const paymentMap: Record<
      string,
      number
    > = {};

    paidExpenses.forEach((row) => {
      const mode =
        row.payment_mode ||
        "Not Specified";

      paymentMap[mode] =
        (paymentMap[mode] || 0) +
        getNetPayment(row);
    });

    const paymentModes: PaymentModeItem[] =
      Object.entries(paymentMap)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        );

    /* -------------------------------
       CASH FLOW MOVEMENT
    -------------------------------- */

    const financialMovement = [
      {
        name: "Bank Income",
        value: bankIncome,
      },
      {
        name: "Cash Income",
        value: cashIncome,
      },
      {
        name: "Bank Expense",
        value: bankExpense,
      },
      {
        name: "Petty Cash Expense",
        value: pettyCashExpense,
      },
      {
        name: "Bank → Petty Cash",
        value: bankToPettyCash,
      },
      {
        name: "Petty Cash → Bank",
        value: pettyCashToBank,
      },
    ];

    /* -------------------------------
       FUND UTILISATION
    -------------------------------- */

    const totalFundBase =
      Math.abs(currentBank) +
      Math.abs(currentPettyCash);

    const fundUtilisation = [
      {
        name: "Bank",
        value: Math.max(
          currentBank,
          0
        ),
      },
      {
        name: "Petty Cash",
        value: Math.max(
          currentPettyCash,
          0
        ),
      },
    ].filter(
      (item) => item.value > 0
    );

    if (
      fundUtilisation.length === 0
    ) {
      fundUtilisation.push({
        name: "No Funds",
        value: 1,
      });
    }

    /* -------------------------------
       FORECAST
    -------------------------------- */

    const recentTrend =
      monthlyTrend.slice(-6);

    const averageNet =
      recentTrend.length > 0
        ? recentTrend.reduce(
            (sum, row) =>
              sum + row.net,
            0
          ) / recentTrend.length
        : 0;

    const forecastData: ForecastItem[] =
      [];

    monthlyTrend
      .slice(-6)
      .forEach((row) => {
        forecastData.push({
          month: row.month,
          actual: row.net,
          forecast: row.net,
        });
      });

    const baseDate = new Date();

    for (
      let i = 1;
      i <= 4;
      i++
    ) {
      const future = new Date(
        baseDate.getFullYear(),
        baseDate.getMonth() + i,
        1
      );

      const projected =
        averageNet * i;

      forecastData.push({
        month:
          future.toLocaleDateString(
            "en-IN",
            {
              month: "short",
            }
          ),
        actual: null,
        forecast: projected,
      });
    }

    /* -------------------------------
       DIAGNOSTIC ANALYSIS
    -------------------------------- */

    const topExpense =
      expenseCategories[0];

    const topExpenseShare =
      totalExpense > 0 &&
      topExpense
        ? (topExpense.value /
            totalExpense) *
          100
        : 0;

    const expenseToIncomeRatio =
      totalIncome > 0
        ? (totalExpense /
            totalIncome) *
          100
        : 0;

    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          100 -
            Math.max(
              0,
              expenseToIncomeRatio -
                50
            ) *
              0.7 -
            (currentPettyCash <
            0
              ? 20
              : 0) -
            (currentBank < 0
              ? 25
              : 0)
        )
      )
    );

    let healthLabel = "Excellent";
    let healthDescription =
      "Financial position is healthy and stable.";

    if (healthScore < 80) {
      healthLabel = "Healthy";
      healthDescription =
        "Financial position is stable but should be monitored.";
    }

    if (healthScore < 60) {
      healthLabel = "Needs Attention";
      healthDescription =
        "Expense or liquidity patterns require attention.";
    }

    if (healthScore < 40) {
      healthLabel = "High Risk";
      healthDescription =
        "Immediate financial review is recommended.";
    }

    const health: HealthMetric = {
      score: healthScore,
      label: healthLabel,
      description:
        healthDescription,
    };

    /* -------------------------------
       NOTIFICATIONS
    -------------------------------- */

    const notifications: NotificationItem[] =
      [];

    if (currentBank < 0) {
      notifications.push({
        id: "bank-negative",
        priority: "critical",
        title:
          "Negative Bank Position",
        message:
          "The calculated bank position is negative. Review payments and adjustments immediately.",
      });
    }

    if (currentPettyCash < 0) {
      notifications.push({
        id: "cash-negative",
        priority: "critical",
        title:
          "Negative Petty Cash",
        message:
          "Petty cash outflow exceeds the available calculated balance.",
      });
    }

    if (
      totalIncome > 0 &&
      expenseToIncomeRatio >
        90
    ) {
      notifications.push({
        id: "high-expense-ratio",
        priority: "warning",
        title:
          "High Expense Utilisation",
        message: `${expenseToIncomeRatio.toFixed(
          1
        )}% of recorded income is currently matched by expenses.`,
      });
    }

    if (
      topExpenseShare > 50 &&
      topExpense
    ) {
      notifications.push({
        id: "expense-concentration",
        priority: "warning",
        title:
          "High Expense Concentration",
        message: `${topExpense.name} represents ${topExpenseShare.toFixed(
          1
        )}% of total expenditure.`,
      });
    }

    if (totalTds > 0) {
      notifications.push({
        id: "tds-liability",
        priority: "info",
        title:
          "TDS Monitoring Required",
        message: `${money(
          totalTds
        )} of TDS has been identified from recorded expenses.`,
      });
    }

    if (notifications.length === 0) {
      notifications.push({
        id: "financial-stable",
        priority: "success",
        title:
          "Financial Position Stable",
        message:
          "No major financial risk indicators were detected from the current data.",
      });
    }

    /* -------------------------------
       PRESCRIPTIVE RECOMMENDATIONS
    -------------------------------- */

    const recommendations: RecommendationItem[] =
      [];

    if (
      expenseToIncomeRatio > 80
    ) {
      recommendations.push({
        priority: "High",
        title:
          "Control Expense Growth",
        description:
          "Review high-value expenditure categories before approving additional discretionary spending.",
      });
    }

    if (
      topExpenseShare > 40 &&
      topExpense
    ) {
      recommendations.push({
        priority: "Medium",
        title:
          `Review ${topExpense.name}`,
        description:
          "A significant proportion of expenditure is concentrated in this category. Consider approval controls and budget thresholds.",
      });
    }

    if (
      currentPettyCash >
      totalFunds * 0.4
    ) {
      recommendations.push({
        priority: "Medium",
        title:
          "Optimise Petty Cash Holding",
        description:
          "Consider maintaining a lower petty cash balance and returning excess funds to the bank account.",
      });
    }

    if (
      recommendations.length === 0
    ) {
      recommendations.push({
        priority: "Low",
        title:
          "Maintain Current Controls",
        description:
          "Current financial patterns do not indicate a major control issue. Continue periodic reconciliation and monitoring.",
      });
    }

    return {
      totalIncome,
      totalExpense,
      totalNetExpense,
      totalTds,
      bankIncome,
      cashIncome,
      bankExpense,
      pettyCashExpense,
      bankToPettyCash,
      pettyCashToBank,
      currentBank,
      currentPettyCash,
      totalFunds,
      netPosition,
      monthlyTrend,
      expenseCategories,
      paymentModes,
      financialMovement,
      fundUtilisation,
      totalFundBase,
      forecastData,
      topExpense,
      topExpenseShare,
      expenseToIncomeRatio,
      health,
      notifications,
      recommendations,
    };
  }, [
    incomes,
    expenses,
    transfers,
    bankAccount,
    pettyCashAccount,
  ]);

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        style={{
          padding: 32,
        }}
      >
        <div
          style={{
            padding: 32,
            borderRadius: 16,
            background:
              "var(--card, #ffffff)",
            boxShadow:
              "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h2>
            Loading Financial Intelligence
            Centre...
          </h2>

          <p className="muted">
            Analysing GPCC financial
            data.
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "none",
        padding:
          "24px 28px 48px",
        boxSizing:
          "border-box",
      }}
    >
      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
          gap: 20,
          marginBottom: 28,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems:
                "center",
              gap: 8,
              padding:
                "7px 12px",
              borderRadius: 999,
              marginBottom: 12,
              background:
                "rgba(37,99,235,0.1)",
              color: "#2563eb",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            📊 GPCC FINANCIAL INTELLIGENCE
          </div>

          <h1
            style={{
              margin:
                "0 0 8px",
              fontSize: 32,
            }}
          >
            Reports & Analytics
          </h1>

          <p
            className="muted"
            style={{
              margin: 0,
              fontSize: 15,
            }}
          >
            Descriptive, Diagnostic,
            Predictive and Prescriptive
            Financial Intelligence
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={
            handleRefresh
          }
          disabled={
            refreshing
          }
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh Intelligence"}
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div
          style={{
            marginBottom: 24,
            padding: 18,
            borderRadius: 14,
            background:
              "rgba(220,38,38,0.08)",
            color: "#b91c1c",
            border:
              "1px solid rgba(220,38,38,0.2)",
          }}
        >
          {error}
        </div>
      )}

      {/* =================================================
          EXECUTIVE KPI SECTION
      ================================================= */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 32,
        }}
      >
        <MetricCard
          title="Total Available Funds"
          value={money(
            analytics.totalFunds
          )}
          icon="💰"
          subtitle="Current GPCC liquidity"
        />

        <MetricCard
          title="Current Bank Position"
          value={money(
            analytics.currentBank
          )}
          icon="🏦"
          subtitle={
            bankAccount?.account_name ||
            "Active bank account"
          }
        />

        <MetricCard
          title="Current Petty Cash"
          value={money(
            analytics.currentPettyCash
          )}
          icon="💵"
          subtitle="Operational cash balance"
        />

        <MetricCard
          title="Net Financial Position"
          value={money(
            analytics.netPosition
          )}
          icon="📈"
          subtitle="Income minus expenditure"
        />
      </div>

      {/* =================================================
          FINANCIAL HEALTH
      ================================================= */}

      <section
        style={{
          marginBottom: 32,
        }}
      >
        <SectionHeader
          icon="🧠"
          title="Financial Intelligence Overview"
          subtitle="A consolidated assessment of GPCC financial health and operational position."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(300px, 0.8fr) minmax(0, 2fr)",
            gap: 24,
          }}
        >
          <div className="card">
            <h3>
              Financial Health Score
            </h3>

            <div
              style={{
                height: 310,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Health",
                        value:
                          analytics
                            .health
                            .score,
                      },
                      {
                        name:
                          "Remaining",
                        value:
                          100 -
                          analytics
                            .health
                            .score,
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                  >
                    <Cell
                      fill="#2563eb"
                    />
                    <Cell
                      fill="#e5e7eb"
                    />
                  </Pie>

                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div
              style={{
                textAlign:
                  "center",
                marginTop: -80,
                position:
                  "relative",
              }}
            >
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                }}
              >
                {
                  analytics
                    .health
                    .score
                }
              </div>

              <div
                className="muted"
              >
                {
                  analytics
                    .health
                    .label
                }
              </div>
            </div>
          </div>

          <div className="card">
            <h3>
              Executive Financial Summary
            </h3>

            <p className="muted">
              {
                analytics
                  .health
                  .description
              }
            </p>

            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginTop: 24,
              }}
            >
              <InsightBox
                label="Expense to Income"
                value={`${analytics.expenseToIncomeRatio.toFixed(
                  1
                )}%`}
              />

              <InsightBox
                label="Total TDS"
                value={money(
                  analytics.totalTds
                )}
              />

              <InsightBox
                label="Top Expense Driver"
                value={
                  analytics
                    .topExpense
                    ?.name ||
                  "No Data"
                }
              />

              <InsightBox
                label="Top Expense Share"
                value={`${analytics.topExpenseShare.toFixed(
                  1
                )}%`}
              />
            </div>
          </div>
        </div>
      </section>

      {/* =================================================
          DESCRIPTIVE ANALYTICS
      ================================================= */}

      <section
        style={{
          marginBottom: 36,
        }}
      >
        <SectionHeader
          icon="📊"
          title="Descriptive Analytics"
          subtitle="Understand what has happened across income, expenditure, payment modes and fund movement."
        />

        {/* LARGE TREND + DONUT */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.7fr) minmax(380px, 0.9fr)",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div className="card">
            <ChartTitle
              title="Income vs Expense Trend"
              subtitle="Monthly movement of recorded cleared income and paid expenditure."
            />

            <div
              style={{
                height: 420,
                width: "100%",
              }}
            >
              <ResponsiveContainer>
                <AreaChart
                  data={
                    analytics.monthlyTrend
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="month"
                  />

                  <YAxis
                    tickFormatter={(
                      value
                    ) =>
                      `₹${Math.round(
                        value / 1000
                      )}K`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: number
                    ) =>
                      money(value)
                    }
                  />

                  <Legend />

                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#16a34a"
                    fill="#bbf7d0"
                  />

                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Expense"
                    stroke="#dc2626"
                    fill="#fecaca"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <ChartTitle
              title="Fund Utilisation"
              subtitle="Current distribution between Bank and Petty Cash."
            />

            <div
              style={{
                height: 420,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={
                      analytics.fundUtilisation
                    }
                    cx="50%"
                    cy="50%"
                    outerRadius={125}
                    innerRadius={65}
                    dataKey="value"
                    label={({
                      name,
                      percent,
                    }) =>
                      `${name} ${(
                        (percent || 0) *
                        100
                      ).toFixed(0)}%`
                    }
                  >
                    {analytics.fundUtilisation.map(
                      (
                        _,
                        index
                      ) => (
                        <Cell
                          key={index}
                          fill={
                            COLORS[
                              index %
                                COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(
                      value: number
                    ) =>
                      money(value)
                    }
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* EXPENSE + FINANCIAL MOVEMENT */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 24,
            marginBottom: 24,
          }}
        >
          <div className="card">
            <ChartTitle
              title="Top Expense Drivers"
              subtitle="Highest expenditure categories based on recorded transactions."
            />

            <div
              style={{
                height: 390,
              }}
            >
              <ResponsiveContainer>
                <BarChart
                  layout="vertical"
                  data={
                    analytics.expenseCategories
                  }
                  margin={{
                    left: 30,
                    right: 25,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    type="number"
                    tickFormatter={(
                      value
                    ) =>
                      `₹${Math.round(
                        value / 1000
                      )}K`
                    }
                  />

                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                  />

                  <Tooltip
                    formatter={(
                      value: number
                    ) =>
                      money(value)
                    }
                  />

                  <Bar
                    dataKey="value"
                    name="Expense"
                    radius={[
                      0,
                      8,
                      8,
                      0,
                    ]}
                  >
                    {analytics.expenseCategories.map(
                      (
                        _,
                        index
                      ) => (
                        <Cell
                          key={index}
                          fill={
                            COLORS[
                              index %
                                COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <ChartTitle
              title="Financial Movement"
              subtitle="Income, expenditure and internal fund transfers."
            />

            <div
              style={{
                height: 390,
              }}
            >
              <ResponsiveContainer>
                <BarChart
                  data={
                    analytics.financialMovement
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="name"
                    angle={-20}
                    textAnchor="end"
                    height={80}
                  />

                  <YAxis
                    tickFormatter={(
                      value
                    ) =>
                      `₹${Math.round(
                        value / 1000
                      )}K`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: number
                    ) =>
                      money(value)
                    }
                  />

                  <Bar
                    dataKey="value"
                    name="Amount"
                    radius={[
                      8,
                      8,
                      0,
                      0,
                    ]}
                  >
                    {analytics.financialMovement.map(
                      (
                        _,
                        index
                      ) => (
                        <Cell
                          key={index}
                          fill={
                            COLORS[
                              index %
                                COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* PAYMENT MODE */}

        <div className="card">
          <ChartTitle
            title="Payment Mode Analysis"
            subtitle="Distribution of expenditure across available payment mechanisms."
          />

          <div
            style={{
              height: 400,
            }}
          >
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={
                    analytics.paymentModes
                  }
                  cx="50%"
                  cy="50%"
                  outerRadius={135}
                  innerRadius={60}
                  dataKey="value"
                  label
                >
                  {analytics.paymentModes.map(
                    (
                      _,
                      index
                    ) => (
                      <Cell
                        key={index}
                        fill={
                          COLORS[
                            index %
                              COLORS.length
                          ]
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  formatter={(
                    value: number
                  ) =>
                    money(value)
                  }
                />

                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* =================================================
          DIAGNOSTIC ANALYTICS
      ================================================= */}

      <section
        style={{
          marginBottom: 36,
        }}
      >
        <SectionHeader
          icon="🔍"
          title="Diagnostic Analytics"
          subtitle="Identify financial concentration, risk signals and underlying drivers."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <DiagnosticCard
            icon="🎯"
            title="Expense Concentration"
            value={`${analytics.topExpenseShare.toFixed(
              1
            )}%`}
            description={
              analytics.topExpense
                ? `${analytics.topExpense.name} is currently the largest expenditure driver.`
                : "No expense category data available."
            }
          />

          <DiagnosticCard
            icon="⚖️"
            title="Expense Pressure"
            value={`${analytics.expenseToIncomeRatio.toFixed(
              1
            )}%`}
            description="Percentage of income currently represented by gross expenditure."
          />

          <DiagnosticCard
            icon="💸"
            title="TDS Exposure"
            value={money(
              analytics.totalTds
            )}
            description="Total TDS identified from recorded expenditure."
          />

          <DiagnosticCard
            icon="🔄"
            title="Internal Fund Movement"
            value={money(
              analytics.bankToPettyCash +
                analytics.pettyCashToBank
            )}
            description="Total movement between Bank and Petty Cash."
          />
        </div>
      </section>

      {/* =================================================
          PREDICTIVE ANALYTICS
      ================================================= */}

      <section
        style={{
          marginBottom: 36,
        }}
      >
        <SectionHeader
          icon="🔮"
          title="Predictive Analytics"
          subtitle="A directional projection based on historical net financial movement."
        />

        <div className="card">
          <ChartTitle
            title="Projected Financial Position"
            subtitle="Historical net position followed by a simple trend-based projection."
          />

          <div
            style={{
              height: 440,
            }}
          >
            <ResponsiveContainer>
              <LineChart
                data={
                  analytics.forecastData
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="month"
                />

                <YAxis
                  tickFormatter={(
                    value
                  ) =>
                    `₹${Math.round(
                      value / 1000
                    )}K`
                  }
                />

                <Tooltip
                  formatter={(
                    value: number
                  ) =>
                    money(value)
                  }
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Historical Net Position"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                  }}
                  connectNulls
                />

                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Projected Trend"
                  stroke="#9333ea"
                  strokeWidth={3}
                  strokeDasharray="8 6"
                  dot={{
                    r: 4,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* =================================================
          PRESCRIPTIVE ANALYTICS
      ================================================= */}

      <section
        style={{
          marginBottom: 36,
        }}
      >
        <SectionHeader
          icon="💡"
          title="Prescriptive Analytics"
          subtitle="Recommended actions based on the financial patterns identified."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {analytics.recommendations.map(
            (
              recommendation,
              index
            ) => (
              <div
                key={index}
                className="card"
                style={{
                  borderTop:
                    recommendation.priority ===
                    "High"
                      ? "4px solid #dc2626"
                      : recommendation.priority ===
                        "Medium"
                      ? "4px solid #ea580c"
                      : "4px solid #2563eb",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                    alignItems:
                      "flex-start",
                  }}
                >
                  <h3
                    style={{
                      marginTop: 0,
                    }}
                  >
                    {
                      recommendation.title
                    }
                  </h3>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding:
                        "5px 10px",
                      borderRadius: 999,
                      background:
                        "rgba(37,99,235,0.1)",
                    }}
                  >
                    {
                      recommendation.priority
                    }
                  </span>
                </div>

                <p className="muted">
                  {
                    recommendation.description
                  }
                </p>
              </div>
            )
          )}
        </div>
      </section>

      {/* =================================================
          SMART NOTIFICATIONS
      ================================================= */}

      <section>
        <SectionHeader
          icon="🔔"
          title="Smart Notification Centre"
          subtitle="Automated financial signals generated from the currently available GPCC data."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {analytics.notifications.map(
            (
              notification
            ) => (
              <NotificationCard
                key={
                  notification.id
                }
                notification={
                  notification
                }
              />
            )
          )}
        </div>
      </section>

      {/* =================================================
          FOOTER NOTE
      ================================================= */}

      <div
        style={{
          marginTop: 36,
          padding: 20,
          borderRadius: 16,
          background:
            "rgba(37,99,235,0.05)",
          border:
            "1px solid rgba(37,99,235,0.12)",
        }}
      >
        <strong>
          GPCC Financial Intelligence
          Engine
        </strong>

        <p
          className="muted"
          style={{
            marginBottom: 0,
          }}
        >
          Analysis is calculated from
          cleared income, paid expenses,
          account balances and recorded
          fund transfers. Predictive
          results are directional
          projections based on available
          historical data and should be
          used as decision support.
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function MetricCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: string;
  subtitle: string;
}) {
  return (
    <div
      className="card"
      style={{
        minHeight: 150,
        display: "flex",
        flexDirection:
          "column",
        justifyContent:
          "space-between",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems:
            "flex-start",
        }}
      >
        <div
          className="muted"
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 24,
          }}
        >
          {icon}
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          {value}
        </div>

        <div
          className="muted"
          style={{
            fontSize: 12,
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        marginBottom: 20,
      }}
    >
      <h2
        style={{
          margin:
            "0 0 6px",
          fontSize: 23,
        }}
      >
        {icon} {title}
      </h2>

      <p
        className="muted"
        style={{
          margin: 0,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function ChartTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        marginBottom: 18,
      }}
    >
      <h3
        style={{
          margin:
            "0 0 6px",
        }}
      >
        {title}
      </h3>

      <p
        className="muted"
        style={{
          margin: 0,
          fontSize: 13,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function InsightBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 14,
        background:
          "rgba(148,163,184,0.08)",
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 12,
          marginBottom: 7,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 750,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DiagnosticCard({
  icon,
  title,
  value,
  description,
}: {
  icon: string;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div
      className="card"
      style={{
        minHeight: 210,
      }}
    >
      <div
        style={{
          fontSize: 26,
          marginBottom: 12,
        }}
      >
        {icon}
      </div>

      <div
        className="muted"
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 27,
          fontWeight: 800,
          margin:
            "8px 0 12px",
        }}
      >
        {value}
      </div>

      <p
        className="muted"
        style={{
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  );
}

function NotificationCard({
  notification,
}: {
  notification: NotificationItem;
}) {
  const styles = {
    critical: {
      border:
        "1px solid rgba(220,38,38,0.3)",
      background:
        "rgba(220,38,38,0.07)",
      icon: "🚨",
      label: "CRITICAL",
    },

    warning: {
      border:
        "1px solid rgba(234,88,12,0.3)",
      background:
        "rgba(234,88,12,0.07)",
      icon: "⚠️",
      label: "WARNING",
    },

    info: {
      border:
        "1px solid rgba(37,99,235,0.3)",
      background:
        "rgba(37,99,235,0.07)",
      icon: "ℹ️",
      label: "INFO",
    },

    success: {
      border:
        "1px solid rgba(22,163,74,0.3)",
      background:
        "rgba(22,163,74,0.07)",
      icon: "✓",
      label: "STABLE",
    },
  };

  const style =
    styles[
      notification.priority
    ];

  return (
    <div
      style={{
        padding: 22,
        borderRadius: 16,
        border: style.border,
        background:
          style.background,
        minHeight: 150,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems:
            "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 24,
          }}
        >
          {style.icon}
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              marginBottom: 6,
            }}
          >
            {style.label}
          </div>

          <h3
            style={{
              margin:
                "0 0 8px",
            }}
          >
            {
              notification.title
            }
          </h3>

          <p
            className="muted"
            style={{
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {
              notification.message
            }
          </p>
        </div>
      </div>
    </div>
  );
}