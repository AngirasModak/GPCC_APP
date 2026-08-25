"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function ExpenseCategoryChart({
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
        EXPENSE STRUCTURE
      </div>

      <h2>Expense by Category</h2>

      <div className="chartMedium">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={data}
            layout="vertical"
          >
            <CartesianGrid
              horizontal={false}
              stroke="#edf1f4"
            />

            <XAxis type="number" />

            <YAxis
              type="category"
              dataKey="name"
              width={110}
            />

            <Tooltip />

            <Bar
              dataKey="value"
              fill="#0f766e"
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}