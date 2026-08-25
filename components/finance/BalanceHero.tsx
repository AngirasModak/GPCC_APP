import { ReactNode } from "react";

interface BalanceHeroProps {
  eyebrow?: string;
  title: string;
  amount: string;
  description?: string;
  icon?: ReactNode;
  trend?: {
    label: string;
    positive?: boolean;
  };
  footer?: ReactNode;
  variant?: "green" | "blue" | "amber" | "purple";
}

export default function BalanceHero({
  eyebrow = "CURRENT POSITION",
  title,
  amount,
  description,
  icon,
  trend,
  footer,
  variant = "green",
}: BalanceHeroProps) {
  return (
    <section className={`balance-hero balance-hero--${variant}`}>
      <div className="balance-hero__background" />

      <div className="balance-hero__content">
        <div className="balance-hero__top">
          <div>
            <span className="balance-hero__eyebrow">
              {eyebrow}
            </span>

            <h2>{title}</h2>
          </div>

          {icon && (
            <div className="balance-hero__icon">
              {icon}
            </div>
          )}
        </div>

        <div className="balance-hero__amount">
          {amount}
        </div>

        {description && (
          <p className="balance-hero__description">
            {description}
          </p>
        )}

        <div className="balance-hero__bottom">
          {trend && (
            <div
              className={`balance-hero__trend ${
                trend.positive
                  ? "balance-hero__trend--positive"
                  : "balance-hero__trend--negative"
              }`}
            >
              <span className="balance-hero__trend-dot" />
              {trend.label}
            </div>
          )}

          {footer}
        </div>
      </div>
    </section>
  );
}