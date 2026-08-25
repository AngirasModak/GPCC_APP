"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  amount?: number | string | null;
  mode?: string | null;
  status?: string | null;
  date?: string | null;
  income_date?: string | null;
  created_at?: string | null;
  category?: string | null;
  source?: string | null;
  description?: string | null;
};

type ExpenseRow = {
  id?: string;
  gross_amount?: number | string | null;
  net_amount?: number | string | null;
  tds_amount?: number | string | null;
  tds_rate?: number | string | null;
  payment_mode?: string | null;
  status?: string | null;
  expense_date?: string | null;
  date?: string | null;
  created_at?: string | null;
  category?: string | null;
  expense_category?: string | null;
  description?: string | null;
  vendor?: string | null;
};

type TransferRow = {
  id?: string;
  amount?: number | string | null;
  type?: string | null;
  direction?: string | null;
  date?: string | null;
  created_at?: string | null;
};

type BankAccount = {
  id?: string;
  account_name?: string | null;
  opening_balance?: number | string | null;
  opening_balance_date?: string | null;
  is_active?: boolean | null;
};

type PettyCashAccount = {
  id?: string;
  account_name?: string | null;
  opening_balance?: number | string | null;
  opening_balance_date?: string | null;
  is_active?: boolean | null;
};

type MonthlyTrend = {
  month: string;
  income: number;
  expense: number;
  surplus: number;
  cumulative: number;
};

type CategoryData = {
  name: string;
  value: number;
  percentage: number;
};

type PaymentModeData = {
  name: string;
  value: number;
};

type NotificationItem = {
  id: string;
  type: "critical" | "warning" | "success" | "info";
  title: string;
  message: string;
};

type Recommendation = {
  id: string;
  priority: "High" | "Medium" | "Low";
  title: string;
  description: string;
};

type DashboardSummary = {
  totalIncome: number;
  totalExpense: number;
  netSurplus: number;
  availableFunds: number;
  totalTds: number;

  bankBalance: number;
  pettyCashBalance: number;

  bankIncome: number;
  cashIncome: number;

  bankExpense: number;
  pettyCashExpense: number;

  bankToPettyCash: number;
  pettyCashToBank: number;

  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  projectedMonthlySurplus: number;

  runwayMonths: number;
  financialHealthScore: number;

  monthlyTrend: MonthlyTrend[];

  expenseCategories: CategoryData[];

  paymentModes: PaymentModeData[];

  notifications: NotificationItem[];

  recommendations: Recommendation[];
};

/* =========================================================
   HELPERS
========================================================= */

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const compactMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const number = (value: unknown) => Number(value || 0);

const safeDate = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const getMonthKey = (value?: string | null) => {
  const date = safeDate(value);

  if (!date) return null;

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const getMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-");

  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
};

const normalizeText = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getIncomeDate = (row: IncomeRow) =>
  row.income_date ||
  row.date ||
  row.created_at ||
  null;

const getExpenseDate = (row: ExpenseRow) =>
  row.expense_date ||
  row.date ||
  row.created_at ||
  null;

