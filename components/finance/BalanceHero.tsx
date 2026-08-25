import React, { ReactNode } from "react";

export type BalanceHeroVariant =
  | "danger"
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "blue"
  | "amber"
  | "green";

type BalanceHeroProps = {
  eyebrow?: string;
  title: string;
  amount?: string;
  value?: string;
  description?: string;
  icon?: ReactNode;

  trend?: {
    label: string;
    positive?: boolean;
  };

  variant?: BalanceHeroVariant;

  primaryLabel?: string;
  primaryValue?: string;

  secondaryLabel?: string;
  secondaryValue?: string;
};

export default function BalanceHero({
  eyebrow,
  title,
  amount,
  value,
  description,
  icon,
  trend,
  variant = "primary",
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
}: BalanceHeroProps) {
  const displayValue = amount ?? value ?? "";

  return (
    <section
      className={`balanceHero balanceHero--${variant}`}
    >
      <div className="balanceHero__content">
        {eyebrow && (
          <div className="balanceHero__eyebrow">
            {eyebrow}
          </div>
        )}

        <h2 className="balanceHero__title">
          {title}
        </h2>

        {description && (
          <p className="balanceHero__description">
            {description}
          </p>
        )}

        <div className="balanceHero__amount">
          {displayValue}
        </div>

        {trend && (
          <div
            className={`balanceHero__trend ${
              trend.positive === false
                ? "is-negative"
                : "is-positive"
            }`}
          >
            <span>
              {trend.positive === false
                ? "↓"
                : "↑"}
            </span>

            {trend.label}
          </div>
        )}

        {(primaryLabel ||
          primaryValue ||
          secondaryLabel ||
          secondaryValue) && (
          <div className="balanceHero__breakdown">
            <div className="balanceHero__breakdownItem">
              <span className="balanceHero__breakdownLabel">
                {primaryLabel}
              </span>

              <strong className="balanceHero__breakdownValue">
                {primaryValue}
              </strong>
            </div>

            <div className="balanceHero__divider" />

            <div className="balanceHero__breakdownItem">
              <span className="balanceHero__breakdownLabel">
                {secondaryLabel}
              </span>

              <strong className="balanceHero__breakdownValue">
                {secondaryValue}
              </strong>
            </div>
          </div>
        )}
      </div>

      {icon && (
        <div className="balanceHero__icon">
          {icon}
        </div>
      )}
    </section>
  );
}