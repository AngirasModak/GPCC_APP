import React from "react";

export interface FinancePageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;

  badge?: React.ReactNode;

  /** Single primary action */
  action?: React.ReactNode;

  /** Multiple actions */
  actions?: React.ReactNode;
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
    <section className="finance-page-header">
      <div className="finance-page-header__content">
        {eyebrow && (
          <div className="finance-page-header__eyebrow">
            {eyebrow}
          </div>
        )}

        <div className="finance-page-header__title-row">
          <div>
            <h1>{title}</h1>

            {description && (
              <p>{description}</p>
            )}
          </div>

          {badge && (
            <div className="finance-page-header__badge">
              {badge}
            </div>
          )}
        </div>
      </div>

      {(action || actions) && (
        <div className="finance-page-header__actions">
          {action}
          {actions}
        </div>
      )}
    </section>
  );
}