import { ReactNode } from "react";

interface FinanceMetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    direction?: "up" | "down" | "neutral";
  };
  accent?: "green" | "blue" | "amber" | "purple" | "red";
}

export default function FinanceMetricCard({
  label,
  value,
  description,
  icon,
  trend,
  accent = "green",
}: FinanceMetricCardProps) {
  return (
    <article className={`finance-metric-card accent-${accent}`}>
      <div className="finance-metric-card__top">
        <div className="finance-metric-card__icon">
          {icon}
        </div>

        {trend && (
          <span
            className={`finance-trend finance-trend--${trend.direction || "neutral"}`}
          >
            {trend.value}
          </span>
        )}
      </div>

      <div className="finance-metric-card__body">
        <span className="finance-metric-card__label">
          {label}
        </span>

        <strong className="finance-metric-card__value">
          {value}
        </strong>

        {description && (
          <span className="finance-metric-card__description">
            {description}
          </span>
        )}
      </div>

      <div className="finance-metric-card__glow" />
    </article>
  );
}