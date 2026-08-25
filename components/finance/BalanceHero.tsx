import React from "react";

export interface BalanceHeroProps {
  eyebrow?: string;

  title: string;

  amount?: React.ReactNode;
  value?: React.ReactNode;

  description?: string;

  icon?: React.ReactNode;

  trend?: {
    label: React.ReactNode;
    positive?: boolean;
  };

  variant?:
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "neutral"
    | "blue"
    | "green"
    | "amber";

  primaryLabel?: string;
  primaryValue?: React.ReactNode;

  secondaryLabel?: string;
  secondaryValue?: React.ReactNode;
}

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
  const displayAmount = amount ?? value;

  const normalizedVariant =
    variant === "blue"
      ? "primary"
      : variant === "green"
      ? "success"
      : variant === "amber"
      ? "warning"
      : variant;

  return (
    <section
      className={`balance-hero balance-hero--${normalizedVariant}`}
    >
      <div className="balance-hero__background" />

      <div className="balance-hero__content">
        <div className="balance-hero__main">
          {eyebrow && (
            <div className="balance-hero__eyebrow">
              {eyebrow}
            </div>
          )}

          <div className="balance-hero__title-row">
            <div>
              <h2>{title}</h2>

              <div className="balance-hero__amount">
                {displayAmount}
              </div>

              {description && (
                <p>{description}</p>
              )}
            </div>

            {icon && (
              <div className="balance-hero__icon">
                {icon}
              </div>
            )}
          </div>

          {trend && (
            <div
              className={`balance-hero__trend ${
                trend.positive
                  ? "balance-hero__trend--positive"
                  : "balance-hero__trend--negative"
              }`}
            >
              {trend.label}
            </div>
          )}
        </div>

        {(primaryLabel ||
          secondaryLabel) && (
          <div className="balance-hero__breakdown">
            {primaryLabel && (
              <div className="balance-hero__breakdown-item">
                <span>{primaryLabel}</span>

                <strong>
                  {primaryValue}
                </strong>
              </div>
            )}

            {secondaryLabel && (
              <div className="balance-hero__breakdown-item">
                <span>{secondaryLabel}</span>

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