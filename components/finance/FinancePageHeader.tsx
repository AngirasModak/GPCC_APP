"use client";

import { ReactNode } from "react";

interface FinancePageHeaderProps {
  eyebrow?: string;

  title: string;

  description?: string;

  badge?: ReactNode;

  action?: ReactNode;

  actions?: ReactNode;
}

export default function FinancePageHeader({
  eyebrow,
  title,
  description,
  badge,
  action,
  actions,
}: FinancePageHeaderProps) {
  return (
    <header className="finance-page-header">

      <div className="finance-page-header-copy">

        {eyebrow && (
          <span className="page-eyebrow">
            {eyebrow}
          </span>
        )}

        <div className="page-title-row">

          <div>
            <h1>{title}</h1>

            {description && (
              <p>{description}</p>
            )}
          </div>

          {badge && (
            <div className="page-badge">
              {badge}
            </div>
          )}

        </div>

      </div>

      {(action || actions) && (
        <div className="finance-page-actions">
          {action || actions}
        </div>
      )}

    </header>
  );
}