import { ReactNode } from "react";

type StatusVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | string;

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  icon?: ReactNode;
}

export default function StatusBadge({
  status,
  variant = "default",
  icon,
}: StatusBadgeProps) {
  const variantClasses: Record<string, string> = {
    default: "bg-slate-100 text-slate-700 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",

    Paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cleared: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const classes =
    variantClasses[variant] ??
    variantClasses[status] ??
    variantClasses.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {icon}
      {status}
    </span>
  );
}