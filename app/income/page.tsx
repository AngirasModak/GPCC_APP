"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BanknoteArrowDown,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  TrendingUp,
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
import EmptyState from "../../components/finance/EmptyState";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalize = (value: unknown) =>
  String(value || "").trim().toLowerCase();

export default function IncomePage() {
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setMsg("");

    try {
      const { data, error } =
        await supabase
          .from("income")
          .select("*")
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        throw new Error(error.message);
      }

      setIncome(data || []);
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load income data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const cleared = income.filter(
      (row) =>
        normalize(row.status) === "cleared"
    );

    const totalIncome = cleared.reduce(
      (sum, row) =>
        sum + Number(row.amount || 0),
      0
    );

    const cashIncome = cleared
      .filter(
        (row) =>
          normalize(row.mode) === "cash"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const bankIncome = cleared
      .filter(
        (row) =>
          normalize(row.mode) !== "cash"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const pendingIncome = income
      .filter(
        (row) =>
          normalize(row.status) !== "cleared"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    return {
      totalIncome,
      cashIncome,
      bankIncome,
      pendingIncome,
      transactionCount: cleared.length,
    };
  }, [income]);

  const filteredIncome =
    income.filter((row) =>
      [
        row.voucher_no,
        row.source,
        row.particulars,
        row.description,
        row.mode,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="finance-loading">
        Loading income...
      </div>
    );
  }

  return (
    <main className="finance-page">
      <FinancePageHeader
        eyebrow="GPCC FINANCIAL OPERATIONS"
        title="Income & Subscription"
        description="Track subscriptions, donations, contributions and other financial inflows."
        badge={
          <StatusBadge
            status={`${summary.transactionCount} Cleared`}
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
          label="Cleared Income"
          value={money(summary.totalIncome)}
          description="Total realised income"
          icon={<TrendingUp size={20} />}
          accent="green"
        />

        <FinanceMetricCard
          label="Bank Collection"
          value={money(summary.bankIncome)}
          description="Non-cash income"
          icon={<Landmark size={20} />}
          accent="blue"
        />

        <FinanceMetricCard
          label="Cash Collection"
          value={money(summary.cashIncome)}
          description="Cash received"
          icon={<BanknoteArrowDown size={20} />}
          accent="amber"
        />

        <FinanceMetricCard
          label="Pending Income"
          value={money(summary.pendingIncome)}
          description="Awaiting clearance"
          icon={<CircleDollarSign size={20} />}
          accent="purple"
        />
      </section>

      <section className="finance-content-grid finance-content-grid--hero">
        <BalanceHero
          eyebrow="TOTAL REALISED INCOME"
          title="Cleared Collections"
          amount={money(summary.totalIncome)}
          description="Income recognised after successful financial clearance."
          icon={<TrendingUp size={30} />}
          trend={{
            label: `${summary.transactionCount} cleared transactions`,
            positive: true,
          }}
          variant="green"
        />

        <FinancialSummary
          title="Income Distribution"
          subtitle="How GPCC collections are received"
          items={[
            {
              label: "Total Cleared Income",
              value: money(
                summary.totalIncome
              ),
              tone: "positive",
            },
            {
              label: "Bank Collection",
              value: money(
                summary.bankIncome
              ),
              tone: "positive",
            },
            {
              label: "Cash Collection",
              value: money(
                summary.cashIncome
              ),
              tone: "positive",
            },
            {
              label: "Pending Clearance",
              value: money(
                summary.pendingIncome
              ),
              tone: "warning",
            },
          ]}
        />
      </section>

      <section className="finance-section-grid">
        <InsightCard
          title="Collection Health"
          description={
            summary.pendingIncome > 0
              ? `${money(summary.pendingIncome)} is still awaiting clearance.`
              : "All recorded income is currently cleared."
          }
          variant={
            summary.pendingIncome > 0
              ? "warning"
              : "success"
          }
        />

        <InsightCard
          title="Collection Mix"
          description={
            summary.bankIncome >=
            summary.cashIncome
              ? "Most realised income is received through bank and digital channels."
              : "Cash remains the dominant income collection channel."
          }
          variant="info"
        />
      </section>

      <ActivityTimeline
        title="Recent Income Activity"
        subtitle="Latest recorded income transactions"
        items={income
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            title:
              row.source ||
              row.particulars ||
              "Income Received",
            description:
              row.description ||
              row.mode ||
              "Income transaction",
            amount: money(
              Number(row.amount || 0)
            ),
            date:
              row.date ||
              row.income_date ||
              "-",
            icon: (
              <TrendingUp size={16} />
            ),
            status:
              normalize(row.status) ===
              "cleared"
                ? "completed"
                : "pending",
          }))}
      />

      <section className="finance-panel">
        <div className="finance-panel__header">
          <div>
            <span className="finance-section-eyebrow">
              INCOME REGISTER
            </span>

            <h3>Income Transactions</h3>

            <p>
              Complete record of subscriptions,
              donations and other collections.
            </p>
          </div>
        </div>

        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
        />

        <TransactionTable
          data={filteredIncome}
          emptyMessage="No income transactions found."
          columns={[
            {
              key: "date",
              label: "Date",
              render: (row) =>
                row.date ||
                row.income_date ||
                "-",
            },
            {
              key: "voucher_no",
              label: "Voucher No.",
              render: (row) =>
                row.voucher_no || "-",
            },
            {
              key: "source",
              label: "Source",
              render: (row) =>
                row.source || "-",
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
              key: "mode",
              label: "Mode",
              render: (row) =>
                row.mode || "-",
            },
            {
              key: "amount",
              label: "Amount",
              align: "right",
              render: (row) =>
                money(
                  Number(row.amount || 0)
                ),
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
                    "cleared"
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