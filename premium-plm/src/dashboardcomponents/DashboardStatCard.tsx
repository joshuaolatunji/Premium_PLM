import type { DashboardStat } from "../../src/types/dashboardTypes";

interface DashboardStatCardProps {
  stat: DashboardStat;
  onClick?: () => void;
  isActive?: boolean;
}

function DashboardStatCard({
  stat,
  onClick,
  isActive,
}: DashboardStatCardProps) {
  const className = [
    "dashboard-stat-card",
    onClick ? "dashboard-stat-card--clickable" : "",
    isActive ? "dashboard-stat-card--active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!onClick) {
    return (
      <article className={className}>
        <p className="dashboard-stat-card__label">
          {stat.label}
        </p>

        <p className="dashboard-stat-card__value">
          {stat.value}
        </p>

        <p
          className={`dashboard-stat-card__description dashboard-stat-card__description--${stat.descriptionType}`}
        >
          {stat.description}
        </p>
      </article>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-pressed={isActive}>
      <p className="dashboard-stat-card__label">
        {stat.label}
      </p>

      <p className="dashboard-stat-card__value">
        {stat.value}
      </p>

      <p
        className={`dashboard-stat-card__description dashboard-stat-card__description--${stat.descriptionType}`}
      >
        {stat.description}
      </p>
    </button>
  );
}

export default DashboardStatCard;
