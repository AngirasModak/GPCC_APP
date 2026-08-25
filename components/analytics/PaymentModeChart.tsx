"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function PaymentModeChart({
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
        PAYMENT BEHAVIOUR
      </div>

      <h2>Expense by Payment Mode</h2>

      <div className="chartMedium">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart data={data}>
            <XAxis dataKey="name" />

            <YAxis />

            <Tooltip />

            <Bar
              dataKey="value"
              fill="#2563eb"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}