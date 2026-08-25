import React, { ReactNode } from "react";

type MetricAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info"
  | "purple"
  | "blue"
  | "green"
  | "amber"
  | "red";

type TrendDirection =
  | "up"
  | "down"
  | "neutral"
  | "positive"
  | "negative";

type FinanceMetricCardProps = {
  label?: string;
  title?: string;

  value: string;

  description?: string;
  subtitle?: string;

  icon?: ReactNode;

  accent?: MetricAccent;
  tone?: MetricAccent;

  trend?: string;

  trendDirection?: TrendDirection;
};

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
  const displayTitle = label ?? title ?? "";
  const displayDescription =
    description ?? subtitle ?? "";

  const displayAccent =
    accent ?? tone ?? "primary";

  const trendClass =
    trendDirection === "up" ||
    trendDirection === "positive"
      ? "is-positive"
      : trendDirection === "down" ||
          trendDirection === "negative"
        ? "is-negative"
        : "is-neutral";

  return (
    <div
      className={`financeMetricCard financeMetricCard--${displayAccent}`}
    >
      <div className="financeMetricCard__top">
        <div>
          <div className="financeMetricCard__label">
            {displayTitle}
          </div>

          {displayDescription && (
            <div className="financeMetricCard__description">
              {displayDescription}
            </div>
          )}
        </div>

        {icon && (
          <div className="financeMetricCard__icon">
            {icon}
          </div>
        )}
      </div>

      <div className="financeMetricCard__value">
        {value}
      </div>

      {trend && (
        <div
          className={`financeMetricCard__trend ${trendClass}`}
        >
          <span>
            {trendDirection === "up" ||
            trendDirection === "positive"
              ? "↑"
              : trendDirection === "down" ||
                  trendDirection === "negative"
                ? "↓"
                : "•"}
          </span>

          {trend}
        </div>
      )}
    </div>
  );
}