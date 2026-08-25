"use client";

import { ReactNode } from "react";

interface FinancePageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export default function FinancePageHeader({
  eyebrow = "GREENWOOD PARK CULTURAL COMMITTEE",
  title,
  description,
  action,
  badge,
}: FinancePageHeaderProps) {
  return (
    <section className="finance-page-header">
      <div className="finance-page-header__content">
        <div className="finance-eyebrow">
          <span className="finance-eyebrow__dot" />
          {eyebrow}
        </div>

        <h1>{title}</h1>

        <p>{description}</p>
      </div>

      <div className="finance-page-header__actions">
        {badge && (
          <div className="finance-page-header__badge">
            {badge}
          </div>
        )}

        {action}
      </div>
    </section>
  );
}