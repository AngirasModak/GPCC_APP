import {
  ArrowRight,
  CircleDollarSign,
  Receipt,
  Landmark,
} from "lucide-react";

type Props = {
  bank: number;
  pettyCash: number;
  monthlyExpense: number;
};

export default function ActionCentre({
  bank,
  pettyCash,
  monthlyExpense,
}: Props) {
  const actions = [];

  if (pettyCash < 2000) {
    actions.push({
      icon: <CircleDollarSign size={18} />,
      title: "Review Petty Cash",
      text: "Petty cash balance is approaching the operational threshold.",
    });
  }

  if (monthlyExpense > bank * 0.4) {
    actions.push({
      icon: <Receipt size={18} />,
      title: "Review Expense Run Rate",
      text: "Current expenditure is relatively high compared with available bank liquidity.",
    });
  }

  if (!actions.length) {
    actions.push({
      icon: <Landmark size={18} />,
      title: "Financial Position Stable",
      text: "No immediate liquidity or expenditure intervention is required.",
    });
  }

  return (
    <div className="actionCard">
      <div className="eyebrow">
        DECISION SUPPORT
      </div>

      <h2>Recommended Actions</h2>

      <div className="actionList">
        {actions.map((action, index) => (
          <div
            className="actionItem"
            key={index}
          >
            <div className="actionIcon">
              {action.icon}
            </div>

            <div>
              <strong>{action.title}</strong>

              <p>{action.text}</p>
            </div>

            <ArrowRight size={18} />
          </div>
        ))}
      </div>
    </div>
  );
}