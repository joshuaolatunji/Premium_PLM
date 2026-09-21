import { Plus } from "lucide-react";

function DashboardHeader() {
  return (
    <header className="dashboard-header">
      <div className="dashboard-header__content">
        <p className="dashboard-breadcrumb">
          PremiumPLM / Dashboard
        </p>

        <h1 className="dashboard-title">
          Good morning, Chidinma
        </h1>

        <p className="dashboard-subtitle">
          Monday, 8 September 2026
          <span aria-hidden="true"> · </span>
          <strong>
            3 BRDs have been waiting more than 3 days.
          </strong>
        </p>
      </div>

      <div className="dashboard-header__actions">
        <button
          type="button"
          className="button button--secondary"
        >
          Manage priorities
        </button>

        <button
          type="button"
          className="button button--primary"
        >
          <Plus size={17} strokeWidth={2} />

          <span>New initiative</span>
        </button>
      </div>
    </header>
  );
}

export default DashboardHeader;