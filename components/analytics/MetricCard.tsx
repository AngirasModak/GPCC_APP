import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Landmark,
  LucideIcon,
} from "lucide-react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon?: "wallet" | "bank" | "up" | "down";
  tone?: "green" | "blue" | "orange" | "red";
};

const icons: Record<string, LucideIcon> = {
  wallet: Wallet,
  bank: Landmark,
  up: TrendingUp,
  down: TrendingDown,
};

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon = "wallet",
  tone = "green",
}: Props) {
  const Icon = icons[icon];

  return (
    <div className={`metricCard ${tone}`}>
      <div className="metricTop">
        <div className="metricIcon">
          <Icon size={21} />
        </div>

        {trend !== undefined && (
          <div
            className={
              trend >= 0
                ? "trend positive"
                : "trend negative"
            }
          >
            {trend >= 0 ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}

            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div className="metricLabel">{title}</div>

      <div className="metricValue">{value}</div>

      {subtitle && (
        <div className="metricSub">
          {subtitle}
        </div>
      )}
    </div>
  );
}