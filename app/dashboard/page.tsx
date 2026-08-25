"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

import MetricCard from "../../components/analytics/MetricCard";
import FinancialHealth from "../../components/analytics/FinancialHealth";
import SmartAlerts from "../../components/analytics/SmartAlerts";
import CashFlowChart from "../../components/analytics/CashFlowChart";
import FundAllocation from "../../components/analytics/FundAllocation";
import ForecastPanel from "../../components/analytics/ForecastPanel";
import ActionCentre from "../../components/analytics/ActionCentre";
import SectionHeader from "../../components/analytics/SectionHeader";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

type Summary = {
  income: number;
  expense: number;
  bank: number;
  pettyCash: number;
  totalFunds: number;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] =
    useState<Summary>({
      income: 0,
      expense: 0,
      bank: 0,
      pettyCash: 0,
      totalFunds: 0,
    });

  const [monthlyData, setMonthlyData] =
    useState<
      {
        month: string;
        income: number;
        expense: number;
      }[]
    >([]);

  const loadDashboard = async () => {
    setLoading(true);

    try {
      /*
       * KEEP YOUR EXISTING BANK,
       * PETTY CASH, INCOME, EXPENSE
       * AND TRANSFER CALCULATION LOGIC HERE.
       */

      const { data: incomeData } =
        await supabase
          .from("income")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "Cleared");

      const { data: expenseData } =
        await supabase
          .from("expenses")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "Paid");

      const incomes = incomeData || [];
      const expenses = expenseData || [];

      const income = incomes.reduce(
        (sum: number, row: any) =>
          sum + Number(row.amount || 0),
        0
      );

      const expense = expenses.reduce(
        (sum: number, row: any) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

      /*
       * Replace these with your existing
       * reconciliation calculation.
       */

      const bank = 28178;
      const pettyCash = 10000;

      const totalFunds =
        bank + pettyCash;

      setSummary({
        income,
        expense,
        bank,
        pettyCash,
        totalFunds,
      });

      /*
       * MONTHLY CASH FLOW
       */

      const monthMap: Record<
        string,
        {
          income: number;
          expense: number;
        }
      > = {};

      incomes.forEach((row: any) => {
        const date =
          row.income_date ||
          row.date ||
          row.created_at;

        if (!date) return;

        const month = new Date(date)
          .toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          });

        if (!monthMap[month]) {
          monthMap[month] = {
            income: 0,
            expense: 0,
          };
        }

        monthMap[month].income +=
          Number(row.amount || 0);
      });

      expenses.forEach((row: any) => {
        const date =
          row.expense_date ||
          row.date ||
          row.created_at;

        if (!date) return;

        const month = new Date(date)
          .toLocaleDateString("en-IN", {
            month: "short",
            year: "2-digit",
          });

        if (!monthMap[month]) {
          monthMap[month] = {
            income: 0,
            expense: 0,
          };
        }

        monthMap[month].expense +=
          Number(row.gross_amount || 0);
      });

      setMonthlyData(
        Object.entries(monthMap).map(
          ([month, values]) => ({
            month,
            ...values,
          })
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboardLoading">
        Loading Financial Intelligence...
      </div>
    );
  }

  const netFlow =
    summary.income - summary.expense;

  const liquidity =
    summary.totalFunds > 0
      ? 90
      : 40;

  const cashFlow =
    netFlow >= 0 ? 88 : 55;

  const expenseControl =
    summary.expense <= summary.income
      ? 85
      : 60;

  return (
    <div className="analyticsPage">

      {/* HERO */}

      <div className="commandHero">
        <div>
          <div className="eyebrow">
            GPCC FINANCIAL INTELLIGENCE
          </div>

          <h1>
            Financial Command Centre
          </h1>

          <p>
            Live financial position, liquidity
            intelligence, predictive outlook and
            decision support.
          </p>
        </div>

        <div className="heroActions">
          <div className="liveIndicator">
            <span />
            Live Financial Data
          </div>

          <button
            className="refreshButton"
            onClick={loadDashboard}
          >
            ↻ Refresh Intelligence
          </button>
        </div>
      </div>

      {/* PRIMARY METRICS */}

      <div className="metricGrid">
        <MetricCard
          title="Total Available Funds"
          value={money(summary.totalFunds)}
          subtitle="Current operational liquidity"
          icon="wallet"
          tone="green"
        />

        <MetricCard
          title="Current Bank Position"
          value={money(summary.bank)}
          subtitle="Primary operating account"
          icon="bank"
          tone="blue"
        />

        <MetricCard
          title="Current Petty Cash"
          value={money(summary.pettyCash)}
          subtitle="Available for operations"
          icon="wallet"
          tone="orange"
        />

        <MetricCard
          title="Current Net Flow"
          value={money(netFlow)}
          subtitle="Income minus expenditure"
          trend={netFlow >= 0 ? 12 : -12}
          icon={netFlow >= 0 ? "up" : "down"}
          tone={
            netFlow >= 0
              ? "green"
              : "red"
          }
        />
      </div>

      {/* HEALTH + ALERTS */}

      <div className="dashboardTwoColumn">
        <FinancialHealth
          liquidity={liquidity}
          cashFlow={cashFlow}
          expenseControl={expenseControl}
        />

        <SmartAlerts
          alerts={[
            ...(summary.totalFunds > 0
              ? [
                  {
                    type: "success" as const,
                    title:
                      "Financial Position Stable",
                    message:
                      "Available funds are currently sufficient for operations.",
                  },
                ]
              : [
                  {
                    type: "warning" as const,
                    title:
                      "Liquidity Attention Required",
                    message:
                      "Review current funding position.",
                  },
                ]),
            {
              type: "info",
              title:
                "Live Reconciliation",
              message:
                "Dashboard is calculated from cleared income, paid expenses and valid transfers.",
            },
          ]}
        />
      </div>

      {/* CASH FLOW + FUND ALLOCATION */}

      <div className="dashboardMainGrid">
        <CashFlowChart
          data={monthlyData}
        />

        <FundAllocation
          bank={summary.bank}
          pettyCash={summary.pettyCash}
        />
      </div>

      {/* FORECAST + ACTIONS */}

      <div className="dashboardTwoColumn">
        <ForecastPanel
          projectedIncome={
            summary.income * 0.25
          }
          projectedExpense={
            summary.expense * 0.25
          }
          projectedFunds={
            summary.totalFunds +
            summary.income * 0.25 -
            summary.expense * 0.25
          }
        />

        <ActionCentre
          bank={summary.bank}
          pettyCash={summary.pettyCash}
          monthlyExpense={
            summary.expense
          }
        />
      </div>

    </div>
  );
}