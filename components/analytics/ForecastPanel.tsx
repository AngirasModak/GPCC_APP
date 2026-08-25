import {
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from "lucide-react";

type Props = {
  projectedIncome: number;
  projectedExpense: number;
  projectedFunds: number;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function ForecastPanel({
  projectedIncome,
  projectedExpense,
  projectedFunds,
}: Props) {
  return (
    <div className="forecastCard">
      <div className="forecastHeader">
        <div>
          <div className="eyebrow">
            PREDICTIVE ANALYSIS
          </div>

          <h2>30-Day Outlook</h2>
        </div>

        <CalendarDays size={22} />
      </div>

      <div className="forecastGrid">
        <div>
          <span>
            <ArrowUpRight size={16} />
            Projected Income
          </span>

          <strong>
            {money(projectedIncome)}
          </strong>
        </div>

        <div>
          <span>
            <ArrowDownRight size={16} />
            Projected Expense
          </span>

          <strong>
            {money(projectedExpense)}
          </strong>
        </div>
      </div>

      <div className="forecastResult">
        <span>Estimated Funds Position</span>

        <strong>
          {money(projectedFunds)}
        </strong>
      </div>
    </div>
  );
}