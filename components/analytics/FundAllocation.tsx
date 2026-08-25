"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#0f766e",
  "#f59e0b",
];

export default function FundAllocation({
  bank,
  pettyCash,
}: {
  bank: number;
  pettyCash: number;
}) {
  const data = [
    {
      name: "Bank",
      value: Math.max(0, bank),
    },
    {
      name: "Petty Cash",
      value: Math.max(0, pettyCash),
    },
  ];

  const total = bank + pettyCash;

  return (
    <div className="chartCard allocationCard">
      <div>
        <div className="eyebrow">
          FUND DISTRIBUTION
        </div>

        <h2>Where Funds Are Held</h2>
      </div>

      <div className="allocationChart">
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <PieChart>
            <Pie
              data={data}
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index]}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="allocationCenter">
          <strong>
            ₹{total.toLocaleString("en-IN")}
          </strong>

          <span>Total Funds</span>
        </div>
      </div>

      <div className="allocationLegend">
        <div>
          <span className="legendDot bank" />
          Bank
          <strong>
            ₹{bank.toLocaleString("en-IN")}
          </strong>
        </div>

        <div>
          <span className="legendDot cash" />
          Petty Cash
          <strong>
            ₹{pettyCash.toLocaleString("en-IN")}
          </strong>
        </div>
      </div>
    </div>
  );
}