const getNetPayment = (row: ExpenseRow) => {
  if (
    row.net_amount !== null &&
    row.net_amount !== undefined &&
    row.net_amount !== ""
  ) {
    return number(row.net_amount);
  }

  const gross = number(row.gross_amount);

  let tds = 0;

  if (
    row.tds_amount !== null &&
    row.tds_amount !== undefined &&
    row.tds_amount !== ""
  ) {
    tds = number(row.tds_amount);
  } else {
    tds =
      gross *
      (number(row.tds_rate) / 100);
  }

  return gross - tds;
};

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const [summary, setSummary] =
    useState<DashboardSummary | null>(null);

  /* =======================================================
     LOAD REPORT DATA
  ======================================================= */

  const loadAnalytics = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setMessage("");

        /*
         * ---------------------------------------------------
         * LOAD DATA
         * ---------------------------------------------------
         */

        const [
          incomeResult,
          expenseResult,
          transferResult,
          bankResult,
          pettyCashResult,
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

        if (bankResult.error) {
          throw new Error(
            bankResult.error.message
          );
        }

        if (pettyCashResult.error) {
          throw new Error(
            pettyCashResult.error.message
          );
        }

        const incomes =
          (incomeResult.data || []) as IncomeRow[];

        const expenses =
          (expenseResult.data || []) as ExpenseRow[];

        const transfers =
          (transferResult.data || []) as TransferRow[];

        const bankAccount =
          bankResult.data as BankAccount | null;

        const pettyCashAccount =
          pettyCashResult.data as PettyCashAccount | null;

        /*
         * ---------------------------------------------------
         * DESCRIPTIVE ANALYSIS
         * WHAT HAPPENED?
         * ---------------------------------------------------
         */

        const totalIncome = incomes.reduce(
          (sum, row) =>
            sum + number(row.amount),
          0
        );

        const totalExpense = expenses.reduce(
          (sum, row) =>
            sum + number(row.gross_amount),
          0
        );

        const totalTds = expenses.reduce(
          (sum, row) => {
            if (
              row.tds_amount !== null &&
              row.tds_amount !== undefined &&
              row.tds_amount !== ""
            ) {
              return (
                sum +
                number(row.tds_amount)
              );
            }

            return (
              sum +
              number(row.gross_amount) *
                (number(row.tds_rate) / 100)
            );
          },
          0
        );

        const totalNetExpense =
          expenses.reduce(
            (sum, row) =>
              sum + getNetPayment(row),
            0
          );

        const netSurplus =
          totalIncome - totalExpense;

        /*
         * ---------------------------------------------------
         * BANK VS CASH INCOME
         * ---------------------------------------------------
         */

        const bankIncome = incomes
          .filter((row) => {
            const mode =
              normalizeText(row.mode);

            return [
              "cheque",
              "online",
              "bank transfer",
              "upi",
            ].includes(mode);
          })
          .reduce(
            (sum, row) =>
              sum + number(row.amount),
            0
          );

        const cashIncome = incomes
          .filter(
            (row) =>
              normalizeText(row.mode) ===
              "cash"
          )
          .reduce(
            (sum, row) =>
              sum + number(row.amount),
            0
          );

        /*
         * ---------------------------------------------------
         * BANK VS PETTY CASH EXPENSE
         * ---------------------------------------------------
         */

        const pettyCashExpense =
          expenses
            .filter(
              (row) =>
                normalizeText(
                  row.payment_mode
                ) === "petty cash"
            )
            .reduce(
              (sum, row) =>
                sum + getNetPayment(row),
              0
            );

        const bankExpense = expenses
          .filter((row) => {
            const mode = normalizeText(
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

        /*
         * ---------------------------------------------------
         * FUND TRANSFERS
         * ---------------------------------------------------
         */

        const bankToPettyCash =
          transfers
            .filter((row) => {
              const type = String(
                row.type || ""
              ).trim();

              return (
                type ===
                  "Bank Withdrawal" ||
                type === "Withdrawal"
              );
            })
            .reduce(
              (sum, row) =>
                sum + number(row.amount),
              0
            );

        const pettyCashToBank =
          transfers
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
                sum + number(row.amount),
              0
            );

        /*
         * ---------------------------------------------------
         * BANK ADJUSTMENTS
         * ---------------------------------------------------
         */

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
                sum + number(row.amount),
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
                sum + number(row.amount),
              0
            );

        /*
         * ---------------------------------------------------
         * CASH ADJUSTMENTS
         * ---------------------------------------------------
         */

        const cashAdjustmentCredit =
          transfers
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
                sum + number(row.amount),
              0
            );

        const cashAdjustmentDebit =
          transfers
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
                sum + number(row.amount),
              0
            );

        /*
         * ---------------------------------------------------
         * CURRENT FINANCIAL POSITION
         * ---------------------------------------------------
         */

        const bankBalance =
          number(
            bankAccount?.opening_balance
          ) +
          bankIncome -
          bankExpense -
          bankToPettyCash +
          pettyCashToBank +
          bankAdjustmentCredit -
          bankAdjustmentDebit;

        const pettyCashBalance =
          number(
            pettyCashAccount?.opening_balance
          ) +
          cashIncome +
          bankToPettyCash -
          pettyCashExpense -
          pettyCashToBank +
          cashAdjustmentCredit -
          cashAdjustmentDebit;

        const availableFunds =
          bankBalance + pettyCashBalance;

        /*
         * ===================================================
         * MONTHLY TREND ANALYSIS
         * ===================================================
         */

        const monthlyMap = new Map<
          string,
          {
            income: number;
            expense: number;
          }
        >();

        incomes.forEach((row) => {
          const key = getMonthKey(
            getIncomeDate(row)
          );

          if (!key) return;

          const current =
            monthlyMap.get(key) || {
              income: 0,
              expense: 0,
            };

          current.income += number(
            row.amount
          );

          monthlyMap.set(
            key,
            current
          );
        });

        expenses.forEach((row) => {
          const key = getMonthKey(
            getExpenseDate(row)
          );

          if (!key) return;

          const current =
            monthlyMap.get(key) || {
              income: 0,
              expense: 0,
            };

          current.expense += number(
            row.gross_amount
          );

          monthlyMap.set(
            key,
            current
          );
        });

        const sortedMonths = Array.from(
          monthlyMap.entries()
        )
          .sort(([a], [b]) =>
            a.localeCompare(b)
          )
          .map(([key, value]) => ({
            key,
            ...value,
          }));

        let cumulative = 0;

        const monthlyTrend: MonthlyTrend[] =
          sortedMonths.map((item) => {
            const surplus =
              item.income - item.expense;

            cumulative += surplus;

            return {
              month: getMonthLabel(
                item.key
              ),
              income: item.income,
              expense: item.expense,
              surplus,
              cumulative,
            };
          });

        /*
         * ===================================================
         * EXPENSE CATEGORY ANALYSIS
         * ===================================================
         */

        const categoryMap = new Map<
          string,
          number
        >();

        expenses.forEach((row) => {
          const category =
            String(
              row.expense_category ||
                row.category ||
                "Uncategorized"
            ).trim() ||
            "Uncategorized";

          categoryMap.set(
            category,
            number(
              categoryMap.get(category)
            ) +
              number(row.gross_amount)
          );
        });

        const expenseCategories =
          Array.from(
            categoryMap.entries()
          )
            .map(([name, value]) => ({
              name,
              value,
              percentage:
                totalExpense > 0
                  ? (value /
                      totalExpense) *
                    100
                  : 0,
            }))
            .sort(
              (a, b) =>
                b.value - a.value
            );

        /*
         * ===================================================
         * PAYMENT MODE ANALYSIS
         * ===================================================
         */

        const paymentModeMap =
          new Map<string, number>();

        expenses.forEach((row) => {
          const mode =
            String(
              row.payment_mode ||
                "Unspecified"
            ).trim() ||
            "Unspecified";

          paymentModeMap.set(
            mode,
            number(
              paymentModeMap.get(mode)
            ) +
              getNetPayment(row)
          );
        });

        const paymentModes =
          Array.from(
            paymentModeMap.entries()
          )
            .map(([name, value]) => ({
              name,
              value,
            }))
            .sort(
              (a, b) =>
                b.value - a.value
            );

        /*
         * ===================================================
         * PREDICTIVE ANALYSIS
         * ===================================================
         */

        const activeMonths =
          Math.max(
            monthlyTrend.length,
            1
          );

        const averageMonthlyIncome =
          totalIncome / activeMonths;

        const averageMonthlyExpense =
          totalExpense / activeMonths;

        const projectedMonthlySurplus =
          averageMonthlyIncome -
          averageMonthlyExpense;

        const runwayMonths =
          averageMonthlyExpense > 0
            ? availableFunds /
              averageMonthlyExpense
            : 0;

        /*
         * ===================================================
         * FINANCIAL HEALTH SCORE
         * ===================================================
         */

        let financialHealthScore = 100;

        if (netSurplus < 0) {
          financialHealthScore -= 25;
        }

        if (
          totalIncome > 0 &&
          totalExpense / totalIncome > 0.9
        ) {
          financialHealthScore -= 15;
        }

        if (runwayMonths < 1) {
          financialHealthScore -= 20;
        } else if (runwayMonths < 2) {
          financialHealthScore -= 10;
        }

        if (
          expenseCategories[0] &&
          expenseCategories[0].percentage >
            50
        ) {
          financialHealthScore -= 10;
        }

        if (availableFunds < 0) {
          financialHealthScore = 10;
        }

        financialHealthScore =
          Math.max(
            0,
            Math.min(
              100,
              Math.round(
                financialHealthScore
              )
            )
          );

        /*
         * ===================================================
         * SMART NOTIFICATIONS
         * ===================================================
         */

        const notifications: NotificationItem[] =
          [];

        if (totalIncome === 0) {
          notifications.push({
            id: "no-income",
            type: "info",
            title:
              "No cleared income recorded",
            message:
              "There is currently no cleared income available for financial analysis.",
          });
        }

        if (totalExpense > totalIncome) {
          notifications.push({
            id: "expense-exceeds-income",
            type: "critical",
            title:
              "Expenses exceed income",
            message: `Current expenditure exceeds cleared income by ${money(
              totalExpense - totalIncome
            )}.`,
          });
        } else if (
          totalIncome > 0 &&
          netSurplus > 0
        ) {
          notifications.push({
            id: "positive-surplus",
            type: "success",
            title:
              "Positive financial surplus",
            message: `GPCC currently has a surplus of ${money(
              netSurplus
            )} based on cleared income and recorded expenses.`,
          });
        }

        if (
          pettyCashBalance >= 0 &&
          pettyCashBalance < 1000
        ) {
          notifications.push({
            id: "low-petty-cash",
            type: "warning",
            title:
              "Low petty cash position",
            message: `Current petty cash is ${money(
              pettyCashBalance
            )}. Consider replenishment if upcoming cash expenses are expected.`,
          });
        }

        if (
          expenseCategories.length > 0 &&
          expenseCategories[0].percentage >
            40
        ) {
          notifications.push({
            id: "expense-concentration",
            type: "warning",
            title:
              "High expense concentration",
            message: `${expenseCategories[0].name} represents ${expenseCategories[0].percentage.toFixed(
              1
            )}% of total expenditure.`,
          });
        }

        if (
          runwayMonths > 0 &&
          runwayMonths < 1
        ) {
          notifications.push({
            id: "low-runway",
            type: "critical",
            title:
              "Financial runway is below one month",
            message: `At the current average expenditure level, available funds may cover approximately ${runwayMonths.toFixed(
              1
            )} month(s).`,
          });
        } else if (
          runwayMonths >= 3
        ) {
          notifications.push({
            id: "healthy-runway",
            type: "success",
            title:
              "Healthy financial runway",
            message: `Current available funds represent approximately ${runwayMonths.toFixed(
              1
            )} months of average expenditure.`,
          });
        }

        if (
          monthlyTrend.length >= 2
        ) {
          const current =
            monthlyTrend[
              monthlyTrend.length - 1
            ];

          const previous =
            monthlyTrend[
              monthlyTrend.length - 2
            ];

          if (
            previous.expense > 0 &&
            current.expense >
              previous.expense * 1.2
          ) {
            const growth =
              ((current.expense -
                previous.expense) /
                previous.expense) *
              100;

            notifications.push({
              id: "expense-growth",
              type: "warning",
              title:
                "Sharp monthly expense increase",
              message: `Expense increased by ${growth.toFixed(
                1
              )}% compared with the previous recorded month.`,
            });
          }
        }

        if (
          notifications.length === 0
        ) {
          notifications.push({
            id: "stable",
            type: "info",
            title:
              "Financial position is stable",
            message:
              "No major financial risk indicators were identified from the currently available transaction data.",
          });
        }

        /*
         * ===================================================
         * PRESCRIPTIVE ANALYSIS
         * WHAT SHOULD BE DONE?
         * ===================================================
         */

        const recommendations: Recommendation[] =
          [];

        if (netSurplus < 0) {
          recommendations.push({
            id: "reduce-expense",
            priority: "High",
            title:
              "Control expenditure immediately",
            description:
              "Review non-essential expenses and prioritise mandatory commitments until expenditure is aligned with income.",
          });
        }

        if (
          expenseCategories[0] &&
          expenseCategories[0].percentage >
            40
        ) {
          recommendations.push({
            id: "category-review",
            priority: "High",
            title: `Review ${expenseCategories[0].name}`,
            description: `This category contributes ${expenseCategories[0].percentage.toFixed(
              1
            )}% of total expenditure and should be reviewed for optimisation opportunities.`,
          });
        }

        if (
          runwayMonths > 0 &&
          runwayMonths < 2
        ) {
          recommendations.push({
            id: "reserve",
            priority: "High",
            title:
              "Strengthen the financial reserve",
            description:
              "Build a higher cash reserve through improved collection, controlled expenditure, or planned fund allocation.",
          });
        }

        if (
          pettyCashBalance < 1000
        ) {
          recommendations.push({
            id: "petty-cash",
            priority: "Medium",
            title:
              "Review petty cash requirement",
            description:
              "Evaluate upcoming cash requirements and replenish petty cash only according to approved operational needs.",
          });
        }

        if (
          totalIncome > 0 &&
          totalExpense / totalIncome >
            0.8
        ) {
          recommendations.push({
            id: "margin",
            priority: "Medium",
            title:
              "Improve operating surplus",
            description:
              "Target a lower expense-to-income ratio by monitoring high-value expense categories and improving income collection.",
          });
        }

        if (
          recommendations.length === 0
        ) {
          recommendations.push({
            id: "maintain",
            priority: "Low",
            title:
              "Maintain financial discipline",
            description:
              "Continue monitoring expenditure, maintain supporting documentation, and preserve the current financial control process.",
          });
        }

        /*
         * ===================================================
         * UPDATE SUMMARY
         * ===================================================
         */

        setSummary({
          totalIncome,
          totalExpense,
          netSurplus,
          availableFunds,
          totalTds,

          bankBalance,
          pettyCashBalance,

          bankIncome,
          cashIncome,

          bankExpense,
          pettyCashExpense,

          bankToPettyCash,
          pettyCashToBank,

          averageMonthlyIncome,
          averageMonthlyExpense,
          projectedMonthlySurplus,

          runwayMonths,
          financialHealthScore,

          monthlyTrend,

          expenseCategories,

          paymentModes,

          notifications,

          recommendations,
        });
      } catch (error: any) {
        setMessage(
          error?.message ||
            "Unable to load financial analytics."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /*
   * =======================================================
   * DERIVED VISUAL DATA
   * =======================================================
   */

  const healthLabel = useMemo(() => {
    if (!summary) return "Calculating";

    if (
      summary.financialHealthScore >= 80
    ) {
      return "Healthy";
    }

    if (
      summary.financialHealthScore >= 60
    ) {
      return "Stable";
    }

    if (
      summary.financialHealthScore >= 40
    ) {
      return "Attention Required";
    }

    return "High Risk";
  }, [summary]);

  const forecastData = useMemo(() => {
    if (!summary) return [];

    const current =
      summary.availableFunds;

    const monthlyChange =
      summary.projectedMonthlySurplus;

    return Array.from(
      { length: 6 },
      (_, index) => {
        const monthNumber = index + 1;

        return {
          month: `M${monthNumber}`,
          projected:
            current +
            monthlyChange * monthNumber,
        };
      }
    );
  }, [summary]);

  const fundDistribution = useMemo(() => {
    if (!summary) return [];

    return [
      {
        name: "Bank",
        value: Math.max(
          0,
          summary.bankBalance
        ),
      },
      {
        name: "Petty Cash",
        value: Math.max(
          0,
          summary.pettyCashBalance
        ),
      },
    ];
  }, [summary]);

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Financial Intelligence
          Centre...
        </h2>

        <p className="muted">
          Analysing GPCC financial data,
          transaction trends, risks and
          recommendations.
        </p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="card">
        <h2>
          Financial analytics unavailable
        </h2>

        <p className="muted">
          {message ||
            "No financial data could be loaded."}
        </p>

        <button
          className="btn"
          onClick={() =>
            loadAnalytics(true)
          }
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <div className="pageHead">
        <div>
          <h1>
            Financial Intelligence Centre
          </h1>

          <p className="muted">
            GPCC Reports, Analytics &
            Decision Intelligence
          </p>
        </div>

        <button
          className="btn secondary"
          disabled={refreshing}
          onClick={() =>
            loadAnalytics(true)
          }
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh Intelligence"}
        </button>
      </div>

      {message && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            color: "#b42318",
          }}
        >
          {message}
        </div>
      )}

      {/* ===================================================
          EXECUTIVE FINANCIAL HEALTH
      =================================================== */}

      <div
        className="card"
        style={{
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div>
            <h2
              style={{
                marginBottom: 6,
              }}
            >
              GPCC Financial Health
            </h2>

            <p className="muted">
              AI-inspired financial
              intelligence based on
              income, expenditure,
              liquidity and financial
              concentration indicators.
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
            }}
          >
            <div className="muted">
              Financial Health Score
            </div>

            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                lineHeight: 1.1,
              }}
            >
              {
                summary.financialHealthScore
              }
              <span
                style={{
                  fontSize: 18,
                }}
              >
                /100
              </span>
            </div>

            <div
              className="muted"
              style={{
                marginTop: 4,
              }}
            >
              {healthLabel}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          EXECUTIVE KPI CARDS
      =================================================== */}

      <div className="grid">
        <div className="card">
          <div className="muted">
            Total Income
          </div>

          <div className="metric">
            {money(summary.totalIncome)}
          </div>

          <div className="muted">
            Cleared income
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Total Expenditure
          </div>

          <div className="metric">
            {money(summary.totalExpense)}
          </div>

          <div className="muted">
            Gross recorded expenses
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Net Surplus / Deficit
          </div>

          <div className="metric">
            {money(summary.netSurplus)}
          </div>

          <div className="muted">
            Income less expenditure
          </div>
        </div>

        <div className="card">
          <div className="muted">
            Available Funds
          </div>

          <div className="metric">
            {money(
              summary.availableFunds
            )}
          </div>

          <div className="muted">
            Bank + Petty Cash
          </div>
        </div>

        <div className="card">
          <div className="muted">
            TDS Analysed
          </div>

          <div className="metric">
            {money(summary.totalTds)}
          </div>

          <div className="muted">
            Based on recorded expenses
          </div>
        </div>
      </div>

      {/* ===================================================
          SMART NOTIFICATIONS
      =================================================== */}

      <div
        style={{
          marginTop: 20,
        }}
      >
        <div className="pageHead">
          <div>
            <h2>
              Smart Financial Notifications
            </h2>

            <p className="muted">
              Automatically generated
              alerts, risks and positive
              indicators.
            </p>
          </div>
        </div>

        <div className="grid">
          {summary.notifications.map(
            (notification) => {
              const icon =
                notification.type ===
                "critical"
                  ? "🔴"
                  : notification.type ===
                    "warning"
                  ? "🟠"
                  : notification.type ===
                    "success"
                  ? "🟢"
                  : "🔵";

              return (
                <div
                  key={notification.id}
                  className="card"
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems:
                        "flex-start",
                    }}
                  >
                    <div>
                      {icon}
                    </div>

                    <div>
                      <strong>
                        {
                          notification.title
                        }
                      </strong>

                      <p
                        className="muted"
                        style={{
                          marginTop: 8,
                          marginBottom: 0,
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
          )}
        </div>
      </div>

      {/* ===================================================
          DESCRIPTIVE ANALYTICS
      =================================================== */}

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          📊 Descriptive Analytics
        </h2>

        <p className="muted">
          What happened to GPCC finances?
        </p>

        <div
          className="grid"
          style={{
            marginTop: 20,
          }}
        >
          <div className="card">
            <h3>
              Income vs Expenditure Trend
            </h3>

            <p className="muted">
              Monthly financial movement
              based on available
              transaction history.
            </p>

            <div
              style={{
                width: "100%",
                height: 320,
              }}
            >
              <ResponsiveContainer>
                <AreaChart
                  data={
                    summary.monthlyTrend
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="month"
                  />

                  <YAxis
                    tickFormatter={
                      compactMoney
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: any
                    ) => money(Number(value))}
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
              Expense Category Distribution
            </h3>

            <p className="muted">
              Where is the GPCC budget
              being spent?
            </p>

            <div
              style={{
                width: "100%",
                height: 320,
              }}
            >
              {summary.expenseCategories
                .length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={
                        summary.expenseCategories
                      }
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label={(entry: any) =>
                        `${entry.name}: ${entry.percentage.toFixed(
                          0
                        )}%`
                      }
                    >
                      {summary.expenseCategories.map(
                        (_, index) => (
                          <Cell
                            key={`cell-${index}`}
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      formatter={(
                        value: any
                      ) =>
                        money(Number(value))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div
                  className="muted"
                  style={{
                    paddingTop: 100,
                    textAlign: "center",
                  }}
                >
                  No expense category data
                  available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          DIAGNOSTIC ANALYTICS
      =================================================== */}

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          🔍 Diagnostic Analytics
        </h2>

        <p className="muted">
          Why is the financial position
          changing?
        </p>

        <div
          className="grid"
          style={{
            marginTop: 20,
          }}
        >
          <div className="card">
            <h3>
              Top Expense Drivers
            </h3>

            <div
              style={{
                width: "100%",
                height: 350,
              }}
            >
              <ResponsiveContainer>
                <BarChart
                  data={
                    summary.expenseCategories
                  }
                  layout="vertical"
                  margin={{
                    left: 30,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    type="number"
                    tickFormatter={
                      compactMoney
                    }
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                  />

                  <Tooltip
                    formatter={(
                      value: any
                    ) => money(Number(value))}
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
              Fund Utilisation
            </h3>

            <p className="muted">
              Comparison between Bank and
              Petty Cash.
            </p>

            <div
              style={{
                width: "100%",
                height: 320,
              }}
            >
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={fundDistribution}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={105}
                    label={(entry: any) =>
                      `${entry.name}: ${money(
                        entry.value
                      )}`
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: any
                    ) => money(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div
          className="grid"
          style={{
            marginTop: 20,
          }}
        >
          <div className="card">
            <h3>
              Payment Mode Analysis
            </h3>

            <div
              style={{
                width: "100%",
                height: 300,
              }}
            >
              <ResponsiveContainer>
                <BarChart
                  data={
                    summary.paymentModes
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="name"
                  />

                  <YAxis
                    tickFormatter={
                      compactMoney
                    }
                  />

                  <Tooltip
                    formatter={(
                      value: any
                    ) => money(Number(value))}
                  />

                  <Bar
                    dataKey="value"
                    name="Amount"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3>
              Financial Movement
            </h3>

            <div className="tableWrap">
              <table className="table">
                <tbody>
                  <tr>
                    <td>
                      Bank Income
                    </td>
                    <td>
                      {money(
                        summary.bankIncome
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      Cash Income
                    </td>
                    <td>
                      {money(
                        summary.cashIncome
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      Bank Expenses
                    </td>
                    <td>
                      {money(
                        summary.bankExpense
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      Petty Cash Expenses
                    </td>
                    <td>
                      {money(
                        summary.pettyCashExpense
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      Bank → Petty Cash
                    </td>
                    <td>
                      {money(
                        summary.bankToPettyCash
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td>
                      Petty Cash → Bank
                    </td>
                    <td>
                      {money(
                        summary.pettyCashToBank
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
          PREDICTIVE ANALYTICS
      =================================================== */}

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          🔮 Predictive Analytics
        </h2>

        <p className="muted">
          What may happen if current
          financial patterns continue?
        </p>

        <div className="grid">
          <div className="card">
            <div className="muted">
              Average Monthly Income
            </div>

            <div className="metric">
              {money(
                summary.averageMonthlyIncome
              )}
            </div>
          </div>

          <div className="card">
            <div className="muted">
              Average Monthly Expense
            </div>

            <div className="metric">
              {money(
                summary.averageMonthlyExpense
              )}
            </div>
          </div>

          <div className="card">
            <div className="muted">
              Projected Monthly Surplus
            </div>

            <div className="metric">
              {money(
                summary.projectedMonthlySurplus
              )}
            </div>
          </div>

          <div className="card">
            <div className="muted">
              Estimated Financial Runway
            </div>

            <div className="metric">
              {summary.runwayMonths.toFixed(
                1
              )}{" "}
              months
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginTop: 20,
          }}
        >
          <h3>
            Six-Month Financial Projection
          </h3>

          <p className="muted">
            Projection based on current
            average income and expenditure
            patterns.
          </p>

          <div
            style={{
              width: "100%",
              height: 350,
            }}
          >
            <ResponsiveContainer>
              <LineChart
                data={forecastData}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="month"
                />

                <YAxis
                  tickFormatter={
                    compactMoney
                  }
                />

                <Tooltip
                  formatter={(
                    value: any
                  ) => money(Number(value))}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="projected"
                  name="Projected Available Funds"
                  strokeWidth={3}
                  dot={{
                    r: 5,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ===================================================
          PRESCRIPTIVE ANALYTICS
      =================================================== */}

      <div
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          💡 Prescriptive Analytics
        </h2>

        <p className="muted">
          What actions should GPCC
          consider next?
        </p>

        <div className="grid">
          {summary.recommendations.map(
            (recommendation) => {
              const icon =
                recommendation.priority ===
                "High"
                  ? "🚨"
                  : recommendation.priority ===
                    "Medium"
                  ? "⚠️"
                  : "💡";

              return (
                <div
                  key={
                    recommendation.id
                  }
                  className="card"
                >
                  <div
                    className="muted"
                    style={{
                      marginBottom: 8,
                    }}
                  >
                    {icon}{" "}
                    {
                      recommendation.priority
                    }{" "}
                    Priority
                  </div>

                  <h3>
                    {
                      recommendation.title
                    }
                  </h3>

                  <p className="muted">
                    {
                      recommendation.description
                    }
                  </p>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ===================================================
          DETAILED FINANCIAL INTELLIGENCE
      =================================================== */}

      <div
        className="card"
        style={{
          marginTop: 30,
        }}
      >
        <h2>
          Detailed Financial Intelligence
        </h2>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  Month
                </th>

                <th>
                  Income
                </th>

                <th>
                  Expense
                </th>

                <th>
                  Surplus / Deficit
                </th>

                <th>
                  Cumulative Movement
                </th>
              </tr>
            </thead>

            <tbody>
              {summary.monthlyTrend.map(
                (row) => (
                  <tr key={row.month}>
                    <td>
                      {row.month}
                    </td>

                    <td>
                      {money(
                        row.income
                      )}
                    </td>

                    <td>
                      {money(
                        row.expense
                      )}
                    </td>

                    <td>
                      {money(
                        row.surplus
                      )}
                    </td>

                    <td>
                      {money(
                        row.cumulative
                      )}
                    </td>
                  </tr>
                )
              )}

              {summary.monthlyTrend
                .length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="muted"
                  >
                    No monthly transaction
                    history is available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================
          CONTROL SUMMARY
      =================================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          GPCC Financial Intelligence
          Summary
        </h3>

        <p className="muted">
          This dashboard combines
          descriptive analysis to explain
          what happened, diagnostic
          analysis to identify key
          financial drivers, predictive
          analysis to estimate future
          financial movement, and
          prescriptive analysis to
          recommend actions.
        </p>

        <p className="muted">
          Internal transfers between
          Bank and Petty Cash do not
          change total GPCC funds.
          They only redistribute funds
          between financial accounts.
        </p>

        <p className="muted">
          Predictive results are based
          on currently available
          transaction history and should
          be treated as financial
          indicators rather than
          guaranteed forecasts.
        </p>
      </div>
    </>
  );
}