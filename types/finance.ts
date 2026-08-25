import { ReactNode } from "react";

export type MetricTone =
  | "default"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "purple";

export type TrendDirection =
  | "up"
  | "down"
  | "neutral";

export type TransactionStatus =
  | "paid"
  | "pending"
  | "received"
  | "approved"
  | "cancelled";

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "petty-cash";

export interface FinanceMetric {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  trend?: string;
  trendDirection?: TrendDirection;
}

export interface Transaction {
  id: string;
  date: string;
  voucherNo?: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  account?: string;
}

export interface Activity {
  id: string;
  title: string;
  description?: string;
  date: string;
  amount?: number;
  type: TransactionType;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  tone?: MetricTone;
  actionLabel?: string;
}

export interface FinancialSummaryData {
  totalFunds: number;
  bankBalance: number;
  pettyCash: number;
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  pendingAmount: number;
  tdsAmount: number;
}