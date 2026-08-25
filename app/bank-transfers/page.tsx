"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Landmark,
  RefreshCw,
  WalletCards,
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

type BankAccount = {
  id: string;
  account_name: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
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

export default function BankTransfersPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const [account, setAccount] =
    useState<BankAccount | null>(null);

  const [income, setIncome] =
    useState<any[]>([]);

  const [expenses, setExpenses] =
    useState<any[]>([]);

  const [transfers, setTransfers] =
    useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    setMsg("");

    try {
      const [
        bankResponse,
        incomeResponse,
        expenseResponse,
        transferResponse,
      ] = await Promise.all([
        supabase
          .from("bank_accounts")
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

      if (bankResponse.error) {
        throw new Error(
          bankResponse.error.message
        );
      }

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

      setAccount(bankResponse.data);
      setIncome(incomeResponse.data || []);
      setExpenses(expenseResponse.data || []);
      setTransfers(
        transferResponse.data || []
      );
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Unable to load bank data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const opening = Number(
      account?.opening_balance || 0
    );

    const bankIncome = income
      .filter(
        (row) =>
          normalize(row.mode) !== "cash"
      )
      .reduce(
        (sum, row) =>
          sum + Number(row.amount || 0),
        0
      );

    const bankExpense = expenses
      .filter(
        (row) =>
          normalize(row.payment_mode) !==
          "petty cash"
      )
      .reduce(
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

    const adjustmentCredit =
      transfers
        .filter(
          (row) =>
            normalize(row.type) ===
              "bank adjustment" &&
            normalize(row.direction) ===
              "in"
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const adjustmentDebit =
      transfers
        .filter(
          (row) =>
            normalize(row.type) ===
              "bank adjustment" &&
            normalize(row.direction) ===
              "out"
        )
        .reduce(
          (sum, row) =>
            sum + Number(row.amount || 0),
          0
        );

    const balance =
      opening +
      bankIncome -
      bankExpense -
      bankToCash +
      cashToBank +
      adjustmentCredit -
      adjustmentDebit;

    return {
      opening,
      bankIncome,
      bankExpense,
      bankToCash,
      cashToBank,
      adjustmentCredit,
      adjustmentDebit,
      balance,
    };
  }, [
    account,
    income,
    expenses,
    transfers,
  ]);

  const bankTransactions =
    useMemo(() => {
      const incomeRows = income
        .filter(
          (row) =>
            normalize(row.mode) !== "cash"
        )
        .map((row) => ({
          id: `income-${row.id}`,
          date:
            row.date ||
            row.income_date ||
            "",
          type: "Bank Income",
          particulars:
            row.particulars ||
            row.description ||
            row.source ||
            "-",
          reference:
            row.reference_no ||
            "-",
          debit: 0,
          credit: Number(
            row.amount || 0
          ),
          status:
            row.status || "Cleared",
        }));

      const expenseRows = expenses
        .filter(
          (row) =>
            normalize(row.payment_mode) !==
            "petty cash"
        )
        .map((row) => ({
          id: `expense-${row.id}`,
          date:
            row.date ||
            row.expense_date ||
            "",
          type: "Bank Expense",
          particulars:
            row.particulars ||
            row.description ||
            row.vendor_name ||
            "-",
          reference:
            row.reference_no ||
            "-",
          debit: getNetPayment(row),
          credit: 0,
          status:
            row.status || "Paid",
        }));

      const transferRows =
        transfers.map((row) => {
          const type =
            normalize(row.type);

          const debit =
            [
              "bank withdrawal",
              "withdrawal",
            ].includes(type) ||
            (
              type ===
                "bank adjustment" &&
              normalize(
                row.direction
              ) === "out"
            );

          return {
            id: `transfer-${row.id}`,
            date:
              row.date ||
              row.transfer_date ||
              "",
            type:
              row.type || "Transfer",
            particulars:
              row.particulars ||
              row.description ||
              "-",
            reference:
              row.reference_no ||
              "-",
            debit: debit
              ? Number(row.amount || 0)
              : 0,
            credit: debit
              ? 0
              : Number(row.amount || 0),
            status:
              row.status ||
              "Completed",
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
      income,
      expenses,
      transfers,
    ]);

  const filteredTransactions =
    bankTransactions.filter((row) =>
      [
        row.date,
        row.type,
        row.particulars,
        row.reference,
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  if (loading) {
    return (
      <div className="finance-loading">
        Loading bank position...
      </div>
    );
  }

  if (!account) {
    return (
      <EmptyState
        title="Bank Account Not Configured"
        description="Configure an active bank account before using bank transfers."
        icon={<Landmark size={30} />}
      />
    );
  }

  return (
    <main className="finance-page">
      <FinancePageHeader
        eyebrow="GPCC FINANCIAL OPERATIONS"
        title="Bank & Transfers"
        description="Monitor bank position, incoming collections, payments and internal fund transfers."
        badge={
          <StatusBadge
            status="Live Bank Position"
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
          value={money(summary.opening)}
          description="Configured bank opening balance"
          icon={<Landmark size={20} />}
          accent="blue"
        />

        <FinanceMetricCard
          label="Bank Income"
          value={money(summary.bankIncome)}
          description="Cleared non-cash income"
          icon={<ArrowDownLeft size={20} />}
          accent="green"
        />

        <FinanceMetricCard
          label="Bank Payments"
          value={money(summary.bankExpense)}
          description="Actual bank outflow"
          icon={<ArrowUpRight size={20} />}
          accent="amber"
        />

        <FinanceMetricCard
          label="Current Position"
          value={money(summary.balance)}
          description="Available bank balance"
          icon={<WalletCards size={20} />}
          accent="blue"
        />
      </section>

      <section className="finance-content-grid finance-content-grid--hero">
        <BalanceHero
          eyebrow="CURRENT BANK POSITION"
          title={account.account_name}
          amount={money(summary.balance)}
          description="Calculated from opening balance, cleared income, payments, transfers and adjustments."
          icon={<Landmark size={30} />}
          trend={{
            label:
              summary.balance >= 0
                ? "Positive bank position"
                : "Bank position requires review",
            positive:
              summary.balance >= 0,
          }}
          variant="blue"
        />

        <FinancialSummary
          title="Bank Reconciliation"
          subtitle="Movement from opening to current position"
          items={[
            {
              label: "Opening Balance",
              value: money(
                summary.opening
              ),
            },
            {
              label: "Cleared Bank Income",
              value: money(
                summary.bankIncome
              ),
              tone: "positive",
            },
            {
              label: "Bank Expenses",
              value: money(
                summary.bankExpense
              ),
              tone: "negative",
            },
            {
              label: "Bank → Petty Cash",
              value: money(
                summary.bankToCash
              ),
              tone: "negative",
            },
            {
              label: "Petty Cash → Bank",
              value: money(
                summary.cashToBank
              ),
              tone: "positive",
            },
            {
              label: "Current Position",
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
          description="Total internal withdrawals from the bank."
          status="completed"
        />

        <InsightCard
          title="Transfer Intelligence"
          description={
            summary.bankToCash >
            summary.cashToBank
              ? "More funds have moved from Bank to Petty Cash than returned to the bank."
              : "Cash deposits back to bank are balanced against withdrawals."
          }
          variant="info"
        />
      </section>

      <ActivityTimeline
        title="Recent Bank Activity"
        subtitle="Latest inflows, payments and transfers"
        items={bankTransactions
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            title: row.type,
            description:
              row.particulars,
            amount: money(
              row.credit ||
                row.debit
            ),
            date: row.date || "-",
            icon: (
              <ArrowRightLeft size={16} />
            ),
            status: "completed",
          }))}
      />

      <section className="finance-panel">
        <div className="finance-panel__header">
          <div>
            <span className="finance-section-eyebrow">
              BANK LEDGER
            </span>

            <h3>Bank Transactions</h3>

            <p>
              Combined view of bank income,
              expenditure and fund transfers.
            </p>
          </div>
        </div>

        <DataToolbar
          searchValue={search}
          onSearchChange={setSearch}
        />

        <TransactionTable
          data={filteredTransactions}
          emptyMessage="No bank transactions found."
          columns={[
            {
              key: "date",
              label: "Date",
            },
            {
              key: "type",
              label: "Transaction Type",
            },
            {
              key: "particulars",
              label: "Particulars",
            },
            {
              key: "reference",
              label: "Reference",
            },
            {
              key: "debit",
              label: "Debit",
              align: "right",
              render: (row) =>
                row.debit
                  ? money(row.debit)
                  : "-",
            },
            {
              key: "credit",
              label: "Credit",
              align: "right",
              render: (row) =>
                row.credit
                  ? money(row.credit)
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