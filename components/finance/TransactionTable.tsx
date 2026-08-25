"use client";

import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export interface TransactionColumn<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "center" | "right";
  render?: (row: T, index: number) => ReactNode;
}

interface TransactionTableProps<T extends { id: string | number }> {
  columns: TransactionColumn<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export default function TransactionTable<
  T extends { id: string | number }
>({
  columns,
  data,
  emptyMessage = "No transactions found.",
  onRowClick,
}: TransactionTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="transaction-table-empty">
        <div className="transaction-table-empty__icon">
          <MoreHorizontal size={28} />
        </div>

        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="transaction-table-wrapper">
      <table className="transaction-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={`align-${column.align || "left"}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? "transaction-table__clickable" : ""}
            >
              {columns.map((column) => {
                const value = row[column.key as keyof T];

                return (
                  <td
                    key={String(column.key)}
                    className={`align-${column.align || "left"}`}
                  >
                    {column.render
                      ? column.render(row, rowIndex)
                      : String(value ?? "-")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}