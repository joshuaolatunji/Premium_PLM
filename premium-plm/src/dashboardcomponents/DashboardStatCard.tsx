import type { DashboardStat } from "../../src/types/dashboardTypes";

interface DashboardStatCardProps {
  stat: DashboardStat;
}

function DashboardStatCard({
  stat,
}: DashboardStatCardProps) {
  return (
    <article className="dashboard-stat-card">
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

export default DashboardStatCard;