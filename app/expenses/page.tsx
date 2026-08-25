"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeIndianRupee,
  ReceiptText,
  RefreshCw,
  Scale,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import FinancePageHeader from "../../components/finance/FinancePageHeader";
import FinanceMetricCard from "../../components/finance/FinanceMetricCard";
import BalanceHero from "../../components/finance/BalanceHero";
import FinancialSummary from "../../components/finance/FinancialSummary";
import ActivityTimeline from "../../components/finance/ActivityTimeline";
import InsightCard from "../../components/finance/InsightCard";
import DataToolbar from "../../components/finance/DataToolbar";
import TransactionTable from "../../components/finance/TransactionTable";
import StatusBadge from "../../components/finance/StatusBadge";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalize = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const getTds = (row: any) => {
  if (
    row.tds_amount !== null &&
    row.tds_amount !== undefined
  ) {
    return Number(row.tds_amount || 0);
  }

  return (
    Number(row.gross_amount || 0) *
    (Number(row.tds_rate || 0) / 100)
  );
};

const getNet = (row: any) => {
  if (
    row.net_amount !== null &&
    row.net_amount !== undefined
  ) {
    return Number(row.net_amount || 0);
  }

  return (
    Number(row.gross_amount || 0) -
    getTds(row)
  );
};

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] =
    useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMsg("");

    try {
      const { data, error } =
        await supabase
          .from("expenses")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw new Error(error.message);
      }

      setExpenses(data || []);
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load expense data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const paid = expenses.filter(
      (row) =>
        normalize(row.status) === "paid"
    );

    const gross = paid.reduce(
      (sum, row) =>
        sum +
        Number(row.gross_amount || 0),
      0
    );

    const tds = paid.reduce(
      (sum, row) =>
        sum + getTds(row),
      0
    );

    const net = paid.reduce(
      (sum, row) =>
        sum + getNet(row),
      0
    );

    const bankExpense = paid
      .filter(
        (row) =>
          normalize(row.payment_mode) !==
          "petty cash"
      )
      .reduce(
        (sum, row) =>
          sum + getNet(row),
        0
      );

    const pettyCashExpense = paid
      .filter(
        (row) =>
          normalize(row.payment_mode) ===
          "petty cash"
      )
      .reduce(
        (sum, row) =>
          sum + getNet(row),
        0
      );

    const pending = expenses
      .filter(
        (row) =>
          normalize(row.status) !== "paid"
      )
      .reduce(
        (sum, row) =>
          sum +
          Number(row.gross_amount || 0),
        0
      );

    return {
      gross,
      tds,
      net,
      bankExpense,
      pettyCashExpense,
      pending,
      count: paid.length,
    };
  }, [expenses]);

  const filteredExpenses =
    expenses.filter((row) =>
      [
        row.voucher_no,
        row.vendor_name,
        row.particulars,
        row.description,
        row.payment_mode,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="finance-loading">
        Loading expenditure...
      </div>
    );
  }

  return (
    <main className="finance-page">
      <FinancePageHeader
        eyebrow="GPCC FINANCIAL OPERATIONS"
        title="Expenditure & TDS"
        description="Monitor approved expenditure, payment outflow and TDS obligations."
        badge={
          <StatusBadge
            status={`${summary.count} Paid`}
            variant="success"
          />
        }
        action={
          <button
            className="finance-button finance-button--secondary"
            onClick={loadData}
          >
            <RefreshCw size={17} />
            Refresh
          </button>
        }
      />

      {msg && (
        <div className="finance-alert finance-alert--danger">
          {msg}
        </div>
      )}

      <section className="finance-metrics-grid">
        <FinanceMetricCard
          label="Gross Expenditure"
          value={money(summary.gross)}
          description="Total approved paid expense"
          icon={<ReceiptText size={20} />}
          accent="red"
        />

        <FinanceMetricCard
          label="Net Cash Outflow"
          value={money(summary.net)}
          description="Actual amount paid"
          icon={<BadgeIndianRupee size={20} />}
          accent="amber"
        />

        <FinanceMetricCard
          label="TDS"
          value={money(summary.tds)}
          description="Tax deducted at source"
          icon={<Scale size={20} />}
          accent="purple"
        />

        <FinanceMetricCard
          label="Pending Expense"
          value={money(summary.pending)}
          description="Awaiting payment"
          icon={<AlertTriangle size={20} />}
          accent="blue"
        />
      </section>

      <section className="finance-content-grid finance-content-grid--hero">
        <BalanceHero
          eyebrow="ACTUAL PAYMENT OUTFLOW"
          title="Net Expenditure"
          amount={money(summary.net)}
          description="Actual financial outflow after considering TDS deductions."
          icon={<BadgeIndianRupee size={30} />}
          trend={{
            label: `${summary.count} paid transactions`,
            positive: false,
          }}
          variant="amber"
        />

        <FinancialSummary
          title="Expenditure Reconciliation"
          subtitle="Gross expense to actual payment"
          items={[
            {
              label: "Gross Expenditure",
              value: money(summary.gross),
            },
            {
              label: "Less: TDS",
              value: money(summary.tds),
              tone: "warning",
            },
            {
              label: "Net Payment",
              value: money(summary.net),
              tone: "negative",
            },
            {
              label: "Bank Expense",
              value: money(
                summary.bankExpense
              ),
            },
            {
              label: "Petty Cash Expense",
              value: money(
                summary.pettyCashExpense
              ),
            },
          ]}
        />
      </section>

      <section className="finance-section-grid">
        <InsightCard
          title="TDS Monitoring"
          description={
            summary.tds > 0
              ? `${money(summary.tds)} has been recorded as TDS deduction across paid expenditure.`
              : "No TDS deduction has been recorded for paid expenses."
          }
          variant={
            summary.tds > 0
              ? "info"
              : "success"
          }
        />

        <InsightCard
          title="Pending Payment Exposure"
          description={
            summary.pending > 0
              ? `${money(summary.pending)} of expenditure is awaiting payment or clearance.`
              : "No pending expenditure currently requires payment."
          }
          variant={
            summary.pending > 0
              ? "warning"
              : "success"
          }
        />
      </section>

      <ActivityTimeline
        title="Recent Expenditure"
        subtitle="Latest recorded expense activity"
        items={expenses
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            title:
              row.vendor_name ||
              row.particulars ||
              "Expense",
            description:
              row.description ||
              row.payment_mode ||
              "Expense transaction",
            amount: money(
              Number(
                row.gross_amount || 0
              )
            ),
            date:
              row.date ||
              row.expense_date ||
              "-",
            icon: (
              <ReceiptText size={16} />
            ),
            status:
              normalize(row.status) ===
              "paid"
                ? "completed"
                : "pending",
          }))}
      />

      <section className="finance-panel">
        <div className="finance-panel__header">
          <div>
            <span className="finance-section-eyebrow">
              EXPENDITURE REGISTER
            </span>

            <h3>Expense Transactions</h3>

            <p>
              Detailed view of expenditure,
              payment modes and TDS.
            </p>
          </div>
        </div>

        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
        />

        <TransactionTable
          data={filteredExpenses}
          emptyMessage="No expense transactions found."
          columns={[
            {
              key: "date",
              label: "Date",
              render: (row) =>
                row.date ||
                row.expense_date ||
                "-",
            },
            {
              key: "voucher_no",
              label: "Voucher No.",
              render: (row) =>
                row.voucher_no || "-",
            },
            {
              key: "vendor_name",
              label: "Vendor",
              render: (row) =>
                row.vendor_name || "-",
            },
            {
              key: "particulars",
              label: "Particulars",
              render: (row) =>
                row.particulars ||
                row.description ||
                "-",
            },
            {
              key: "payment_mode",
              label: "Payment Mode",
              render: (row) =>
                row.payment_mode || "-",
            },
            {
              key: "gross_amount",
              label: "Gross",
              align: "right",
              render: (row) =>
                money(
                  Number(
                    row.gross_amount || 0
                  )
                ),
            },
            {
              key: "tds",
              label: "TDS",
              align: "right",
              render: (row) =>
                money(getTds(row)),
            },
            {
              key: "net",
              label: "Net Paid",
              align: "right",
              render: (row) =>
                money(getNet(row)),
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  status={
                    row.status || "Pending"
                  }
                  variant={
                    normalize(row.status) ===
                    "paid"
                      ? "success"
                      : "warning"
                  }
                />
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}