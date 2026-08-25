"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

import {
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

import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  PieChart as PieChartIcon,
  TrendingUp,
} from "lucide-react";

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

const getDate = (row: any) =>
  row.transaction_date ||
  row.date ||
  row.expense_date ||
  row.income_date ||
  row.created_at;

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
   REPORTS & ANALYTICS
========================================================= */

export default function ReportsAnalytics() {
  const [loading, setLoading] =
    useState(true);

  const [msg, setMsg] = useState("");

  const [incomes, setIncomes] =
    useState<any[]>([]);

  const [expenses, setExpenses] =
    useState<any[]>([]);

  const [period, setPeriod] =
    useState("all");

  /* =========================================================
     LOAD DATA
  ========================================================= */

  const loadData = async () => {
    setLoading(true);
    setMsg("");

    try {
      const [
        incomeResult,
        expenseResult,
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

      setIncomes(
        incomeResult.data || []
      );

      setExpenses(
        expenseResult.data || []
      );
    } catch (error: any) {
      console.error(error);

      setMsg(
        error?.message ||
          "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     PERIOD FILTER
  ========================================================= */

  const filterByPeriod = (
    rows: any[]
  ) => {
    if (period === "all") {
      return rows;
    }

    const now = new Date();

    let months = 12;

    if (period === "3m") months = 3;
    if (period === "6m") months = 6;
    if (period === "12m") months = 12;

    const start = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1
    );

    return rows.filter((row) => {
      const date = new Date(
        getDate(row)
      );

      return date >= start;
    });
  };

  const filteredIncome = useMemo(
    () =>
      filterByPeriod(incomes),
    [incomes, period]
  );

  const filteredExpenses = useMemo(
    () =>
      filterByPeriod(expenses),
    [expenses, period]
  );

  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary = useMemo(() => {
    const income = filteredIncome.reduce(
      (sum, row) =>
        sum + Number(row.amount || 0),
      0
    );

    const expense =
      filteredExpenses.reduce(
        (sum, row) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

    const tds =
      filteredExpenses.reduce(
        (sum, row) => {
          const gross = Number(
            row.gross_amount || 0
          );

          const value =
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

          return sum + value;
        },
        0
      );

    return {
      income,
      expense,
      tds,
      net: income - expense,
    };
  }, [
    filteredIncome,
    filteredExpenses,
  ]);

  /* =========================================================
     MONTHLY TREND
  ========================================================= */

  const monthlyTrend = useMemo(() => {
    const map: Record<
      string,
      any
    > = {};

    filteredIncome.forEach((row) => {
      const key = monthKey(
        getDate(row)
      );

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

    filteredExpenses.forEach(
      (row) => {
        const key = monthKey(
          getDate(row)
        );

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
      }
    );

    return Object.entries(map)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([, value]) => ({
        ...value,
        net:
          value.income -
          value.expense,
      }));
  }, [
    filteredIncome,
    filteredExpenses,
  ]);

  /* =========================================================
     EXPENSE CATEGORY ANALYSIS
  ========================================================= */

  const expenseCategoryData =
    useMemo(() => {
      const map: Record<
        string,
        number
      > = {};

      filteredExpenses.forEach(
        (row) => {
          const category =
            row.category ||
            row.expense_category ||
            "Uncategorised";

          map[category] =
            (map[category] || 0) +
            Number(
              row.gross_amount || 0
            );
        }
      );

      return Object.entries(map)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        )
        .slice(0, 8);
    }, [filteredExpenses]);

  /* =========================================================
     INCOME SOURCE ANALYSIS
  ========================================================= */

  const incomeSourceData =
    useMemo(() => {
      const map: Record<
        string,
        number
      > = {};

      filteredIncome.forEach(
        (row) => {
          const source =
            row.category ||
            row.source ||
            row.income_category ||
            "Other";

          map[source] =
            (map[source] || 0) +
            Number(row.amount || 0);
        }
      );

      return Object.entries(map)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        );
    }, [filteredIncome]);

  /* =========================================================
     PAYMENT MODE
  ========================================================= */

  const paymentModeData =
    useMemo(() => {
      const map: Record<
        string,
        number
      > = {};

      filteredExpenses.forEach(
        (row) => {
          const mode =
            row.payment_mode ||
            "Unknown";

          map[mode] =
            (map[mode] || 0) +
            Number(
              row.gross_amount || 0
            );
        }
      );

      return Object.entries(map)
        .map(([name, value]) => ({
          name,
          value,
        }))
        .sort(
          (a, b) =>
            b.value - a.value
        );
    }, [filteredExpenses]);

  /* =========================================================
     VENDOR ANALYSIS
  ========================================================= */

  const vendorData = useMemo(() => {
    const map: Record<
      string,
      number
    > = {};

    filteredExpenses.forEach((row) => {
      const vendor =
        row.vendor_name ||
        row.vendor ||
        row.payee ||
        "Unknown";

      map[vendor] =
        (map[vendor] || 0) +
        Number(
          row.gross_amount || 0
        );
    });

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      )
      .slice(0, 10);
  }, [filteredExpenses]);

  /* =========================================================
     TDS ANALYSIS
  ========================================================= */

  const tdsData = useMemo(() => {
    const map: Record<
      string,
      number
    > = {};

    filteredExpenses.forEach((row) => {
      const date = getDate(row);

      const key = monthKey(date);

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

      map[key] =
        (map[key] || 0) + tds;
    });

    return Object.entries(map)
      .sort(([a], [b]) =>
        a.localeCompare(b)
      )
      .map(([key, value]) => ({
        month: monthLabel(key),
        tds: value,
      }));
  }, [filteredExpenses]);

  /* =========================================================
     TOP EXPENSES
  ========================================================= */

  const topExpenses = useMemo(() => {
    return [...filteredExpenses]
      .sort(
        (a, b) =>
          Number(
            b.gross_amount || 0
          ) -
          Number(
            a.gross_amount || 0
          )
      )
      .slice(0, 10);
  }, [filteredExpenses]);

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Reports & Analytics...
        </h2>
      </div>
    );
  }

  return (
    <div className="reportsAnalytics">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="pageHead analyticsHeader">
        <div>
          <div className="dashboardEyebrow">
            GPCC ANALYTICS STUDIO
          </div>

          <h1>
            Reports & Analytics
          </h1>

          <p className="muted">
            Explore historical financial
            performance, categories, vendors,
            payment behaviour and TDS trends.
          </p>
        </div>

        <div className="reportActions">
          <button
            className="btn secondary"
            onClick={loadData}
          >
            <TrendingUp size={16} />
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div className="dashboardError">
          {msg}
        </div>
      )}

      {/* =====================================================
          FILTER BAR
      ====================================================== */}

      <div className="analyticsFilterBar">
        <div className="filterLabel">
          <Filter size={18} />

          Analysis Period
        </div>

        <select
          className="input"
          value={period}
          onChange={(e) =>
            setPeriod(e.target.value)
          }
        >
          <option value="all">
            All Available Data
          </option>

          <option value="3m">
            Last 3 Months
          </option>

          <option value="6m">
            Last 6 Months
          </option>

          <option value="12m">
            Last 12 Months
          </option>
        </select>
      </div>

      {/* =====================================================
          ANALYTICAL KPIs
      ====================================================== */}

      <div className="analyticsKpiGrid">
        <div className="analyticsKpi">
          <span>
            Total Income
          </span>

          <strong>
            {money(summary.income)}
          </strong>
        </div>

        <div className="analyticsKpi">
          <span>
            Total Expenses
          </span>

          <strong>
            {money(summary.expense)}
          </strong>
        </div>

        <div className="analyticsKpi">
          <span>
            Net Surplus / Deficit
          </span>

          <strong>
            {money(summary.net)}
          </strong>
        </div>

        <div className="analyticsKpi">
          <span>
            Total TDS
          </span>

          <strong>
            {money(summary.tds)}
          </strong>
        </div>
      </div>

      {/* =====================================================
          FINANCIAL TREND
      ====================================================== */}

      <div className="analyticsChartCard fullWidth">
        <div className="analyticsChartHeader">
          <div>
            <div className="sectionEyebrow">
              HISTORICAL TREND
            </div>

            <h2>
              Income, Expense & Net Position
            </h2>
          </div>

          <BarChart3 size={22} />
        </div>

        <div className="analyticsLargeChart">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart
              data={monthlyTrend}
            >
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

              <Legend />

              <Line
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                strokeWidth={3}
              />

              <Line
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={3}
              />

              <Line
                type="monotone"
                dataKey="net"
                stroke="#6366f1"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =====================================================
          CATEGORY + INCOME SOURCE
      ====================================================== */}

      <div className="analyticsTwoColumn">
        <div className="analyticsChartCard">
          <div className="analyticsChartHeader">
            <div>
              <div className="sectionEyebrow">
                EXPENSE STRUCTURE
              </div>

              <h2>
                Expense by Category
              </h2>
            </div>

            <PieChartIcon size={22} />
          </div>

          <div className="analyticsMediumChart">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={
                    expenseCategoryData
                  }
                  dataKey="value"
                  nameKey="name"
                  outerRadius={115}
                >
                  {expenseCategoryData.map(
                    (_, index) => (
                      <Cell
                        key={index}
                        fill={
                          [
                            "#6366f1",
                            "#10b981",
                            "#f59e0b",
                            "#ef4444",
                            "#06b6d4",
                            "#8b5cf6",
                            "#ec4899",
                            "#64748b",
                          ][index % 8]
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
        </div>

        <div className="analyticsChartCard">
          <div className="analyticsChartHeader">
            <div>
              <div className="sectionEyebrow">
                INCOME MIX
              </div>

              <h2>
                Income by Source
              </h2>
            </div>

            <TrendingUp size={22} />
          </div>

          <div className="analyticsMediumChart">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={incomeSourceData}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis type="number" />

                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value || 0)
                    )
                  }
                />

                <Bar
                  dataKey="value"
                  fill="#10b981"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =====================================================
          PAYMENT + VENDOR
      ====================================================== */}

      <div className="analyticsTwoColumn">
        <div className="analyticsChartCard">
          <div className="analyticsChartHeader">
            <div>
              <div className="sectionEyebrow">
                PAYMENT BEHAVIOUR
              </div>

              <h2>
                Expense by Payment Mode
              </h2>
            </div>
          </div>

          <div className="analyticsMediumChart">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={paymentModeData}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                />

                <YAxis />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value || 0)
                    )
                  }
                />

                <Bar
                  dataKey="value"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="analyticsChartCard">
          <div className="analyticsChartHeader">
            <div>
              <div className="sectionEyebrow">
                VENDOR ANALYSIS
              </div>

              <h2>
                Top Expense Recipients
              </h2>
            </div>
          </div>

          <div className="analyticsMediumChart">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={vendorData}
                layout="vertical"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                />

                <XAxis type="number" />

                <YAxis
                  dataKey="name"
                  type="category"
                  width={130}
                />

                <Tooltip
                  formatter={(value) =>
                    money(
                      Number(value || 0)
                    )
                  }
                />

                <Bar
                  dataKey="value"
                  fill="#f59e0b"
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =====================================================
          TDS TREND
      ====================================================== */}

      <div className="analyticsChartCard fullWidth">
        <div className="analyticsChartHeader">
          <div>
            <div className="sectionEyebrow">
              TAX ANALYTICS
            </div>

            <h2>
              TDS Trend
            </h2>
          </div>
        </div>

        <div className="analyticsLargeChart">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart data={tdsData}>
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

              <Bar
                dataKey="tds"
                fill="#ef4444"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =====================================================
          TOP EXPENSE TRANSACTIONS
      ====================================================== */}

      <div className="analyticsTableCard">
        <div className="analyticsChartHeader">
          <div>
            <div className="sectionEyebrow">
              TRANSACTION ANALYSIS
            </div>

            <h2>
              Top Expense Transactions
            </h2>
          </div>

          <FileSpreadsheet size={22} />
        </div>

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>
                  Date
                </th>

                <th>
                  Vendor / Payee
                </th>

                <th>
                  Category
                </th>

                <th>
                  Payment Mode
                </th>

                <th>
                  Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {topExpenses.map(
                (row, index) => (
                  <tr key={index}>
                    <td>
                      {getDate(row)
                        ? new Date(
                            getDate(row)
                          ).toLocaleDateString(
                            "en-IN"
                          )
                        : "-"}
                    </td>

                    <td>
                      {row.vendor_name ||
                        row.vendor ||
                        row.payee ||
                        "-"}
                    </td>

                    <td>
                      {row.category ||
                        row.expense_category ||
                        "-"}
                    </td>

                    <td>
                      {row.payment_mode ||
                        "-"}
                    </td>

                    <td>
                      <strong>
                        {money(
                          Number(
                            row.gross_amount ||
                              0
                          )
                        )}
                      </strong>
                    </td>
                  </tr>
                )
              )}

              {!topExpenses.length && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                    }}
                  >
                    No expense transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}