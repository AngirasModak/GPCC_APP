"use client";

import { ReactNode } from "react";

type HeroVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "blue"
  | "green"
  | "amber";

interface BalanceHeroProps {
  eyebrow?: string;

  title?: string;

  label?: string;

  amount?: string;

  value?: string;

  description?: string;

  icon?: ReactNode;

  variant?: HeroVariant;

  trend?: {
    label: string;
    positive?: boolean;
  };

  primaryLabel?: string;
  primaryValue?: string;

  secondaryLabel?: string;
  secondaryValue?: string;
}

export default function BalanceHero({
  eyebrow,
  title,
  label,
  amount,
  value,
  description,
  icon,
  variant = "primary",
  trend,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
}: BalanceHeroProps) {
  const heroTitle = title || label || "";
  const heroAmount = amount || value || "";

  return (
    <section
      className={`balance-hero hero-${variant}`}
    >
      <div className="balance-hero-background" />

      <div className="balance-hero-main">
        <div className="balance-hero-meta">

          {eyebrow && (
            <span className="balance-eyebrow">
              {eyebrow}
            </span>
          )}

          <div className="balance-title-row">

            <div>
              <h2>{heroTitle}</h2>

              {description && (
                <p>{description}</p>
              )}
            </div>

            {icon && (
              <div className="balance-hero-icon">
                {icon}
              </div>
            )}

          </div>

          <div className="balance-amount">
            {heroAmount}
          </div>

          {trend && (
            <div
              className={`balance-trend ${
                trend.positive === false
                  ? "negative"
                  : "positive"
              }`}
            >
              {trend.positive === false
                ? "↓"
                : "↑"}

              {trend.label}
            </div>
          )}

        </div>

        {(primaryLabel ||
          secondaryLabel) && (
          <div className="balance-breakdown">

            {primaryLabel && (
              <div className="balance-breakdown-item">

                <span>
                  {primaryLabel}
                </span>

                <strong>
                  {primaryValue}
                </strong>

              </div>
            )}

            {secondaryLabel && (
              <div className="balance-breakdown-item">

                <span>
                  {secondaryLabel}
                </span>

                <strong>
                  {secondaryValue}
                </strong>

              </div>
            )}

          </div>
        )}

      </div>
    </section>
  );
}