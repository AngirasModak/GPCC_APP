import { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-state__icon">
          {icon}
        </div>
      )}

      <h3>{title}</h3>

      {description && (
        <p>{description}</p>
      )}

      {actionLabel && (
        <button
          type="button"
          className="finance-button finance-button--primary"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}