"use client";

import { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

interface DataToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;

  onFilterClick?: () => void;

  actionLabel?: string;
  onActionClick?: () => void;

  filters?: ReactNode;
}

export default function DataToolbar({
  searchValue = "",
  onSearchChange,
  onFilterClick,
  actionLabel,
  onActionClick,
  filters,
}: DataToolbarProps) {
  return (
    <div className="data-toolbar">
      <div className="data-toolbar__left">
        <div className="data-toolbar__search">
          <Search size={18} />

          <input
            type="text"
            value={searchValue}
            onChange={(event) =>
              onSearchChange?.(event.target.value)
            }
            placeholder="Search transactions..."
          />
        </div>

        {filters}
      </div>

      <div className="data-toolbar__right">
        {onFilterClick && (
          <button
            type="button"
            className="finance-button finance-button--secondary"
            onClick={onFilterClick}
          >
            <SlidersHorizontal size={17} />
            Filters
          </button>
        )}

        {actionLabel && (
          <button
            type="button"
            className="finance-button finance-button--primary"
            onClick={onActionClick}
          >
            + {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}