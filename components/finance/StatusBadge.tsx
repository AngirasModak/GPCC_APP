"use client";

interface StatusBadgeProps {
  status: string;

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
  const normalized = status.toLowerCase();

  const detectedVariant =
    variant ||
    (normalized.includes("paid") ||
    normalized.includes("cleared") ||
    normalized.includes("completed") ||
    normalized.includes("received")
      ? "success"
      : normalized.includes("pending")
      ? "warning"
      : normalized.includes("cancel") ||
        normalized.includes("failed")
      ? "danger"
      : "primary");

  return (
    <span
      className={`finance-status-badge status-${detectedVariant}`}
    >
      <span className="status-dot" />

      {status}
    </span>
  );
}