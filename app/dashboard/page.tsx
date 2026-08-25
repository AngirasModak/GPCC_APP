"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Brain,
  CircleDollarSign,
  Landmark,
  Lightbulb,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

type AlertItem = {
  type: "danger" | "warning" | "success" | "info";
  title: string;
  description: string;
};

type MonthlyData = {
  month: string;
  income: number;
  expense: number;
  net: number;
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

const getDate = (row: any) => {
  return (
    row.transaction_date ||
    row.date ||
    row.expense_date ||
    row.income_date ||
    row.created_at
  );
};

const monthKey = (date: string) => {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "Unknown";
  }

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
};

const monthLabel = (key: string) => {
  if (key === "Unknown") return key;

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

  const [s, setS] =
    useState<DashboardSummary>(initialSummary);

  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  /* =========================================================
     LOAD DASHBOARD
  ========================================================= */

  const loadDashboard = async () => {
    setLoading(true);
    setMsg("");

    try {
      const [
        bankResult,
        pettyCashResult,
        incomeResult,
        expenseResult,
        transferResult,
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

      if (bankResult.error) {
        throw new Error(bankResult.error.message);
      }

      if (pettyCashResult.error) {
        throw new Error(pettyCashResult.error.message);
      }

      if (incomeResult.error) {
        throw new Error(incomeResult.error.message);
      }

      if (expenseResult.error) {
        throw new Error(expenseResult.error.message);
      }

      if (transferResult.error) {
        throw new Error(transferResult.error.message);
      }

      const bankData = bankResult.data;
      const pettyCashData = pettyCashResult.data;

      const incomeRows = incomeResult.data || [];
      const expenseRows = expenseResult.data || [];
      const transferRows = transferResult.data || [];

      setBankAccount(
        bankData as BankAccount | null
      );

      setPettyCashAccount(
        pettyCashData as PettyCashAccount | null
      );

      setIncomes(incomeRows);
      setExpenses(expenseRows);
      setTransfers(transferRows);

      if (!bankData || !pettyCashData) {
        setS(initialSummary);
        return;
      }

      /* =====================================================
         INCOME
      ====================================================== */

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
        totalIncome - totalCashIncome;

      /* =====================================================
         EXPENSE
      ====================================================== */

      const totalExpense = expenseRows.reduce(
        (sum, row) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

      const totalTds = expenseRows.reduce(
        (sum, row) => {
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

      const getNetPayment = (row: any) => {
        if (
          row.net_amount !== null &&
          row.net_amount !== undefined
        ) {
          return Number(row.net_amount || 0);
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
      ====================================================== */

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
         FINAL BALANCES
      ====================================================== */

      const bank =
        Number(
          bankData.opening_balance || 0
        ) +
        totalBankIncome -
        totalBankExpense -
        totalBankToPettyCash +
        totalPettyCashToBank +
        totalBankAdjustmentCredit -
        totalBankAdjustmentDebit;

      const pettyCash =
        Number(
          pettyCashData.opening_balance || 0
        ) +
        totalCashIncome +
        totalBankToPettyCash -
        totalPettyCashExpense -
        totalPettyCashToBank +
        totalCashAdjustmentCredit -
        totalCashAdjustmentDebit;

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

        bank,
        pettyCash,
        totalFunds: bank + pettyCash,
      });
    } catch (error: any) {
      console.error(error);

      setMsg(
        error?.message ||
          "Unable to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  /* =========================================================
     CURRENT MONTH ANALYSIS
  ========================================================= */

  const currentMonth = useMemo(() => {
    const now = new Date();

    const month = now.getMonth();
    const year = now.getFullYear();

    const monthIncome = incomes
      .filter((row) => {
        const date = new Date(getDate(row));

        return (
          date.getMonth() === month &&
          date.getFullYear() === year
        );
      })
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const monthExpense = expenses
      .filter((row) => {
        const date = new Date(getDate(row));

        return (
          date.getMonth() === month &&
          date.getFullYear() === year
        );
      })
      .reduce(
        (sum, row) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

    return {
      income: monthIncome,
      expense: monthExpense,
      net: monthIncome - monthExpense,
    };
  }, [incomes, expenses]);

  /* =========================================================
     MONTHLY CASH FLOW - LAST 6 MONTHS
  ========================================================= */

  const monthlyData = useMemo(() => {
    const map: Record<
      string,
      MonthlyData
    > = {};

    incomes.forEach((row) => {
      const key = monthKey(getDate(row));

      if (!map[key]) {
        map[key] = {
          month: monthLabel(key),
          income: 0,
          expense: 0,
          net: 0,
        };
      }

      map[key].income += Number(
        row.amount || 0
      );
    });

    expenses.forEach((row) => {
      const key = monthKey(getDate(row));

      if (!map[key]) {
        map[key] = {
          month: monthLabel(key),
          income: 0,
          expense: 0,
          net: 0,
        };
      }

      map[key].expense += Number(
        row.gross_amount || 0
      );
    });

    return Object.entries(map)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .slice(-6)
      .map(([, value]) => ({
        ...value,
        net:
          value.income -
          value.expense,
      }));
  }, [incomes, expenses]);

  /* =========================================================
     FINANCIAL HEALTH SCORE
  ========================================================= */

  const health = useMemo(() => {
    let score = 100;

    const netRatio =
      s.income > 0
        ? (s.income - s.expense) /
          s.income
        : 0;

    if (netRatio < 0) score -= 30;
    else if (netRatio < 0.1) score -= 15;

    if (s.pettyCash < 1000) {
      score -= 10;
    }

    if (
      s.totalFunds > 0 &&
      s.tds / s.totalFunds > 0.2
    ) {
      score -= 10;
    }

    score = Math.max(
      0,
      Math.min(100, score)
    );

    let label = "Excellent";

    if (score < 50) label = "Critical";
    else if (score < 70) label = "Needs Attention";
    else if (score < 85) label = "Healthy";

    return {
      score,
      label,
    };
  }, [s]);

  /* =========================================================
     NOTIFICATIONS
  ========================================================= */

  const alerts = useMemo<AlertItem[]>(() => {
    const list: AlertItem[] = [];

    if (s.pettyCash < 1000) {
      list.push({
        type: "warning",
        title: "Low Petty Cash",
        description:
          "Petty cash is below the recommended operating threshold.",
      });
    }

    if (currentMonth.expense > currentMonth.income) {
      list.push({
        type: "danger",
        title: "Negative Monthly Cash Flow",
        description:
          "Current month expenses are higher than income.",
      });
    }

    const largeExpense =
      expenses.some(
        (row) =>
          Number(
            row.gross_amount || 0
          ) >
          Math.max(
            50000,
            s.expense * 0.25
          )
      );

    if (largeExpense) {
      list.push({
        type: "warning",
        title: "High Value Expense Detected",
        description:
          "A significant expense requires management attention.",
      });
    }

    if (
      currentMonth.income >
      currentMonth.expense
    ) {
      list.push({
        type: "success",
        title: "Positive Cash Flow",
        description:
          "Current month income is higher than current month expenditure.",
      });
    }

    if (!list.length) {
      list.push({
        type: "info",
        title: "Financial Position Stable",
        description:
          "No major financial risk indicators are currently detected.",
      });
    }

    return list;
  }, [
    s,
    currentMonth,
    expenses,
  ]);

  /* =========================================================
     PREDICTIVE ANALYSIS
  ========================================================= */

  const forecast = useMemo(() => {
    if (!monthlyData.length) {
      return {
        projectedIncome: 0,
        projectedExpense: 0,
        projectedFunds: s.totalFunds,
      };
    }

    const avgIncome =
      monthlyData.reduce(
        (sum, row) =>
          sum + row.income,
        0
      ) / monthlyData.length;

    const avgExpense =
      monthlyData.reduce(
        (sum, row) =>
          sum + row.expense,
        0
      ) / monthlyData.length;

    return {
      projectedIncome: avgIncome,
      projectedExpense: avgExpense,
      projectedFunds:
        s.totalFunds +
        avgIncome -
        avgExpense,
    };
  }, [
    monthlyData,
    s.totalFunds,
  ]);

  /* =========================================================
     PRESCRIPTIVE INSIGHTS
  ========================================================= */

  const recommendations =
    useMemo(() => {
      const list: string[] = [];

      if (
        s.pettyCashExpense >
        s.bankExpense
      ) {
        list.push(
          "Consider moving more high-value payments from petty cash to bank-based payments for stronger financial traceability."
        );
      }

      if (
        currentMonth.expense >
        currentMonth.income
      ) {
        list.push(
          "Review current month expenses and postpone non-essential expenditure until the cash-flow position improves."
        );
      }

      if (s.pettyCash < 1000) {
        list.push(
          "Plan a controlled bank-to-petty-cash transfer to maintain operational liquidity."
        );
      }

      if (
        forecast.projectedFunds <
        s.totalFunds
      ) {
        list.push(
          "Based on the recent spending pattern, GPCC funds may decline next month. Consider establishing an expense budget."
        );
      }

      if (!list.length) {
        list.push(
          "Maintain the current financial discipline and continue monitoring income, expenditure and liquidity."
        );
      }

      return list;
    }, [
      s,
      currentMonth,
      forecast,
    ]);

  /* =========================================================
     ACCOUNT DISTRIBUTION
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

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading GPCC Financial Intelligence...
        </h2>
      </div>
    );
  }

  /* =========================================================
     INITIAL SETUP MESSAGE
  ========================================================= */

  if (!bankAccount || !pettyCashAccount) {
    return (
      <div className="card">
        <h2>
          Financial Setup Required
        </h2>

        <p className="muted">
          Please configure both the active Bank
          Account and Petty Cash Account before
          using the Financial Intelligence
          Dashboard.
        </p>
      </div>
    );
  }

  /* =========================================================
     MAIN DASHBOARD
  ========================================================= */

  return (
    <div className="financeDashboard">
      {/* HEADER */}

      <div className="pageHead dashboardHeader">
        <div>
          <div className="dashboardEyebrow">
            GPCC FINANCIAL INTELLIGENCE
          </div>

          <h1>
            Financial Command Centre
          </h1>

          <p className="muted">
            Real-time financial position,
            alerts, diagnostics, predictions
            and recommended actions.
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={loadDashboard}
        >
          <RefreshCw size={16} />
          Refresh Intelligence
        </button>
      </div>

      {msg && (
        <div className="dashboardError">
          {msg}
        </div>
      )}

      {/* =====================================================
          EXECUTIVE METRICS
      ====================================================== */}

      <section className="dashboardSection">
        <div className="metricGrid">
          <div className="smartMetricCard primaryMetric">
            <div className="metricIcon">
              <CircleDollarSign size={22} />
            </div>

            <span>
              Total Available Funds
            </span>

            <strong>
              {money(s.totalFunds)}
            </strong>

            <small>
              Current operational liquidity
            </small>
          </div>

          <div className="smartMetricCard">
            <div className="metricIcon">
              <Landmark size={22} />
            </div>

            <span>
              Current Bank Position
            </span>

            <strong>
              {money(s.bank)}
            </strong>

            <small>
              {bankAccount.account_name}
            </small>
          </div>

          <div className="smartMetricCard">
            <div className="metricIcon">
              <Wallet size={22} />
            </div>

            <span>
              Current Petty Cash
            </span>

            <strong>
              {money(s.pettyCash)}
            </strong>

            <small>
              Available for operations
            </small>
          </div>

          <div className="smartMetricCard">
            <div className="metricIcon">
              {currentMonth.net >= 0 ? (
                <TrendingUp size={22} />
              ) : (
                <TrendingDown size={22} />
              )}
            </div>

            <span>
              Current Month Net Flow
            </span>

            <strong>
              {money(currentMonth.net)}
            </strong>

            <small>
              Income minus expenditure
            </small>
          </div>
        </div>
      </section>

      {/* =====================================================
          SMART NOTIFICATIONS
      ====================================================== */}

      <section className="dashboardSection">
        <div className="sectionTitleRow">
          <div>
            <div className="sectionEyebrow">
              LIVE MONITORING
            </div>

            <h2>
              Smart Notifications
            </h2>
          </div>

          <Bell size={22} />
        </div>

        <div className="notificationGrid">
          {alerts.map(
            (alert, index) => (
              <div
                key={index}
                className={`notificationCard ${alert.type}`}
              >
                <div className="notificationIcon">
                  {alert.type ===
                    "danger" && (
                    <AlertTriangle />
                  )}

                  {alert.type ===
                    "warning" && (
                    <AlertTriangle />
                  )}

                  {alert.type ===
                    "success" && (
                    <ShieldCheck />
                  )}

                  {alert.type ===
                    "info" && (
                    <Bell />
                  )}
                </div>

                <div>
                  <h4>
                    {alert.title}
                  </h4>

                  <p>
                    {alert.description}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          HEALTH + FORECAST
      ====================================================== */}

      <section className="dashboardTwoColumn">
        {/* HEALTH */}

        <div className="intelligenceCard healthCard">
          <div className="sectionEyebrow">
            FINANCIAL HEALTH
          </div>

          <h2>
            GPCC Financial Health Score
          </h2>

          <div className="healthContent">
            <div className="healthScore">
              <strong>
                {health.score}
              </strong>

              <span>/ 100</span>
            </div>

            <div>
              <h3>
                {health.label}
              </h3>

              <p className="muted">
                Calculated using liquidity,
                cash-flow stability and
                financial risk indicators.
              </p>
            </div>
          </div>

          <div className="healthBars">
            <div>
              <span>
                Liquidity
              </span>

              <div className="progressTrack">
                <div
                  className="progressFill"
                  style={{
                    width: `${Math.min(
                      100,
                      s.totalFunds > 0
                        ? 85
                        : 10
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <span>
                Cash Flow
              </span>

              <div className="progressTrack">
                <div
                  className="progressFill"
                  style={{
                    width: `${Math.max(
                      10,
                      Math.min(
                        100,
                        currentMonth.net >= 0
                          ? 85
                          : 35
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <span>
                Expense Control
              </span>

              <div className="progressTrack">
                <div
                  className="progressFill"
                  style={{
                    width: `${
                      currentMonth.income > 0
                        ? Math.min(
                            100,
                            Math.max(
                              20,
                              100 -
                                (currentMonth
                                  .expense /
                                  currentMonth
                                    .income) *
                                  50
                            )
                          )
                        : 50
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* FORECAST */}

        <div className="intelligenceCard forecastCard">
          <div className="sectionEyebrow">
            PREDICTIVE ANALYSIS
          </div>

          <h2>
            Next 30-Day Outlook
          </h2>

          <div className="forecastMetrics">
            <div>
              <span>
                Projected Income
              </span>

              <strong>
                {money(
                  forecast.projectedIncome
                )}
              </strong>
            </div>

            <div>
              <span>
                Projected Expense
              </span>

              <strong>
                {money(
                  forecast.projectedExpense
                )}
              </strong>
            </div>

            <div className="forecastHighlight">
              <span>
                Estimated Fund Position
              </span>

              <strong>
                {money(
                  forecast.projectedFunds
                )}
              </strong>
            </div>
          </div>

          <p className="forecastNote">
            Projection is calculated from the
            available recent monthly financial
            pattern.
          </p>
        </div>
      </section>

      {/* =====================================================
          CASH FLOW + FUND DISTRIBUTION
      ====================================================== */}

      <section className="dashboardChartGrid">
        <div className="chartCard largeChart">
          <div className="sectionEyebrow">
            OPERATING TREND
          </div>

          <h2>
            Recent Cash Flow Pattern
          </h2>

          <div className="chartLarge">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <AreaChart
                data={monthlyData}
              >
                <defs>
                  <linearGradient
                    id="incomeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#10b981"
                      stopOpacity={0.35}
                    />

                    <stop
                      offset="95%"
                      stopColor="#10b981"
                      stopOpacity={0}
                    />
                  </linearGradient>

                  <linearGradient
                    id="expenseGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#ef4444"
                      stopOpacity={0.25}
                    />

                    <stop
                      offset="95%"
                      stopColor="#ef4444"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                />

                <YAxis />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value || 0)
                    )
                  }
                />

                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={3}
                  fill="url(#incomeGradient)"
                />

                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#ef4444"
                  strokeWidth={3}
                  fill="url(#expenseGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chartCard">
          <div className="sectionEyebrow">
            LIQUIDITY
          </div>

          <h2>
            Fund Distribution
          </h2>

          <div className="chartMedium">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={fundDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={5}
                >
                  {fundDistribution.map(
                    (_, index) => (
                      <Cell
                        key={index}
                        fill={
                          index === 0
                            ? "#6366f1"
                            : "#f59e0b"
                        }
                      />
                    )
                  )}
                </Pie>

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value || 0)
                    )
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="distributionLegend">
            <span>
              <i className="legendBank" />
              Bank
            </span>

            <span>
              <i className="legendCash" />
              Petty Cash
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================
          DIAGNOSTIC ANALYSIS
      ====================================================== */}

      <section className="dashboardSection">
        <div className="sectionTitleRow">
          <div>
            <div className="sectionEyebrow">
              DIAGNOSTIC ANALYSIS
            </div>

            <h2>
              What Is Driving the Financial Position?
            </h2>
          </div>

          <Brain size={24} />
        </div>

        <div className="diagnosticGrid">
          <div className="diagnosticCard">
            <span>
              Income
            </span>

            <strong>
              {money(s.income)}
            </strong>

            <p>
              Total cleared income currently
              recorded in the financial system.
            </p>
          </div>

          <div className="diagnosticCard">
            <span>
              Gross Expense
            </span>

            <strong>
              {money(s.expense)}
            </strong>

            <p>
              Includes all paid expenses before
              TDS adjustment.
            </p>
          </div>

          <div className="diagnosticCard">
            <span>
              TDS Impact
            </span>

            <strong>
              {money(s.tds)}
            </strong>

            <p>
              TDS reduces immediate payment
              outflow but remains a financial
              liability.
            </p>
          </div>

          <div className="diagnosticCard">
            <span>
              Internal Transfers
            </span>

            <strong>
              {money(
                s.bankToPettyCash +
                  s.pettyCashToBank
              )}
            </strong>

            <p>
              Transfers change fund location but
              do not change total GPCC funds.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          PRESCRIPTIVE ANALYSIS
      ====================================================== */}

      <section className="recommendationSection">
        <div className="sectionTitleRow">
          <div>
            <div className="sectionEyebrow">
              PRESCRIPTIVE ANALYSIS
            </div>

            <h2>
              Recommended Actions
            </h2>
          </div>

          <Lightbulb size={24} />
        </div>

        <div className="recommendationGrid">
          {recommendations.map(
            (
              recommendation,
              index
            ) => (
              <div
                className="recommendationCard"
                key={index}
              >
                <div className="recommendationNumber">
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </div>

                <p>
                  {recommendation}
                </p>
              </div>
            )
          )}
        </div>
      </section>

      {/* =====================================================
          CURRENT MONTH SUMMARY
      ====================================================== */}

      <section className="currentMonthSection">
        <div className="sectionEyebrow">
          CURRENT PERIOD
        </div>

        <h2>
          This Month at a Glance
        </h2>

        <div className="monthSummaryGrid">
          <div>
            <span>
              Income
            </span>

            <strong>
              {money(
                currentMonth.income
              )}
            </strong>

            <ArrowUpRight
              size={20}
            />
          </div>

          <div>
            <span>
              Expense
            </span>

            <strong>
              {money(
                currentMonth.expense
              )}
            </strong>

            <ArrowDownRight
              size={20}
            />
          </div>

          <div>
            <span>
              Net Cash Flow
            </span>

            <strong>
              {money(
                currentMonth.net
              )}
            </strong>

            <TrendingUp
              size={20}
            />
          </div>
        </div>
      </section>
    </div>
  );
}