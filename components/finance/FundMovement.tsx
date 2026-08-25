import { ArrowRight } from "lucide-react";

interface FundMovementProps {
  from: string;
  to: string;
  amount: string;
  description?: string;
  date?: string;
  status?: "completed" | "pending" | "cancelled";
}

export default function FundMovement({
  from,
  to,
  amount,
  description,
  date,
  status = "completed",
}: FundMovementProps) {
  return (
    <article className="fund-movement">
      <div className="fund-movement__route">
        <div className="fund-movement__fund">
          <span className="fund-movement__label">FROM</span>
          <strong>{from}</strong>
        </div>

        <div className="fund-movement__arrow">
          <ArrowRight size={20} />
        </div>

        <div className="fund-movement__fund">
          <span className="fund-movement__label">TO</span>
          <strong>{to}</strong>
        </div>
      </div>

      <div className="fund-movement__details">
        <div>
          <span>Movement Amount</span>
          <strong>{amount}</strong>
        </div>

        <div className={`fund-movement__status status-${status}`}>
          {status}
        </div>
      </div>

      {(description || date) && (
        <div className="fund-movement__footer">
          {description && <span>{description}</span>}
          {date && <span>{date}</span>}
        </div>
      )}
    </article>
  );
}