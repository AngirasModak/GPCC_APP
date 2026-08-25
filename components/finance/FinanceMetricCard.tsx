import React from "react";

export interface FinanceMetricCardProps {
  /** Supports both existing naming conventions */
  label?: string;
  title?: string;

  value: React.ReactNode;

  description?: string;
  subtitle?: string;

  icon?: React.ReactNode;

  /** Supports existing pages */
  accent?: string;
  tone?: string;

  trend?: React.ReactNode;

  trendDirection?:
    | "up"
    | "down"
    | "neutral"
    | string;
}

export default function FinanceMetricCard({
  label,
  title,
  value,
  description,
  subtitle,
  icon,
  accent,
  tone,
  trend,
  trendDirection = "neutral",
}: FinanceMetricCardProps) {
  const heading = label || title || "";

  const theme =
    accent ||
    tone ||
    "primary";

  return (
    <article
      className={`finance-metric-card finance-metric-card--${theme}`}
    >
      <div className="finance-metric-card__top">
        <div className="finance-metric-card__icon">
          {icon}
        </div>

        {trend && (
          <div
            className={`finance-metric-card__trend finance-metric-card__trend--${trendDirection}`}
          >
            {trend}
          </div>
        )}
      </div>

      <div className="finance-metric-card__content">
        <div className="finance-metric-card__label">
          {heading}
        </div>

        <div className="finance-metric-card__value">
          {value}
        </div>

        {(description || subtitle) && (
          <div className="finance-metric-card__description">
            {description || subtitle}
          </div>
        )}
      </div>
    </article>
  );
}