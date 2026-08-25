import React from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="finance-empty-state">
      {icon && (
        <div className="finance-empty-state__icon">
          {icon}
        </div>
      )}

      <div className="finance-empty-state__content">
        <h3>{title}</h3>

        {description && (
          <p>{description}</p>
        )}

        {action && (
          <div className="finance-empty-state__action">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}