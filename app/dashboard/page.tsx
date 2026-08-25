"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import ActivityTimeline from "@/components/finance/ActivityTimeline";
import BalanceHero from "@/components/finance/BalanceHero";
import DataToolbar from "@/components/finance/DataToolbar";
import EmptyState from "@/components/finance/EmptyState";
import FinanceMetricCard from "@/components/finance/FinanceMetricCard";
import FinancePageHeader from "@/components/finance/FinancePageHeader";
import FinancialSummary from "@/components/finance/FinancialSummary";
import FundMovement from "@/components/finance/FundMovement";
import InsightCard from "@/components/finance/InsightCard";
import StatusBadge from "@/components/finance/StatusBadge";
import TransactionTable from "@/components/finance/TransactionTable";


import {
  formatCurrency,
  formatCompactCurrency,
  formatNumber,
  formatDate,
} from "@/lib/finance-utils";



export default function DashboardPage() {
  /*
   Replace these values with your actual API/database data.
  */

  const summary = {
    totalFunds: 0,
    bank: 0,
    pettyCash: 0,
    netFlow: 0,

    income: 0,
    expense: 0,
    pending: 0,
    tds: 0,
  };

  return (
    <main className="finance-page">
      <div className="finance-container">

        <FinancePageHeader
          eyebrow="GPCC Financial Operations"
          title="Financial Overview"
          description="Monitor the complete financial position, fund movement, income, expenditure and cash availability of Greenwood Park Cultural Committee."
          action={
            <button className="finance-button">
              <RefreshCw size={16} />
              Refresh
            </button>
          }
        />

        {/* PRIMARY FINANCIAL POSITION */}

        <div className="finance-metrics-grid">

          <FinanceMetricCard
            label="Total Available Funds"
            value={formatCurrency(summary.totalFunds)}
            description="Across all accounts"
            icon={<WalletCards size={20} />}
            accent="success"
          />

          <FinanceMetricCard
            label="Current Bank Position"
            value={formatCurrency(summary.bank)}
            description="Available bank balance"
            icon={<Landmark size={20} />}
            accent="info"
          />

          <FinanceMetricCard
            label="Current Petty Cash"
            value={formatCurrency(summary.pettyCash)}
            description="Physical cash available"
            icon={<Banknote size={20} />}
            accent="blue"
          />

          <FinanceMetricCard
            label="Net Cash Flow"
            value={formatCurrency(summary.netFlow)}
            description="Income less expenditure"
            icon={<TrendingUp size={20} />}
            accent={
              summary.netFlow >= 0
                ? "success"
                : "danger"
            }
            trend={
              summary.netFlow >= 0
                ? "Positive position"
                : "Negative position"
            }
            trendDirection={
              summary.netFlow >= 0
                ? "up"
                : "down"
            }
          />

        </div>


        {/* FINANCIAL POSITION */}

        <div className="finance-content-grid">

          <BalanceHero
            title="Current Financial Position"
            amount={formatCurrency(summary.totalFunds)}
            description="Total available funds across the committee's bank accounts and petty cash holdings."
            primaryLabel="Bank Balance"
            primaryValue={formatCurrency(summary.bank)}
            secondaryLabel="Petty Cash"
            secondaryValue={formatCurrency(summary.pettyCash)}
          />


          <section className="finance-card">

            <div className="finance-card__header">
              <div>
                <h2 className="finance-card__title">
                  Financial Movement
                </h2>

                <p className="finance-card__description">
                  Income and expenditure position
                </p>
              </div>
            </div>


            <div className="finance-summary-list">

              <div className="finance-summary-row">

                <div className="finance-summary-row__left">

                  <div className="finance-summary-row__icon">
                    <ArrowUpRight
                      size={19}
                      color="#198754"
                    />
                  </div>

                  <div>
                    <div className="finance-summary-row__label">
                      Total Income
                    </div>

                    <div className="finance-summary-row__description">
                      Funds received
                    </div>
                  </div>

                </div>

                <div className="finance-summary-row__amount">
                  {formatCurrency(summary.income)}
                </div>

              </div>


              <div className="finance-summary-row">

                <div className="finance-summary-row__left">

                  <div className="finance-summary-row__icon">
                    <ArrowDownRight
                      size={19}
                      color="#d64545"
                    />
                  </div>

                  <div>
                    <div className="finance-summary-row__label">
                      Total Expenditure
                    </div>

                    <div className="finance-summary-row__description">
                      Approved financial outflow
                    </div>
                  </div>

                </div>

                <div className="finance-summary-row__amount">
                  {formatCurrency(summary.expense)}
                </div>

              </div>


              <div className="finance-summary-row">

                <div className="finance-summary-row__left">

                  <div className="finance-summary-row__icon">
                    <TrendingUp
                      size={19}
                    />
                  </div>

                  <div>
                    <div className="finance-summary-row__label">
                      Pending Payments
                    </div>

                    <div className="finance-summary-row__description">
                      Awaiting settlement
                    </div>
                  </div>

                </div>

                <div className="finance-summary-row__amount">
                  {formatCurrency(summary.pending)}
                </div>

              </div>

            </div>

          </section>

        </div>


        {/* SECONDARY METRICS */}

        <div className="finance-metrics-grid">

          <FinanceMetricCard
            label="Total Income"
            value={formatCurrency(summary.income)}
            description="Income recorded"
            icon={<ArrowUpRight size={20} />}
            accent="success"
          />

          <FinanceMetricCard
         label="Total Expenditure"
            value={formatCurrency(summary.expense)}
            description="Payments recorded"
            icon={<ArrowDownRight size={20} />}
            accent="danger"
          />

          <FinanceMetricCard
            label="Pending Payments"
            value={formatCurrency(summary.pending)}
            description="Awaiting payment"
            icon={<TrendingUp size={20} />}
            accent="warning"
          />

          <FinanceMetricCard
            label="TDS Position"
            value={formatCurrency(summary.tds)}
            description="Tax deducted at source"
            icon={<Banknote size={20} />}
            accent="info"
          />

        </div>

      </div>
    </main>
  );
}