"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

/* =========================================================
   TYPES
========================================================= */

type MonthlyPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
};

type CategoryPoint = {
  name: string;
  value: number;
  percentage: number;
};

type PaymentPoint = {
  name: string;
  value: number;
};

type AlertItem = {
  id: string;
  level: "success" | "info" | "warning" | "danger";
  title: string;
  description: string;
};

type DashboardSummary = {
  /* Core financial metrics */
  totalIncome: number;
  totalExpense: number;
  totalTds: number;
  totalNetExpense: number;
  netPosition: number;

  /* Current funds */
  bankBalance: number;
  pettyCashBalance: number;
  totalAvailableFunds: number;

  /* Income channels */
  bankIncome: number;
  cashIncome: number;

  /* Expense channels */
  bankExpense: number;
  pettyCashExpense: number;

  /* Transfers */
  bankToPettyCash: number;
  pettyCashToBank: number;

  /* Adjustments */
  bankAdjustmentCredit: number;
  bankAdjustmentDebit: number;
  cashAdjustmentCredit: number;
  cashAdjustmentDebit: number;

  /* Counts */
  incomeCount: number;
  expenseCount: number;
  transferCount: number;

  /* Analysis collections */
  monthlyTrend: MonthlyPoint[];
  expenseCategories: CategoryPoint[];
  incomeModes: PaymentPoint[];
  expenseModes: PaymentPoint[];
  alerts: AlertItem[];

  /* Analytics */
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  savingsRate: number;
  burnRate: number;
  projectedMonthEndBalance: number;
  largestExpenseCategory: string;
  largestExpenseCategoryAmount: number;
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

const number = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const percent = (n: number) =>
  `${Number(n || 0).toFixed(1)}%`;

const getMonthKey = (value: any) => {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
};

const getMonthLabel = (key: string) => {
  if (key === "Unknown") return key;

  const [year, month] = key.split("-");

  const date = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const getNetPayment = (row: any) => {
  if (
    row.net_amount !== null &&
    row.net_amount !== undefined &&
    row.net_amount !== ""
  ) {
    return Number(row.net_amount || 0);
  }

  const gross = Number(row.gross_amount || 0);

  const tds =
    row.tds_amount !== null &&
    row.tds_amount !== undefined
      ? Number(row.tds_amount || 0)
      : gross * (Number(row.tds_rate || 0) / 100);

  return gross - tds;
};

const normalize = (value: any) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getCategory = (row: any) => {
  return (
    row.category ||
    row.expense_category ||
    row.category_name ||
    row.expense_type ||
    "Uncategorised"
  );
};

/* =========================================================
   SIMPLE SVG LINE CHART
========================================================= */

function TrendChart({
  data,
}: {
  data: MonthlyPoint[];
}) {
  const width = 900;
  const height = 280;
  const padding = 35;

  const values = data.flatMap((x) => [
    x.income,
    x.expense,
  ]);

  const maxValue = Math.max(
    ...values,
    1
  );

  const createPoints = (
    accessor: (item: MonthlyPoint) => number
  ) => {
    if (data.length === 0) return "";

    return data
      .map((item, index) => {
        const x =
          padding +
          (index /
            Math.max(data.length - 1, 1)) *
            (width - padding * 2);

        const y =
          height -
          padding -
          (accessor(item) / maxValue) *
            (height - padding * 2);

        return `${x},${y}`;
      })
      .join(" ");
  };

  const incomePoints = createPoints(
    (x) => x.income
  );

  const expensePoints = createPoints(
    (x) => x.expense
  );

  if (data.length === 0) {
    return (
      <div className="emptyChart">
        No monthly financial data available.
      </div>
    );
  }

  return (
    <div className="chartContainer">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y =
            padding +
            line *
              ((height - padding * 2) / 4);

          return (
            <line
              key={line}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="currentColor"
              opacity="0.08"
            />
          );
        })}

        <polyline
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={incomePoints}
        />

        <polyline
          fill="none"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={expensePoints}
        />

        {data.map((item, index) => {
          const x =
            padding +
            (index /
              Math.max(data.length - 1, 1)) *
              (width - padding * 2);

          return (
            <text
              key={item.month}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="currentColor"
              opacity="0.65"
            >
              {getMonthLabel(item.month)}
            </text>
          );
        })}
      </svg>

      <div className="chartLegend">
        <span>
          <i className="legendDot incomeDot" />
          Income
        </span>

        <span>
          <i className="legendDot expenseDot" />
          Expense
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   BAR CHART
========================================================= */

function CategoryChart({
  data,
}: {
  data: CategoryPoint[];
}) {
  const maxValue = Math.max(
    ...data.map((x) => x.value),
    1
  );

  if (!data.length) {
    return (
      <div className="emptyChart">
        No expense category data available.
      </div>
    );
  }

  return (
    <div className="categoryChart">
      {data.slice(0, 8).map((item) => {
        const width =
          (item.value / maxValue) * 100;

        return (
          <div
            className="barRow"
            key={item.name}
          >
            <div className="barLabel">
              <span>{item.name}</span>

              <strong>
                {money(item.value)}
              </strong>
            </div>

            <div className="barTrack">
              <div
                className="barFill"
                style={{
                  width: `${Math.max(
                    width,
                    2
                  )}%`,
                }}
              />
            </div>

            <div className="barMeta">
              {percent(item.percentage)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
   PAYMENT DISTRIBUTION
========================================================= */

function DistributionChart({
  title,
  data,
}: {
  title: string;
  data: PaymentPoint[];
}) {
  const total = data.reduce(
    (sum, item) =>
      sum + item.value,
    0
  );

  return (
    <div className="distributionCard">
      <h4>{title}</h4>

      {data.length === 0 ? (
        <p className="muted">
          No data available.
        </p>
      ) : (
        data.map((item) => {
          const ratio =
            total > 0
              ? (item.value / total) * 100
              : 0;

          return (
            <div
              className="distributionItem"
              key={item.name}
            >
              <div className="distributionTop">
                <span>{item.name}</span>

                <strong>
                  {money(item.value)}
                </strong>
              </div>

              <div className="distributionTrack">
                <div
                  className="distributionFill"
                  style={{
                    width: `${Math.max(
                      ratio,
                      2
                    )}%`,
                  }}
                />
              </div>

              <small>
                {percent(ratio)} of total
              </small>
            </div>
          );
        })
      )}
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function ReportsPage() {
  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [summary, setSummary] =
    useState<DashboardSummary>({
      totalIncome: 0,
      totalExpense: 0,
      totalTds: 0,
      totalNetExpense: 0,
      netPosition: 0,

      bankBalance: 0,
      pettyCashBalance: 0,
      totalAvailableFunds: 0,

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

      incomeCount: 0,
      expenseCount: 0,
      transferCount: 0,

      monthlyTrend: [],
      expenseCategories: [],
      incomeModes: [],
      expenseModes: [],
      alerts: [],

      averageMonthlyIncome: 0,
      averageMonthlyExpense: 0,
      savingsRate: 0,
      burnRate: 0,
      projectedMonthEndBalance: 0,
      largestExpenseCategory: "N/A",
      largestExpenseCategoryAmount: 0,
    });

  /* =====================================================
     LOAD ANALYTICS
  ===================================================== */

  const loadReports = async () => {
    setLoading(true);
    setMessage("");

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

      const allIncome =
        incomeResponse.data || [];

      const allExpenses =
        expenseResponse.data || [];

      const transfers =
        transferResponse.data || [];

      const bankAccount =
        bankResponse.data;

      const pettyCashAccount =
        pettyCashResponse.data;

      /*
       * -----------------------------------------------
       * FILTER FINANCIAL TRANSACTIONS
       * -----------------------------------------------
       */

      const incomes = allIncome.filter(
        (row: any) =>
          !row.status ||
          normalize(row.status) ===
            "cleared"
      );

      const expenses =
        allExpenses.filter(
          (row: any) =>
            !row.status ||
            normalize(row.status) ===
              "paid"
        );

      /*
       * -----------------------------------------------
       * INCOME
       * -----------------------------------------------
       */

      const totalIncome =
        incomes.reduce(
          (sum: number, row: any) =>
            sum +
            Number(row.amount || 0),
          0
        );

      const bankIncome =
        incomes
          .filter((row: any) => {
            const mode =
              normalize(row.mode);

            return (
              mode === "bank transfer" ||
              mode === "online" ||
              mode === "upi" ||
              mode === "cheque"
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const cashIncome =
        incomes
          .filter(
            (row: any) =>
              normalize(row.mode) ===
              "cash"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /*
       * -----------------------------------------------
       * EXPENSE
       * -----------------------------------------------
       */

      const totalExpense =
        expenses.reduce(
          (sum: number, row: any) =>
            sum +
            Number(
              row.gross_amount ||
                row.amount ||
                0
            ),
          0
        );

      const totalNetExpense =
        expenses.reduce(
          (sum: number, row: any) =>
            sum +
            getNetPayment(row),
          0
        );

      const totalTds =
        expenses.reduce(
          (sum: number, row: any) => {
            if (
              row.tds_amount !==
                null &&
              row.tds_amount !==
                undefined
            ) {
              return (
                sum +
                Number(
                  row.tds_amount ||
                    0
                )
              );
            }

            const gross =
              Number(
                row.gross_amount ||
                  0
              );

            const rate =
              Number(
                row.tds_rate ||
                  0
              );

            return (
              sum +
              gross * (rate / 100)
            );
          },
          0
        );

      const pettyCashExpense =
        expenses
          .filter(
            (row: any) =>
              normalize(
                row.payment_mode
              ) ===
              "petty cash"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              getNetPayment(row),
            0
          );

      const bankExpense =
        expenses
          .filter((row: any) => {
            const mode = normalize(
              row.payment_mode
            );

            return (
              mode === "bank transfer" ||
              mode === "online" ||
              mode === "upi" ||
              mode === "cheque"
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              getNetPayment(row),
            0
          );

      /*
       * -----------------------------------------------
       * FUND TRANSFERS
       * IMPORTANT:
       * No "status" column is used here.
       * -----------------------------------------------
       */

      const bankToPettyCash =
        transfers
          .filter((row: any) => {
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
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const pettyCashToBank =
        transfers
          .filter((row: any) => {
            const type = String(
              row.type || ""
            ).trim();

            return (
              type ===
                "Petty Cash to Bank" ||
              type ===
                "Cash Deposit" ||
              type === "Deposit" ||
              type ===
                "Petty Cash Deposit" ||
              type ===
                "Return to Bank"
            );
          })
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const bankAdjustmentCredit =
        transfers
          .filter(
            (row: any) =>
              row.type ===
                "Bank Adjustment" &&
              row.direction ===
                "IN"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const bankAdjustmentDebit =
        transfers
          .filter(
            (row: any) =>
              row.type ===
                "Bank Adjustment" &&
              row.direction ===
                "OUT"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const cashAdjustmentCredit =
        transfers
          .filter(
            (row: any) =>
              (
                row.type ===
                  "Cash Adjustment" ||
                row.type ===
                  "Cash Adjustment +"
              ) &&
              row.direction ===
                "IN"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      const cashAdjustmentDebit =
        transfers
          .filter(
            (row: any) =>
              (
                row.type ===
                  "Cash Adjustment" ||
                row.type ===
                  "Cash Adjustment -"
              ) &&
              row.direction ===
                "OUT"
          )
          .reduce(
            (sum: number, row: any) =>
              sum +
              Number(row.amount || 0),
            0
          );

      /*
       * -----------------------------------------------
       * CURRENT FINANCIAL POSITION
       * -----------------------------------------------
       */

      const bankBalance =
        Number(
          bankAccount?.opening_balance ||
            0
        ) +
        bankIncome -
        bankExpense -
        bankToPettyCash +
        pettyCashToBank +
        bankAdjustmentCredit -
        bankAdjustmentDebit;

      const pettyCashBalance =
        Number(
          pettyCashAccount?.opening_balance ||
            0
        ) +
        cashIncome +
        bankToPettyCash -
        pettyCashExpense -
        pettyCashToBank +
        cashAdjustmentCredit -
        cashAdjustmentDebit;

      const totalAvailableFunds =
        bankBalance +
        pettyCashBalance;

      /*
       * -----------------------------------------------
       * MONTHLY TREND
       * -----------------------------------------------
       */

      const monthMap = new Map<
        string,
        MonthlyPoint
      >();

      incomes.forEach(
        (row: any) => {
          const key = getMonthKey(
            row.income_date ||
              row.date ||
              row.created_at
          );

          if (
            !monthMap.has(key)
          ) {
            monthMap.set(key, {
              month: key,
              income: 0,
              expense: 0,
              net: 0,
            });
          }

          const item =
            monthMap.get(key)!;

          item.income += Number(
            row.amount || 0
          );
        }
      );

      expenses.forEach(
        (row: any) => {
          const key = getMonthKey(
            row.expense_date ||
              row.date ||
              row.created_at
          );

          if (
            !monthMap.has(key)
          ) {
            monthMap.set(key, {
              month: key,
              income: 0,
              expense: 0,
              net: 0,
            });
          }

          const item =
            monthMap.get(key)!;

          item.expense +=
            getNetPayment(row);
        }
      );

      const monthlyTrend =
        Array.from(
          monthMap.values()
        )
          .map((item) => ({
            ...item,
            net:
              item.income -
              item.expense,
          }))
          .sort((a, b) =>
            a.month.localeCompare(
              b.month
            )
          )
          .slice(-12);

      /*
       * -----------------------------------------------
       * EXPENSE CATEGORY ANALYSIS
       * -----------------------------------------------
       */

      const categoryMap =
        new Map<string, number>();

      expenses.forEach(
        (row: any) => {
          const category =
            getCategory(row);

          const current =
            categoryMap.get(category) ||
            0;

          categoryMap.set(
            category,
            current +
              getNetPayment(row)
          );
        }
      );

      const expenseCategories =
        Array.from(
          categoryMap.entries()
        )
          .map(([name, value]) => ({
            name,
            value,
            percentage:
              totalNetExpense > 0
                ? (value /
                    totalNetExpense) *
                  100
                : 0,
          }))
          .sort(
            (a, b) =>
              b.value - a.value
          );

      /*
       * -----------------------------------------------
       * INCOME PAYMENT MODE ANALYSIS
       * -----------------------------------------------
       */

      const incomeModeMap =
        new Map<string, number>();

      incomes.forEach(
        (row: any) => {
          const mode =
            row.mode ||
            "Unspecified";

          incomeModeMap.set(
            mode,
            (incomeModeMap.get(
              mode
            ) || 0) +
              Number(
                row.amount || 0
              )
          );
        }
      );

      const incomeModes =
        Array.from(
          incomeModeMap.entries()
        )
          .map(
            ([name, value]) => ({
              name,
              value,
            })
          )
          .sort(
            (a, b) =>
              b.value - a.value
          );

      /*
       * -----------------------------------------------
       * EXPENSE PAYMENT MODE ANALYSIS
       * -----------------------------------------------
       */

      const expenseModeMap =
        new Map<string, number>();

      expenses.forEach(
        (row: any) => {
          const mode =
            row.payment_mode ||
            "Unspecified";

          expenseModeMap.set(
            mode,
            (expenseModeMap.get(
              mode
            ) || 0) +
              getNetPayment(row)
          );
        }
      );

      const expenseModes =
        Array.from(
          expenseModeMap.entries()
        )
          .map(
            ([name, value]) => ({
              name,
              value,
            })
          )
          .sort(
            (a, b) =>
              b.value - a.value
          );

      /*
       * -----------------------------------------------
       * DESCRIPTIVE / DIAGNOSTIC / PREDICTIVE
       * -----------------------------------------------
       */

      const activeMonths =
        Math.max(
          monthlyTrend.length,
          1
        );

      const averageMonthlyIncome =
        totalIncome / activeMonths;

      const averageMonthlyExpense =
        totalNetExpense /
        activeMonths;

      const savingsRate =
        totalIncome > 0
          ? ((totalIncome -
              totalNetExpense) /
              totalIncome) *
            100
          : 0;

      const burnRate =
        averageMonthlyExpense;

      const projectedMonthEndBalance =
        totalAvailableFunds +
        averageMonthlyIncome -
        averageMonthlyExpense;

      const largestCategory =
        expenseCategories[0];

      /*
       * -----------------------------------------------
       * INTELLIGENT NOTIFICATIONS
       * -----------------------------------------------
       */

      const alerts: AlertItem[] =
        [];

      if (
        totalIncome >
        totalNetExpense
      ) {
        alerts.push({
          id: "positive-cashflow",
          level: "success",
          title:
            "Positive Financial Position",
          description: `Income exceeds expenditure by ${money(
            totalIncome -
              totalNetExpense
          )}.`,
        });
      } else if (
        totalNetExpense >
        totalIncome
      ) {
        alerts.push({
          id: "negative-cashflow",
          level: "danger",
          title:
            "Negative Cash Flow Alert",
          description: `Expenses currently exceed income by ${money(
            totalNetExpense -
              totalIncome
          )}.`,
        });
      }

      if (
        pettyCashBalance <
        averageMonthlyExpense *
          0.1
      ) {
        alerts.push({
          id: "low-petty-cash",
          level: "warning",
          title:
            "Low Petty Cash Reserve",
          description:
            "Petty cash is below the recommended operating buffer.",
        });
      }

      if (
        largestCategory &&
        largestCategory.percentage >
          40
      ) {
        alerts.push({
          id: "expense-concentration",
          level: "warning",
          title:
            "High Expense Concentration",
          description: `${largestCategory.name} represents ${percent(
            largestCategory.percentage
          )} of total expenditure.`,
        });
      }

      if (
        savingsRate >= 20
      ) {
        alerts.push({
          id: "healthy-savings",
          level: "success",
          title:
            "Healthy Financial Efficiency",
          description: `Current surplus ratio is ${percent(
            savingsRate
          )}.`,
        });
      } else if (
        savingsRate <
        10
      ) {
        alerts.push({
          id: "low-savings",
          level: "info",
          title:
            "Surplus Improvement Opportunity",
          description:
            "Review high-value expense categories and improve the available operating surplus.",
        });
      }

      /*
       * -----------------------------------------------
       * UPDATE STATE
       * -----------------------------------------------
       */

      setSummary({
        totalIncome,
        totalExpense,
        totalTds,
        totalNetExpense,

        netPosition:
          totalIncome -
          totalNetExpense,

        bankBalance,
        pettyCashBalance,
        totalAvailableFunds,

        bankIncome,
        cashIncome,

        bankExpense,
        pettyCashExpense,

        bankToPettyCash,
        pettyCashToBank,

        bankAdjustmentCredit,
        bankAdjustmentDebit,
        cashAdjustmentCredit,
        cashAdjustmentDebit,

        incomeCount:
          incomes.length,

        expenseCount:
          expenses.length,

        transferCount:
          transfers.length,

        monthlyTrend,
        expenseCategories,
        incomeModes,
        expenseModes,
        alerts,

        averageMonthlyIncome,
        averageMonthlyExpense,
        savingsRate,
        burnRate,
        projectedMonthEndBalance,

        largestExpenseCategory:
          largestCategory?.name ||
          "N/A",

        largestExpenseCategoryAmount:
          largestCategory?.value ||
          0,
      });

      setLastUpdated(
        new Date()
      );
    } catch (error: any) {
      console.error(error);

      setMessage(
        error?.message ||
          "Unable to load financial analytics."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  /*
   * -----------------------------------------------
   * ANALYTICAL INSIGHTS
   * -----------------------------------------------
   */

  const insights = useMemo(() => {
    const descriptive =
      summary.totalIncome === 0 &&
      summary.totalNetExpense === 0
        ? "Financial transaction data is not yet available for analysis."
        : `GPCC has recorded total income of ${money(
            summary.totalIncome
          )} and net expenditure of ${money(
            summary.totalNetExpense
          )}.`;

    const diagnostic =
      summary.largestExpenseCategory ===
      "N/A"
        ? "Expense category concentration cannot yet be determined."
        : `${summary.largestExpenseCategory} is currently the largest expense category at ${money(
            summary.largestExpenseCategoryAmount
          )}.`;

    const predictive =
      `Based on the current average monthly financial pattern, the projected next-cycle fund position is approximately ${money(
        summary.projectedMonthEndBalance
      )}.`;

    const prescriptive =
      summary.savingsRate < 10
        ? "Prioritise expense optimisation and review the largest expense categories before additional discretionary spending."
        : summary.savingsRate < 25
        ? "Maintain current financial controls while monitoring high-value expenditure categories."
        : "The current financial position is healthy. Consider maintaining a reserve buffer and documenting successful cost-control practices.";

    return {
      descriptive,
      diagnostic,
      predictive,
      prescriptive,
    };
  }, [summary]);

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Financial Intelligence...
        </h2>

        <p className="muted">
          Analysing GPCC financial
          transactions, trends and
          control indicators.
        </p>
      </div>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <>
      {/* ===============================================
          HEADER
      ================================================ */}

      <div className="pageHead">
        <div>
          <h1>
            Reports & Analytics
          </h1>

          <p className="muted">
            GPCC Financial Intelligence Centre
          </p>

          {lastUpdated && (
            <small className="muted">
              Last updated:{" "}
              {lastUpdated.toLocaleString(
                "en-IN"
              )}
            </small>
          )}
        </div>

        <button
          className="btn secondary"
          onClick={loadReports}
        >
          Refresh Analytics
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

      {/* ===============================================
          EXECUTIVE KPI CARDS
      ================================================ */}

      <div className="grid">
        <div className="card">
          <div className="muted">
            Total Income
          </div>

          <div className="metric">
            {money(
              summary.totalIncome
            )}
          </div>

          <small className="metricHint">
            {
              summary.incomeCount
            } income transactions
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Net Expenditure
          </div>

          <div className="metric">
            {money(
              summary.totalNetExpense
            )}
          </div>

          <small className="metricHint">
            {
              summary.expenseCount
            } expense transactions
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Available Funds
          </div>

          <div className="metric">
            {money(
              summary.totalAvailableFunds
            )}
          </div>

          <small className="metricHint">
            Bank + Petty Cash
          </small>
        </div>

        <div className="card">
          <div className="muted">
            Net Financial Position
          </div>

          <div className="metric">
            {money(
              summary.netPosition
            )}
          </div>

          <small className="metricHint">
            Income − Net Expense
          </small>
        </div>
      </div>

      {/* ===============================================
          FUND HEALTH
      ================================================ */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Financial Health Scorecard
          </h3>

          <div className="healthGrid">
            <div className="healthItem">
              <span>
                Savings Rate
              </span>

              <strong>
                {percent(
                  summary.savingsRate
                )}
              </strong>
            </div>

            <div className="healthItem">
              <span>
                Monthly Burn Rate
              </span>

              <strong>
                {money(
                  summary.burnRate
                )}
              </strong>
            </div>

            <div className="healthItem">
              <span>
                Bank Position
              </span>

              <strong>
                {money(
                  summary.bankBalance
                )}
              </strong>
            </div>

            <div className="healthItem">
              <span>
                Petty Cash
              </span>

              <strong>
                {money(
                  summary.pettyCashBalance
                )}
              </strong>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>
            Predictive Outlook
          </h3>

          <div className="forecastMetric">
            <div className="muted">
              Projected Fund Position
            </div>

            <div className="metric">
              {money(
                summary.projectedMonthEndBalance
              )}
            </div>

            <p className="muted">
              Projection based on the
              observed average income and
              expenditure pattern.
            </p>
          </div>
        </div>
      </div>

      {/* ===============================================
          TREND ANALYSIS
      ================================================ */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <div className="sectionHead">
          <div>
            <h3>
              Income vs Expense Trend
            </h3>

            <p className="muted">
              Monthly financial movement
              across available GPCC data.
            </p>
          </div>
        </div>

        <TrendChart
          data={
            summary.monthlyTrend
          }
        />
      </div>

      {/* ===============================================
          CATEGORY ANALYSIS
      ================================================ */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Expense Intelligence
          </h3>

          <p className="muted">
            Highest financial consumption
            areas.
          </p>

          <CategoryChart
            data={
              summary.expenseCategories
            }
          />
        </div>

        <div className="card">
          <h3>
            Transaction Channels
          </h3>

          <DistributionChart
            title="Income Distribution"
            data={
              summary.incomeModes
            }
          />

          <div
            style={{
              height: 20,
            }}
          />

          <DistributionChart
            title="Expense Distribution"
            data={
              summary.expenseModes
            }
          />
        </div>
      </div>

      {/* ===============================================
          FOUR DIMENSION ANALYTICS
      ================================================ */}

      <div
        className="analysisGrid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="analysisCard descriptive">
          <div className="analysisTag">
            DESCRIPTIVE
          </div>

          <h3>
            What Happened?
          </h3>

          <p>
            {insights.descriptive}
          </p>
        </div>

        <div className="analysisCard diagnostic">
          <div className="analysisTag">
            DIAGNOSTIC
          </div>

          <h3>
            Why Did It Happen?
          </h3>

          <p>
            {insights.diagnostic}
          </p>
        </div>

        <div className="analysisCard predictive">
          <div className="analysisTag">
            PREDICTIVE
          </div>

          <h3>
            What May Happen Next?
          </h3>

          <p>
            {insights.predictive}
          </p>
        </div>

        <div className="analysisCard prescriptive">
          <div className="analysisTag">
            PRESCRIPTIVE
          </div>

          <h3>
            What Should GPCC Do?
          </h3>

          <p>
            {insights.prescriptive}
          </p>
        </div>
      </div>

      {/* ===============================================
          NOTIFICATION CENTRE
      ================================================ */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <div className="sectionHead">
          <div>
            <h3>
              Financial Notification Centre
            </h3>

            <p className="muted">
              Automated financial control
              signals and recommendations.
            </p>
          </div>

          <span className="notificationCount">
            {
              summary.alerts.length
            } Signals
          </span>
        </div>

        {summary.alerts.length ===
        0 ? (
          <div className="emptyChart">
            No critical financial
            notifications at this time.
          </div>
        ) : (
          <div className="alertList">
            {summary.alerts.map(
              (alert) => (
                <div
                  className={`alertItem ${alert.level}`}
                  key={alert.id}
                >
                  <div className="alertContent">
                    <strong>
                      {alert.title}
                    </strong>

                    <p>
                      {
                        alert.description
                      }
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ===============================================
          FINANCIAL CONTROL DETAIL
      ================================================ */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Fund Movement
          </h3>

          <div className="tableWrap">
            <table className="table">
              <tbody>
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

                <tr>
                  <td>
                    Bank Adjustments
                  </td>

                  <td>
                    {money(
                      summary.bankAdjustmentCredit -
                        summary.bankAdjustmentDebit
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Cash Adjustments
                  </td>

                  <td>
                    {money(
                      summary.cashAdjustmentCredit -
                        summary.cashAdjustmentDebit
                    )}
                  </td>
                </tr>

                <tr>
                  <th>
                    Transfer Transactions
                  </th>

                  <th>
                    {number(
                      summary.transferCount
                    )}
                  </th>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>
            Tax & Expenditure Control
          </h3>

          <div className="tableWrap">
            <table className="table">
              <tbody>
                <tr>
                  <td>
                    Gross Expense
                  </td>

                  <td>
                    {money(
                      summary.totalExpense
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Total TDS
                  </td>

                  <td>
                    {money(
                      summary.totalTds
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Net Payment
                  </td>

                  <td>
                    {money(
                      summary.totalNetExpense
                    )}
                  </td>
                </tr>

                <tr>
                  <td>
                    Largest Expense Area
                  </td>

                  <td>
                    {
                      summary.largestExpenseCategory
                    }
                  </td>
                </tr>

                <tr>
                  <th>
                    Largest Category Value
                  </th>

                  <th>
                    {money(
                      summary.largestExpenseCategoryAmount
                    )}
                  </th>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===============================================
          CONTROL FOOTER
      ================================================ */}

      <div
        className="card"
        style={{
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <h3>
          GPCC Financial Intelligence Summary
        </h3>

        <p className="muted">
          This analytics layer combines
          descriptive, diagnostic,
          predictive and prescriptive
          analysis from GPCC income,
          expenditure, TDS, fund transfer,
          bank and petty cash data.
        </p>

        <p className="muted">
          Internal transfers between Bank
          and Petty Cash change fund
          location but do not change total
          available GPCC funds.
        </p>
      </div>
    </>
  );
}