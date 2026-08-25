import { ReactNode } from "react";

interface FinancePageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
}

export default function FinancePageHeader({
  eyebrow,
  title,
  description,
  badge,
  action,
}: FinancePageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {eyebrow}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>

          {badge}
        </div>

        {description && (
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}