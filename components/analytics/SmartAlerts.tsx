import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Bell,
} from "lucide-react";

export type AlertItem = {
  type: "success" | "warning" | "info";
  title: string;
  message: string;
};

export default function SmartAlerts({
  alerts,
}: {
  alerts: AlertItem[];
}) {
  const getIcon = (
    type: AlertItem["type"]
  ) => {
    if (type === "success") {
      return <CheckCircle2 size={20} />;
    }

    if (type === "warning") {
      return <AlertTriangle size={20} />;
    }

    return <Info size={20} />;
  };

  return (
    <div className="alertsCard">
      <div className="alertsHead">
        <div>
          <div className="eyebrow">
            LIVE MONITORING
          </div>

          <h2>Smart Notifications</h2>
        </div>

        <Bell size={20} />
      </div>

      <div className="alertList">
        {alerts.map((alert, index) => (
          <div
            key={index}
            className={`alertItem ${alert.type}`}
          >
            <div className="alertIcon">
              {getIcon(alert.type)}
            </div>

            <div>
              <strong>{alert.title}</strong>
              <p>{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}