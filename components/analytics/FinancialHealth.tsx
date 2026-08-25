type Props = {
  liquidity: number;
  cashFlow: number;
  expenseControl: number;
};

export default function FinancialHealth({
  liquidity,
  cashFlow,
  expenseControl,
}: Props) {
  const score = Math.round(
    liquidity * 0.4 +
      cashFlow * 0.35 +
      expenseControl * 0.25
  );

  return (
    <div className="healthCard">
      <div className="healthMain">
        <div className="healthGauge">
          <div className="healthScore">
            <strong>{score}</strong>
            <span>/100</span>
          </div>
        </div>

        <div>
          <div className="eyebrow">
            FINANCIAL HEALTH
          </div>

          <h2>
            {score >= 80
              ? "Excellent"
              : score >= 60
              ? "Stable"
              : "Needs Attention"}
          </h2>

          <p>
            Combined assessment of liquidity,
            cash-flow stability and expenditure
            control.
          </p>
        </div>
      </div>

      <div className="healthMetrics">
        <HealthRow
          label="Liquidity"
          value={liquidity}
        />

        <HealthRow
          label="Cash Flow"
          value={cashFlow}
        />

        <HealthRow
          label="Expense Control"
          value={expenseControl}
        />
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="healthRow">
      <div className="healthRowTop">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>

      <div className="progressTrack">
        <div
          className="progressFill"
          style={{
            width: `${Math.min(
              100,
              Math.max(0, value)
            )}%`,
          }}
        />
      </div>
    </div>
  );
}