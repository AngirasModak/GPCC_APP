type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: Props) {
  return (
    <div className="sectionHeader">
      <div>
        {eyebrow && (
          <div className="eyebrow">
            {eyebrow}
          </div>
        )}

        <h2>{title}</h2>

        {subtitle && (
          <p>{subtitle}</p>
        )}
      </div>

      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}