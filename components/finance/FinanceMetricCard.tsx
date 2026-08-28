"use client";

import { ReactNode } from "react";

type MetricTone =
  | "emerald"
  | "blue"
  | "purple"
  | "amber"
  | "rose"
  | "slate";

interface FinanceMetricCardProps {
  title?: string;
  label?: string;

  value: string;

  subtitle?: string;
  description?: string;

  icon?: ReactNode;

  accent?: string;
  tone?: MetricTone;

  trend?: string;

  trendDirection?: "up" | "down" | "neutral";
}

export default function FinanceMetricCard({
  title,
  label,
  value,
  subtitle,
  description,
  icon,
  accent,
  tone = "emerald",
  trend,
  trendDirection = "neutral",
}: FinanceMetricCardProps) {
  const heading = title || label || "";

  return (
    <div
      className={`finance-metric-card tone-${tone}`}
      style={
        accent
          ? {
              ["--metric-accent" as string]: accent,
            }
          : undefined
      }
    >
      <div className="metric-card-top">
        <div className="metric-icon">{icon}</div>

        {trend && (
          <span
            className={`metric-trend trend-${trendDirection}`}
          >
            {trendDirection === "up"
              ? "↗"
              : trendDirection === "down"
              ? "↘"
              : "•"}

            {trend}
          </span>
        )}
      </div>

      <div className="metric-card-content">
        <span className="metric-label">
          {heading}
        </span>

        <div className="metric-value">
          {value}
        </div>

        {(subtitle || description) && (
          <p className="metric-description">
            {subtitle || description}
          </p>
        )}
      </div>

      <div className="metric-glow" />
    </div>
  );
}