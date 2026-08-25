import React from "react";

export type TransactionStatus =
  | string;

export interface StatusBadgeProps {
  status: TransactionStatus;

  variant?:
    | "success"
    | "warning"
    | "danger"
    | "primary"
    | "neutral";
}

export default function StatusBadge({
  status,
  variant,
}: StatusBadgeProps) {
  const normalizedStatus =
    String(status)
      .toLowerCase()
      .trim();

  const autoVariant =
    normalizedStatus.includes("paid") ||
    normalizedStatus.includes("cleared") ||
    normalizedStatus.includes("completed") ||
    normalizedStatus.includes("live") ||
    normalizedStatus.includes("received")
      ? "success"
      : normalizedStatus.includes("pending") ||
        normalizedStatus.includes("processing")
      ? "warning"
      : normalizedStatus.includes("failed") ||
        normalizedStatus.includes("cancelled") ||
        normalizedStatus.includes("overdue")
      ? "danger"
      : "neutral";

  const displayVariant =
    variant || autoVariant;

  return (
    <span
      className={`finance-status-badge finance-status-badge--${displayVariant}`}
    >
      <span className="finance-status-badge__dot" />

      {status}
    </span>
  );
}