interface StatusBadgeProps {
  status: string;
  variant?: "success" | "warning" | "danger" | "info" | "neutral";
}

export default function StatusBadge({
  status,
  variant = "neutral",
}: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${variant}`}>
      <span className="status-badge__dot" />
      {status}
    </span>
  );
}