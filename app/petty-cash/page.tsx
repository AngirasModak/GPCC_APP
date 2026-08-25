"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Banknote,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

import FinancePageHeader from "../../components/finance/FinancePageHeader";
import FinanceMetricCard from "../../components/finance/FinanceMetricCard";
import BalanceHero from "../../components/finance/BalanceHero";
import FinancialSummary from "../../components/finance/FinancialSummary";
import FundMovement from "../../components/finance/FundMovement";
import ActivityTimeline from "../../components/finance/ActivityTimeline";
import InsightCard from "../../components/finance/InsightCard";
import DataToolbar from "../../components/finance/DataToolbar";
import TransactionTable from "../../components/finance/TransactionTable";
import StatusBadge from "../../components/finance/StatusBadge";
import EmptyState from "../../components/finance/EmptyState";

type PettyCashAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
};

type CashTransaction = {
  id: string;
  date: string;
  source: string;
  requisition: string;
  type: string;
  particulars: string;
  reference: string;
  cashIn: number;
  cashOut: number;
  status: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const normalize = (value: unknown) =>
  String(value || "").trim().toLowerCase();

const getNetPayment = (row: any) => {
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

export default function PettyCashPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const [account, setAccount] =
    useState<PettyCashAccount | null>(null);

  const [cashIncome, setCashIncome] = useState<any[]>([]);
  const [cashExpenses, setCashExpenses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    setMsg("");

    try {
      const [
        accountResponse,
        incomeResponse,
        expenseResponse,
        transferResponse,
      ] = await Promise.all([
        supabase
          .from("petty_cash_accounts")
          .select("*")
          .eq("is_active", true)
          .maybeSingle(),

        supabase
          .from("income")
          .select("*")
          .is("deleted_at", null)
          .eq("status", "Cleared")
          .eq("mode", "Cash"),

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

      if (accountResponse.error) {
        throw new Error(accountResponse.error.message);
      }

      if (incomeResponse.error) {
        throw new Error(incomeResponse.error.message);
      }

      if (expenseResponse.error) {
        throw new Error(expenseResponse.error.message);
      }

      if (transferResponse.error) {
        throw new Error(transferResponse.error.message);
      }

      setAccount(accountResponse.data);

      setCashIncome(
        (incomeResponse.data || []).filter(
          (row: any) =>
            normalize(row.mode) === "cash"
        )
      );

      setCashExpenses(
        (expenseResponse.data || []).filter(
          (row: any) =>
            normalize(row.payment_mode) ===
            "petty cash"
        )
      );

      setTransfers(
        transferResponse.data || []
      );
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load petty cash data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const openingBalance = Number(
      account?.opening_balance || 0
    );

    const totalCashIncome =
      cashIncome.reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const totalExpense =
      cashExpenses.reduce(
        (sum, row) =>
          sum + getNetPayment(row),
        0
      );

    const bankToCash = transfers
      .filter((row) =>
        [
          "bank withdrawal",
          "withdrawal",
        ].includes(normalize(row.type))
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const cashToBank = transfers
      .filter((row) =>
        [
          "petty cash to bank",
          "cash deposit",
          "deposit",
          "petty cash deposit",
          "return to bank",
        ].includes(normalize(row.type))
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const adjustmentCredit = transfers
      .filter(
        (row) =>
          [
            "cash adjustment",
            "cash adjustment +",
          ].includes(normalize(row.type)) &&
          normalize(row.direction) === "in"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const adjustmentDebit = transfers
      .filter(
        (row) =>
          [
            "cash adjustment",
            "cash adjustment -",
          ].includes(normalize(row.type)) &&
          normalize(row.direction) === "out"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const balance =
      openingBalance +
      totalCashIncome +
      bankToCash -
      totalExpense -
      cashToBank +
      adjustmentCredit -
      adjustmentDebit;

    return {
      openingBalance,
      totalCashIncome,
      totalExpense,
      bankToCash,
      cashToBank,
      adjustmentCredit,
      adjustmentDebit,
      balance,
    };
  }, [
    account,
    cashIncome,
    cashExpenses,
    transfers,
  ]);

  const transactions = useMemo(() => {
    const incomeRows: CashTransaction[] =
      cashIncome.map((row: any) => ({
        id: `income-${row.id}`,
        date:
          row.date ||
          row.income_date ||
          "",
        source: "Cash Income",
        requisition:
          row.voucher_no ||
          "-",
        type: "Cash In",
        particulars:
          row.particulars ||
          row.description ||
          row.source ||
          "-",
        reference:
          row.reference_no ||
          "-",
        cashIn: Number(row.amount || 0),
        cashOut: 0,
        status: row.status || "Cleared",
      }));

    const expenseRows: CashTransaction[] =
      cashExpenses.map((row: any) => ({
        id: `expense-${row.id}`,
        date:
          row.date ||
          row.expense_date ||
          "",
        source: "Petty Cash Expense",
        requisition:
          row.voucher_no ||
          "-",
        type: "Cash Out",
        particulars:
          row.particulars ||
          row.description ||
          row.vendor_name ||
          "-",
        reference:
          row.reference_no ||
          "-",
        cashIn: 0,
        cashOut: getNetPayment(row),
        status: row.status || "Paid",
      }));

    const transferRows: CashTransaction[] =
      transfers.map((row: any) => {
        const type = normalize(row.type);

        const isIn =
          [
            "bank withdrawal",
            "withdrawal",
          ].includes(type) ||
          normalize(row.direction) === "in";

        return {
          id: `transfer-${row.id}`,
          date:
            row.date ||
            row.transfer_date ||
            "",
          source: "Fund Transfer",
          requisition:
            row.voucher_no ||
            "-",
          type: row.type || "Transfer",
          particulars:
            row.particulars ||
            row.description ||
            "-",
          reference:
            row.reference_no ||
            "-",
          cashIn: isIn
            ? Number(row.amount || 0)
            : 0,
          cashOut: isIn
            ? 0
            : Number(row.amount || 0),
          status: row.status || "Completed",
        };
      });

    return [
      ...incomeRows,
      ...expenseRows,
      ...transferRows,
    ].sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  }, [
    cashIncome,
    cashExpenses,
    transfers,
  ]);

  const filteredTransactions =
    transactions.filter((row) =>
      [
        row.date,
        row.source,
        row.requisition,
        row.type,
        row.particulars,
        row.reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="finance-loading">
        Loading petty cash...
      </div>
    );
  }

  if (!account) {
    return (
      <EmptyState
        title="Petty Cash Account Not Configured"
        description="Configure an active petty cash account before recording transactions."
        icon={<Wallet size={30} />}
      />
    );
  }

  return (
    <main className="finance-page">
      <FinancePageHeader
        eyebrow="GPCC FINANCIAL OPERATIONS"
        title="Petty Cash"
        description="Monitor available cash, operational expenditure and fund movement in one place."
        badge={
          <StatusBadge
            status="Live Position"
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
          label="Opening Balance"
          value={money(summary.openingBalance)}
          description="Opening petty cash position"
          icon={<Wallet size={20} />}
          accent="blue"
        />

        <FinanceMetricCard
          label="Cash Received"
          value={money(
            summary.totalCashIncome +
              summary.bankToCash
          )}
          description="Cash income and bank withdrawals"
          icon={<ArrowDownToLine size={20} />}
          accent="green"
        />

        <FinanceMetricCard
          label="Cash Spent"
          value={money(summary.totalExpense)}
          description="Paid petty cash expenses"
          icon={<ArrowUpFromLine size={20} />}
          accent="amber"
        />

        <FinanceMetricCard
          label="Available Cash"
          value={money(summary.balance)}
          description="Current petty cash position"
          icon={<Banknote size={20} />}
          accent="purple"
        />
      </section>

      <section className="finance-content-grid finance-content-grid--hero">
        <BalanceHero
          eyebrow="CURRENT CASH POSITION"
          title={account.account_name}
          amount={money(summary.balance)}
          description="Current available petty cash after income, expenses, transfers and adjustments."
          icon={<Banknote size={30} />}
          trend={{
            label:
              summary.balance >= 0
                ? "Cash position is positive"
                : "Cash position requires review",
            positive:
              summary.balance >= 0,
          }}
          variant="green"
        />

        <FinancialSummary
          title="Cash Reconciliation"
          subtitle="Complete movement of available petty cash"
          items={[
            {
              label: "Opening Balance",
              value: money(
                summary.openingBalance
              ),
            },
            {
              label: "Cash Income",
              value: money(
                summary.totalCashIncome
              ),
              tone: "positive",
            },
            {
              label: "Bank → Petty Cash",
              value: money(
                summary.bankToCash
              ),
              tone: "positive",
            },
            {
              label: "Cash Expenses",
              value: money(
                summary.totalExpense
              ),
              tone: "negative",
            },
            {
              label: "Cash → Bank",
              value: money(
                summary.cashToBank
              ),
              tone: "negative",
            },
            {
              label: "Current Cash",
              value: money(
                summary.balance
              ),
              tone: "positive",
            },
          ]}
        />
      </section>

      <section className="finance-section-grid">
        <FundMovement
          from="Bank Account"
          to="Petty Cash"
          amount={money(summary.bankToCash)}
          description="Total funds transferred into petty cash."
          status="completed"
        />

        <InsightCard
          title={
            summary.balance > 0
              ? "Healthy Cash Position"
              : "Cash Position Requires Attention"
          }
          description={
            summary.balance > 0
              ? "Petty cash currently has a positive available balance."
              : "Review recent expenses and transfers."
          }
          variant={
            summary.balance > 0
              ? "success"
              : "warning"
          }
        />
      </section>

      <section className="finance-panel">
        <div className="finance-panel__header">
          <div>
            <span className="finance-section-eyebrow">
              CASH REGISTER
            </span>

            <h3>Petty Cash Activity</h3>

            <p>
              Complete history of cash receipts,
              expenditure and transfers.
            </p>
          </div>
        </div>

        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
        />

        <TransactionTable
          data={filteredTransactions}
          emptyMessage="No petty cash transactions found."
          columns={[
            {
              key: "date",
              label: "Date",
            },
            {
              key: "source",
              label: "Source",
            },
            {
              key: "requisition",
              label: "Voucher / Req.",
            },
            {
              key: "type",
              label: "Type",
            },
            {
              key: "particulars",
              label: "Particulars",
            },
            {
              key: "cashIn",
              label: "Cash In",
              align: "right",
              render: (row) =>
                row.cashIn
                  ? money(row.cashIn)
                  : "-",
            },
            {
              key: "cashOut",
              label: "Cash Out",
              align: "right",
              render: (row) =>
                row.cashOut
                  ? money(row.cashOut)
                  : "-",
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <StatusBadge
                  status={row.status}
                  variant="success"
                />
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}