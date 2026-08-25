"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

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

type IncomeRow = {
  id: string;
  amount: number;
  mode?: string;
  date?: string;
  income_date?: string;
  created_at?: string;
  category?: string;
  source?: string;
  status?: string;
};

type ExpenseRow = {
  id: string;
  gross_amount?: number;
  net_amount?: number;
  tds_amount?: number;
  tds_rate?: number;
  payment_mode?: string;
  date?: string;
  expense_date?: string;
  created_at?: string;
  category?: string;
  expense_category?: string;
  status?: string;
};

type TransferRow = {
  id: string;
  amount: number;
  type?: string;
  direction?: string;
  date?: string;
  transfer_date?: string;
  created_at?: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const number = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const getDate = (row: any) =>
  row.date ||
  row.income_date ||
  row.expense_date ||
  row.transfer_date ||
  row.created_at ||
  "";

const getMonthKey = (dateValue: string) => {
  if (!dateValue) return "Unknown";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Unknown";

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

export default function ReportsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [incomeData, setIncomeData] =
    useState<IncomeRow[]>([]);

  const [expenseData, setExpenseData] =
    useState<ExpenseRow[]>([]);

  const [transferData, setTransferData] =
    useState<TransferRow[]>([]);

  const [bankAccount, setBankAccount] =
    useState<BankAccount | null>(null);

  const [pettyCashAccount, setPettyCashAccount] =
    useState<PettyCashAccount | null>(null);

  const [period, setPeriod] =
    useState("ALL");

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

      if (incomeResponse.error)
        throw new Error(
          incomeResponse.error.message
        );

      if (expenseResponse.error)
        throw new Error(
          expenseResponse.error.message
        );

      if (transferResponse.error)
        throw new Error(
          transferResponse.error.message
        );

      if (bankResponse.error)
        throw new Error(
          bankResponse.error.message
        );

      if (pettyCashResponse.error)
        throw new Error(
          pettyCashResponse.error.message
        );

      setIncomeData(
        (incomeResponse.data || []) as IncomeRow[]
      );

      setExpenseData(
        (expenseResponse.data || []) as ExpenseRow[]
      );

      setTransferData(
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
      setMessage(
        error?.message ||
          "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const filteredIncome = useMemo(() => {
    if (period === "ALL") return incomeData;

    const now = new Date();

    return incomeData.filter((row) => {
      const rowDate = new Date(getDate(row));

      if (Number.isNaN(rowDate.getTime()))
        return true;

      if (period === "YEAR") {
        return (
          rowDate.getFullYear() ===
          now.getFullYear()
        );
      }

      if (period === "MONTH") {
        return (
          rowDate.getFullYear() ===
            now.getFullYear() &&
          rowDate.getMonth() ===
            now.getMonth()
        );
      }

      return true;
    });
  }, [incomeData, period]);

  const filteredExpenses = useMemo(() => {
    if (period === "ALL") return expenseData;

    const now = new Date();

    return expenseData.filter((row) => {
      const rowDate = new Date(getDate(row));

      if (Number.isNaN(rowDate.getTime()))
        return true;

      if (period === "YEAR") {
        return (
          rowDate.getFullYear() ===
          now.getFullYear()
        );
      }

      if (period === "MONTH") {
        return (
          rowDate.getFullYear() ===
            now.getFullYear() &&
          rowDate.getMonth() ===
            now.getMonth()
        );
      }

      return true;
    });
  }, [expenseData, period]);

  const analytics = useMemo(() => {
    const totalIncome =
      filteredIncome.reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const grossExpense =
      filteredExpenses.reduce(
        (sum, row) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

    const netExpense =
      filteredExpenses.reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const totalTds =
      filteredExpenses.reduce(
        (sum, row) => {
          const tds =
            row.tds_amount !== null &&
            row.tds_amount !== undefined
              ? Number(
                  row.tds_amount || 0
                )
              : Number(
                  row.gross_amount || 0
                ) *
                (Number(row.tds_rate || 0) /
                  100);

          return sum + tds;
        },
        0
      );

    const bankIncome =
      filteredIncome
        .filter((row) => {
          const mode = String(
            row.mode || ""
          )
            .trim()
            .toLowerCase();

          return [
            "cheque",
            "online",
            "bank transfer",
            "upi",
          ].includes(mode);
        })
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const cashIncome =
      filteredIncome
        .filter((row) => {
          return (
            String(
              row.mode || ""
            )
              .trim()
              .toLowerCase() === "cash"
          );
        })
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const bankExpense =
      filteredExpenses
        .filter((row) => {
          const mode = String(
            row.payment_mode || ""
          )
            .trim()
            .toLowerCase();

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
        .filter((row) => {
          return (
            String(
              row.payment_mode || ""
            )
              .trim()
              .toLowerCase() ===
            "petty cash"
          );
        })
        .reduce(
          (sum, row) =>
            sum + getNetPayment(row),
          0
        );

    const bankToPettyCash =
      transferData
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
            sum + Number(row.amount || 0),
          0
        );

    const pettyCashToBank =
      transferData
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
            sum + Number(row.amount || 0),
          0
        );

    const bankAdjustmentCredit =
      transferData
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "IN"
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const bankAdjustmentDebit =
      transferData
        .filter(
          (row) =>
            row.type ===
              "Bank Adjustment" &&
            row.direction === "OUT"
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const cashAdjustmentCredit =
      transferData
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
            sum + Number(row.amount || 0),
          0
        );

    const cashAdjustmentDebit =
      transferData
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
            sum + Number(row.amount || 0),
          0
        );

    const currentBank =
      Number(
        bankAccount?.opening_balance || 0
      ) +
      bankIncome -
      bankExpense -
      bankToPettyCash +
      pettyCashToBank +
      bankAdjustmentCredit -
      bankAdjustmentDebit;

    const currentPettyCash =
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

    const availableFunds =
      currentBank + currentPettyCash;

    const surplus =
      totalIncome - grossExpense;

    const expenseRatio =
      totalIncome > 0
        ? (grossExpense / totalIncome) *
          100
        : 0;

    const savingsRatio =
      totalIncome > 0
        ? (surplus / totalIncome) * 100
        : 0;

    return {
      totalIncome,
      grossExpense,
      netExpense,
      totalTds,

      bankIncome,
      cashIncome,

      bankExpense,
      pettyCashExpense,

      currentBank,
      currentPettyCash,
      availableFunds,

      surplus,
      expenseRatio,
      savingsRatio,
    };
  }, [
    filteredIncome,
    filteredExpenses,
    transferData,
    bankAccount,
    pettyCashAccount,
  ]);

  const monthlyData = useMemo(() => {
    const months: Record<
      string,
      {
        income: number;
        expense: number;
      }
    > = {};

    filteredIncome.forEach((row) => {
      const key = getMonthKey(
        getDate(row)
      );

      if (!months[key]) {
        months[key] = {
          income: 0,
          expense: 0,
        };
      }

      months[key].income += Number(
        row.amount || 0
      );
    });

    filteredExpenses.forEach((row) => {
      const key = getMonthKey(
        getDate(row)
      );

      if (!months[key]) {
        months[key] = {
          income: 0,
          expense: 0,
        };
      }

      months[key].expense += Number(
        row.gross_amount || 0
      );
    });

    return Object.entries(months)
      .map(([month, values]) => ({
        month,
        ...values,
      }))
      .slice(-6);
  }, [
    filteredIncome,
    filteredExpenses,
  ]);

  const categoryData = useMemo(() => {
    const categories: Record<
      string,
      number
    > = {};

    filteredExpenses.forEach((row) => {
      const category =
        row.category ||
        row.expense_category ||
        "Uncategorised";

      categories[category] =
        (categories[category] || 0) +
        Number(row.gross_amount || 0);
    });

    return Object.entries(categories)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount
      )
      .slice(0, 6);
  }, [filteredExpenses]);

  const incomeModeData = useMemo(() => {
    const modes: Record<
      string,
      number
    > = {};

    filteredIncome.forEach((row) => {
      const mode =
        row.mode || "Other";

      modes[mode] =
        (modes[mode] || 0) +
        Number(row.amount || 0);
    });

    return Object.entries(modes)
      .map(([mode, amount]) => ({
        mode,
        amount,
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount
      );
  }, [filteredIncome]);

  const maxMonthlyValue = Math.max(
    ...monthlyData.flatMap((item) => [
      item.income,
      item.expense,
    ]),
    1
  );

  const maxCategoryValue = Math.max(
    ...categoryData.map(
      (item) => item.amount
    ),
    1
  );

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          analytics.savingsRatio / 2 +
          (analytics.availableFunds > 0
            ? 15
            : -20)
      )
    )
  );

  if (loading) {
    return (
      <div className="card">
        <h2>
          Loading Reports & Analytics...
        </h2>

        <p className="muted">
          Preparing financial intelligence.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* =====================================
          PAGE HEADER
      ====================================== */}

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
            style={{
              width: 170,
            }}
            value={period}
            onChange={(e) =>
              setPeriod(
                e.target.value
              )
            }
          >
            <option value="ALL">
              All Time
            </option>

            <option value="YEAR">
              Current Year
            </option>

            <option value="MONTH">
              Current Month
            </option>
          </select>

          <button
            className="btn secondary"
            onClick={loadReports}
          >
            ↻ Refresh
          </button>
        </div>
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

      {/* =====================================
          EXECUTIVE SUMMARY
      ====================================== */}

      <div className="grid">
        <div className="card">
          <div className="muted">
            💰 Total Income
          </div>

          <div className="metric">
            {money(
              analytics.totalIncome
            )}
          </div>

          <div className="muted">
            Cleared collections
          </div>
        </div>

        <div className="card">
          <div className="muted">
            💸 Total Expense
          </div>

          <div className="metric">
            {money(
              analytics.grossExpense
            )}
          </div>

          <div className="muted">
            Approved expenditure
          </div>
        </div>

        <div className="card">
          <div className="muted">
            📊 Financial Surplus
          </div>

          <div
            className="metric"
            style={{
              color:
                analytics.surplus >= 0
                  ? "#16a34a"
                  : "#dc2626",
            }}
          >
            {money(
              analytics.surplus
            )}
          </div>

          <div className="muted">
            Income − Gross Expense
          </div>
        </div>

        <div className="card">
          <div className="muted">
            🏦 Available Funds
          </div>

          <div className="metric">
            {money(
              analytics.availableFunds
            )}
          </div>

          <div className="muted">
            Bank + Petty Cash
          </div>
        </div>
      </div>

      {/* =====================================
          FINANCIAL HEALTH
      ====================================== */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Financial Health Score
          </h3>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 25,
              marginTop: 20,
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                border:
                  "10px solid rgba(22,163,74,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {healthScore}
              </div>

              <div className="muted">
                /100
              </div>
            </div>

            <div>
              <h2
                style={{
                  marginBottom: 8,
                }}
              >
                {healthScore >= 75
                  ? "Healthy"
                  : healthScore >= 50
                  ? "Stable"
                  : "Attention Required"}
              </h2>

              <p className="muted">
                Based on fund
                availability and surplus
                performance.
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>
            Key Financial Ratios
          </h3>

          <div
            style={{
              marginTop: 20,
            }}
          >
            <div
              style={{
                marginBottom: 18,
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
                  Expense Ratio
                </span>

                <strong>
                  {analytics.expenseRatio.toFixed(
                    1
                  )}
                  %
                </strong>
              </div>

              <div
                style={{
                  height: 8,
                  background:
                    "rgba(100,116,139,.15)",
                  borderRadius: 10,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(
                      analytics.expenseRatio,
                      100
                    )}%`,
                    height: "100%",
                    background:
                      "#f97316",
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                }}
              >
                <span>
                  Surplus Ratio
                </span>

                <strong>
                  {analytics.savingsRatio.toFixed(
                    1
                  )}
                  %
                </strong>
              </div>

              <div
                style={{
                  height: 8,
                  background:
                    "rgba(100,116,139,.15)",
                  borderRadius: 10,
                  marginTop: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        analytics.savingsRatio,
                        100
                      )
                    )}%`,
                    height: "100%",
                    background:
                      "#16a34a",
                    borderRadius: 10,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================
          INCOME VS EXPENSE TREND
      ====================================== */}

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
            marginBottom: 30,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <h3>
              Income vs Expense Trend
            </h3>

            <p className="muted">
              Financial movement over
              recent reporting periods.
            </p>
          </div>

          <div
            className="muted"
            style={{
              display: "flex",
              gap: 15,
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

        {monthlyData.length === 0 ? (
          <p className="muted">
            No transaction data available.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 18,
              height: 280,
              overflowX: "auto",
              paddingBottom: 10,
            }}
          >
            {monthlyData.map(
              (item) => (
                <div
                  key={item.month}
                  style={{
                    minWidth: 85,
                    flex: 1,
                    height: "100%",
                    display: "flex",
                    flexDirection:
                      "column",
                    justifyContent:
                      "flex-end",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems:
                        "flex-end",
                      height: 210,
                    }}
                  >
                    <div
                      title={money(
                        item.income
                      )}
                      style={{
                        flex: 1,
                        height: `${
                          (item.income /
                            maxMonthlyValue) *
                          100
                        }%`,
                        minHeight:
                          item.income > 0
                            ? 4
                            : 0,
                        background:
                          "#16a34a",
                        borderRadius:
                          "8px 8px 0 0",
                      }}
                    />

                    <div
                      title={money(
                        item.expense
                      )}
                      style={{
                        flex: 1,
                        height: `${
                          (item.expense /
                            maxMonthlyValue) *
                          100
                        }%`,
                        minHeight:
                          item.expense > 0
                            ? 4
                            : 0,
                        background:
                          "#f97316",
                        borderRadius:
                          "8px 8px 0 0",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 10,
                      fontSize: 12,
                    }}
                  >
                    {item.month}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* =====================================
          EXPENSE CATEGORY + INCOME MODE
      ====================================== */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Expense Category Analysis
          </h3>

          <p className="muted">
            Where GPCC funds are being
            utilized.
          </p>

          <div
            style={{
              marginTop: 25,
            }}
          >
            {categoryData.length ===
            0 ? (
              <p className="muted">
                No expense categories
                available.
              </p>
            ) : (
              categoryData.map(
                (item) => (
                  <div
                    key={item.category}
                    style={{
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 15,
                        marginBottom: 7,
                      }}
                    >
                      <span>
                        {item.category}
                      </span>

                      <strong>
                        {money(
                          item.amount
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        height: 10,
                        background:
                          "rgba(100,116,139,.15)",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${
                            (item.amount /
                              maxCategoryValue) *
                            100
                          }%`,
                          height: "100%",
                          background:
                            "#8b5cf6",
                          borderRadius: 10,
                        }}
                      />
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>

        <div className="card">
          <h3>
            Income Collection Channels
          </h3>

          <p className="muted">
            Distribution of collections
            by payment mode.
          </p>

          <div
            style={{
              marginTop: 25,
            }}
          >
            {incomeModeData.length ===
            0 ? (
              <p className="muted">
                No income data available.
              </p>
            ) : (
              incomeModeData.map(
                (item) => {
                  const percentage =
                    analytics.totalIncome > 0
                      ? (item.amount /
                          analytics.totalIncome) *
                        100
                      : 0;

                  return (
                    <div
                      key={item.mode}
                      style={{
                        marginBottom: 18,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          marginBottom: 7,
                        }}
                      >
                        <span>
                          {item.mode}
                        </span>

                        <strong>
                          {percentage.toFixed(
                            1
                          )}
                          %
                        </strong>
                      </div>

                      <div
                        style={{
                          height: 10,
                          background:
                            "rgba(100,116,139,.15)",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            background:
                              "#0ea5e9",
                            borderRadius: 10,
                          }}
                        />
                      </div>

                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        {money(
                          item.amount
                        )}
                      </div>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>
      </div>

      {/* =====================================
          FUND POSITION
      ====================================== */}

      <div
        className="grid"
        style={{
          marginTop: 20,
        }}
      >
        <div className="card">
          <h3>
            Current Fund Distribution
          </h3>

          <div
            style={{
              marginTop: 25,
            }}
          >
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background:
                  "rgba(14,165,233,.08)",
                marginBottom: 15,
              }}
            >
              <div className="muted">
                🏦 Bank Position
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {money(
                  analytics.currentBank
                )}
              </div>
            </div>

            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background:
                  "rgba(22,163,74,.08)",
              }}
            >
              <div className="muted">
                💵 Petty Cash
              </div>

              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  marginTop: 6,
                }}
              >
                {money(
                  analytics.currentPettyCash
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>
            Compliance & TDS Overview
          </h3>

          <div
            style={{
              marginTop: 25,
            }}
          >
            <div
              style={{
                marginBottom: 25,
              }}
            >
              <div className="muted">
                Total Gross Expense
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {money(
                  analytics.grossExpense
                )}
              </div>
            </div>

            <div
              style={{
                marginBottom: 25,
              }}
            >
              <div className="muted">
                Total Net Payment
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {money(
                  analytics.netExpense
                )}
              </div>
            </div>

            <div>
              <div className="muted">
                TDS Liability / Deduction
              </div>

              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#8b5cf6",
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

      {/* =====================================
          MANAGEMENT INSIGHTS
      ====================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
        }}
      >
        <h3>
          ✨ Management Insights
        </h3>

        <div
          className="grid"
          style={{
            marginTop: 20,
          }}
        >
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background:
                analytics.surplus >= 0
                  ? "rgba(22,163,74,.08)"
                  : "rgba(220,38,38,.08)",
            }}
          >
            <strong>
              Surplus Performance
            </strong>

            <p className="muted">
              GPCC currently has a{" "}
              {analytics.surplus >= 0
                ? "positive"
                : "negative"}{" "}
              financial surplus of{" "}
              {money(
                Math.abs(
                  analytics.surplus
                )
              )}
              .
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background:
                "rgba(14,165,233,.08)",
            }}
          >
            <strong>
              Fund Availability
            </strong>

            <p className="muted">
              Total immediately available
              funds are{" "}
              {money(
                analytics.availableFunds
              )}
              .
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background:
                "rgba(139,92,246,.08)",
            }}
          >
            <strong>
              Expense Control
            </strong>

            <p className="muted">
              Expenses represent{" "}
              {analytics.expenseRatio.toFixed(
                1
              )}
              % of total income for the
              selected reporting period.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================
          DATA SUMMARY
      ====================================== */}

      <div
        className="card"
        style={{
          marginTop: 20,
          marginBottom: 20,
        }}
      >
        <h3>
          Data Summary
        </h3>

        <div className="tableWrap">
          <table className="table">
            <tbody>
              <tr>
                <td>
                  Cleared Income Transactions
                </td>

                <td>
                  {number(
                    filteredIncome.length
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Paid Expense Transactions
                </td>

                <td>
                  {number(
                    filteredExpenses.length
                  )}
                </td>
              </tr>

              <tr>
                <td>
                  Fund Transfer Transactions
                </td>

                <td>
                  {number(
                    transferData.length
                  )}
                </td>
              </tr>

              <tr>
                <th>
                  Total Available Funds
                </th>

                <th>
                  {money(
                    analytics.availableFunds
                  )}
                </th>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}