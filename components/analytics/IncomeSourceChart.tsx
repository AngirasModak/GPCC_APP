"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const COLORS = [
  "#0f766e",
  "#2563eb",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
];

export default function IncomeSourceChart({
  data,
}: {
  data: {
    name: string;
    value: number;
  }[];
}) {
  return (
    <div className="chartCard">
      <div className="eyebrow">
        INCOME MIX
      </div>

      <h2>Income by Source</h2>

      <div className="chartMedium">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={110}
              innerRadius={65}
            >
              {data.map(
                (_, index) => (
                  <Cell
                    key={index}
                    fill={
                      COLORS[
                        index %
                          COLORS.length
                      ]
                    }
                  />
                )
              )}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}