import { ReactNode } from "react";

interface InsightCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "info" | "success" | "warning" | "danger";
}

export default function InsightCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  variant = "info",
}: InsightCardProps) {
  return (
    <article className={`insight-card insight-card--${variant}`}>
      <div className="insight-card__icon">
        {icon}
      </div>

      <div className="insight-card__content">
        <h4>{title}</h4>
        <p>{description}</p>

        {actionLabel && (
          <button
            type="button"
            className="insight-card__action"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}