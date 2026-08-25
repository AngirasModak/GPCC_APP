"use client";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "../../lib/supabase";

import CashFlowChart from "../../components/analytics/CashFlowChart";
import ExpenseCategoryChart from "../../components/analytics/ExpenseCategoryChart";
import IncomeSourceChart from "../../components/analytics/IncomeSourceChart";
import PaymentModeChart from "../../components/analytics/PaymentModeChart";
import VendorAnalysis from "../../components/analytics/VendorAnalysis";
import TransactionExplorer from "../../components/analytics/TransactionExplorer";

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function ReportsPage() {
  const [loading, setLoading] =
    useState(true);

  const [period, setPeriod] =
    useState("all");

  const [income, setIncome] =
    useState<any[]>([]);

  const [expenses, setExpenses] =
    useState<any[]>([]);

  const loadReports = async () => {
    setLoading(true);

    try {
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

      setIncome(incomeData || []);
      setExpenses(expenseData || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const totalIncome =
    income.reduce(
      (sum, row) =>
        sum +
        Number(row.amount || 0),
      0
    );

  const totalExpense =
    expenses.reduce(
      (sum, row) =>
        sum +
        Number(
          row.gross_amount || 0
        ),
      0
    );

  const totalTds =
    expenses.reduce(
      (sum, row) =>
        sum +
        Number(
          row.tds_amount || 0
        ),
      0
    );

  /*
   * EXPENSE CATEGORY
   */

  const categoryMap: Record<
    string,
    number
  > = {};

  expenses.forEach((row) => {
    const category =
      row.category ||
      "Uncategorised";

    categoryMap[category] =
      (categoryMap[category] || 0) +
      Number(row.gross_amount || 0);
  });

  const categoryData =
    Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort(
        (a, b) =>
          b.value - a.value
      );

  /*
   * INCOME SOURCE
   */

  const sourceMap: Record<
    string,
    number
  > = {};

  income.forEach((row) => {
    const source =
      row.source ||
      row.category ||
      "Other";

    sourceMap[source] =
      (sourceMap[source] || 0) +
      Number(row.amount || 0);
  });

  const sourceData =
    Object.entries(sourceMap).map(
      ([name, value]) => ({
        name,
        value,
      })
    );

  /*
   * PAYMENT MODE
   */

  const paymentMap: Record<
    string,
    number
  > = {};

  expenses.forEach((row) => {
    const mode =
      row.payment_mode ||
      "Other";

    paymentMap[mode] =
      (paymentMap[mode] || 0) +
      Number(row.gross_amount || 0);
  });

  const paymentData =
    Object.entries(paymentMap).map(
      ([name, value]) => ({
        name,
        value,
      })
    );

  /*
   * VENDOR ANALYSIS
   */

  const vendorMap: Record<
    string,
    number
  > = {};

  expenses.forEach((row) => {
    const vendor =
      row.vendor ||
      row.payee ||
      "Unknown";

    vendorMap[vendor] =
      (vendorMap[vendor] || 0) +
      Number(row.gross_amount || 0);
  });

  const vendorData =
    Object.entries(vendorMap)
      .map(([name, amount]) => ({
        name,
        amount,
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount
      );

  /*
   * CASH FLOW
   */

  const monthMap: Record<
    string,
    {
      income: number;
      expense: number;
    }
  > = {};

  income.forEach((row) => {
    const date =
      row.income_date ||
      row.date ||
      row.created_at;

    if (!date) return;

    const month =
      new Date(date)
        .toLocaleDateString(
          "en-IN",
          {
            month: "short",
          }
        );

    if (!monthMap[month]) {
      monthMap[month] = {
        income: 0,
        expense: 0,
      };
    }

    monthMap[month].income +=
      Number(row.amount || 0);
  });

  expenses.forEach((row) => {
    const date =
      row.expense_date ||
      row.date ||
      row.created_at;

    if (!date) return;

    const month =
      new Date(date)
        .toLocaleDateString(
          "en-IN",
          {
            month: "short",
          }
        );

    if (!monthMap[month]) {
      monthMap[month] = {
        income: 0,
        expense: 0,
      };
    }

    monthMap[month].expense +=
      Number(row.gross_amount || 0);
  });

  const cashFlowData =
    Object.entries(monthMap).map(
      ([month, values]) => ({
        month,
        ...values,
      })
    );

  const topTransactions =
    expenses
      .sort(
        (a, b) =>
          Number(
            b.gross_amount || 0
          ) -
          Number(
            a.gross_amount || 0
          )
      )
      .slice(0, 10)
      .map((row) => ({
        date:
          row.expense_date ||
          row.date ||
          "-",

        vendor:
          row.vendor ||
          row.payee ||
          "-",

        category:
          row.category ||
          "-",

        paymentMode:
          row.payment_mode ||
          "-",

        amount: Number(
          row.gross_amount || 0
        ),
      }));

  if (loading) {
    return (
      <div className="dashboardLoading">
        Preparing Financial Analytics...
      </div>
    );
  }

  return (
    <div className="analyticsPage">

      <div className="commandHero reportsHero">
        <div>
          <div className="eyebrow">
            GPCC ANALYTICS STUDIO
          </div>

          <h1>
            Reports & Analytics
          </h1>

          <p>
            Explore financial trends, spending
            patterns, income sources, vendors and
            transaction-level intelligence.
          </p>
        </div>

        <button
          className="refreshButton"
          onClick={loadReports}
        >
          ↻ Refresh Analytics
        </button>
      </div>

      {/* FILTER */}

      <div className="analyticsFilter">
        <div>
          <label>
            Analysis Period
          </label>

          <select
            value={period}
            onChange={(e) =>
              setPeriod(
                e.target.value
              )
            }
          >
            <option value="all">
              All Available Data
            </option>

            <option value="6m">
              Last 6 Months
            </option>

            <option value="3m">
              Last 3 Months
            </option>

            <option value="1m">
              Current Month
            </option>
          </select>
        </div>

        <div className="reportSummary">
          <div>
            <span>Total Income</span>
            <strong>
              {money(totalIncome)}
            </strong>
          </div>

          <div>
            <span>Total Expenses</span>
            <strong>
              {money(totalExpense)}
            </strong>
          </div>

          <div>
            <span>Net Position</span>
            <strong>
              {money(
                totalIncome -
                  totalExpense
              )}
            </strong>
          </div>

          <div>
            <span>Total TDS</span>
            <strong>
              {money(totalTds)}
            </strong>
          </div>
        </div>
      </div>

      {/* HISTORICAL TREND */}

      <div className="fullWidthSection">
        <CashFlowChart
          data={cashFlowData}
        />
      </div>

      {/* CATEGORY + INCOME */}

      <div className="dashboardTwoColumn">
        <ExpenseCategoryChart
          data={categoryData}
        />

        <IncomeSourceChart
          data={sourceData}
        />
      </div>

      {/* PAYMENT + VENDOR */}

      <div className="dashboardTwoColumn">
        <PaymentModeChart
          data={paymentData}
        />

        <VendorAnalysis
          data={vendorData}
        />
      </div>

      {/* TRANSACTIONS */}

      <TransactionExplorer
        data={topTransactions}
      />

    </div>
  );
}