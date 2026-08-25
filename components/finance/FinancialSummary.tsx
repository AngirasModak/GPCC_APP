import { ReactNode } from "react";

export interface FinancialSummaryItem {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
}

interface FinancialSummaryProps {
  title?: string;
  subtitle?: string;
  items: FinancialSummaryItem[];
}

export default function FinancialSummary({
  title = "Financial Summary",
  subtitle,
  items,
}: FinancialSummaryProps) {
  return (
    <section className="finance-panel financial-summary">
      <div className="finance-panel__header">
        <div>
          <h3>{title}</h3>

          {subtitle && (
            <p>{subtitle}</p>
          )}
        </div>
      </div>

      <div className="financial-summary__list">
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            className={`financial-summary__item tone-${item.tone || "default"}`}
          >
            <div className="financial-summary__label">
              {item.icon && (
                <span className="financial-summary__icon">
                  {item.icon}
                </span>
              )}

              <span>{item.label}</span>
            </div>

            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}