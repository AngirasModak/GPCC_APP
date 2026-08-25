import { ReactNode } from "react";

export interface TimelineItem {
  id: string | number;
  title: string;
  description?: string;
  amount?: string;
  date: string;
  icon?: ReactNode;
  status?: "completed" | "pending" | "cancelled";
}

interface ActivityTimelineProps {
  title?: string;
  subtitle?: string;
  items: TimelineItem[];
}

export default function ActivityTimeline({
  title = "Recent Activity",
  subtitle = "Latest financial movements",
  items,
}: ActivityTimelineProps) {
  return (
    <section className="finance-panel activity-timeline">
      <div className="finance-panel__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="activity-timeline__empty">
          No recent financial activity.
        </div>
      ) : (
        <div className="activity-timeline__list">
          {items.map((item) => (
            <div
              key={item.id}
              className="activity-timeline__item"
            >
              <div className="activity-timeline__rail">
                <div className="activity-timeline__icon">
                  {item.icon}
                </div>

                <div className="activity-timeline__line" />
              </div>

              <div className="activity-timeline__content">
                <div className="activity-timeline__main">
                  <div>
                    <h4>{item.title}</h4>

                    {item.description && (
                      <p>{item.description}</p>
                    )}
                  </div>

                  {item.amount && (
                    <strong className="activity-timeline__amount">
                      {item.amount}
                    </strong>
                  )}
                </div>

                <div className="activity-timeline__meta">
                  <span>{item.date}</span>

                  {item.status && (
                    <span
                      className={`activity-status activity-status--${item.status}`}
                    >
                      {item.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}