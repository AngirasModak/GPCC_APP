import { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  tone?: string;
  trend?: string | number;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  tone = "default",
  trend,
}: MetricCardProps) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top">
        <div>
          <p className="metric-card__title">{title}</p>

          <h3 className="metric-card__value">{value}</h3>

          {subtitle && (
            <p className="metric-card__subtitle">{subtitle}</p>
          )}
        </div>

        {icon && (
          <div className="metric-card__icon">
            {icon}
          </div>
        )}
      </div>

      {trend !== undefined && trend !== null && (
        <div
          className={`metric-card__trend ${
            Number(trend) >= 0
              ? "metric-card__trend--positive"
              : "metric-card__trend--negative"
          }`}
        >
          {typeof trend === "number"
            ? `${trend >= 0 ? "+" : ""}${trend}%`
            : trend}
        </div>
      )}
    </div>
  );
}