"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type Item = {
  month: string;
  income: number;
  expense: number;
};

export default function CashFlowChart({
  data,
}: {
  data: Item[];
}) {
  return (
    <div className="chartCard">
      <div className="chartHeader">
        <div>
          <div className="eyebrow">
            OPERATING TREND
          </div>

          <h2>Cash Flow Movement</h2>

          <p>
            Income and expenditure movement over
            time.
          </p>
        </div>
      </div>

      <div className="chartLarge">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <AreaChart data={data}>
            <defs>
              <linearGradient
                id="incomeGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#0f766e"
                  stopOpacity={0.35}
                />

                <stop
                  offset="95%"
                  stopColor="#0f766e"
                  stopOpacity={0}
                />
              </linearGradient>

              <linearGradient
                id="expenseGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="#dc3545"
                  stopOpacity={0.2}
                />

                <stop
                  offset="95%"
                  stopColor="#dc3545"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="#e8edf2"
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
            />

            <Tooltip />

            <Area
              type="monotone"
              dataKey="income"
              stroke="#0f766e"
              strokeWidth={3}
              fill="url(#incomeGradient)"
            />

            <Area
              type="monotone"
              dataKey="expense"
              stroke="#dc3545"
              strokeWidth={3}
              fill="url(#expenseGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}