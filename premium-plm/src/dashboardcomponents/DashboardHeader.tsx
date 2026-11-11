import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUserFirstName } from "../apicalls/authStorage";

interface DashboardHeaderProps {
  onOpenCreateInitiative: () => void;
  // Approvals (of any kind) waiting on the Group Head for over 3 days.
  overSlaApprovalCount: number;
}

function DashboardHeader({ onOpenCreateInitiative, overSlaApprovalCount }: DashboardHeaderProps) {
  const navigate = useNavigate();

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="dashboard-header">
      <div className="dashboard-header__content">
        {/* <p className="dashboard-breadcrumb">
          PremiumPLM / Dashboard
        </p> */}

        <h1 className="dashboard-title">
          Hello, {getCurrentUserFirstName() || "there"}
        </h1>

        <p className="dashboard-subtitle">
          {today}
          {overSlaApprovalCount > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              <strong>
                {overSlaApprovalCount} approval{overSlaApprovalCount === 1 ? "" : "s"}{" "}
                {overSlaApprovalCount === 1 ? "has" : "have"} been waiting more than 3 days.
              </strong>
            </>
          )}
        </p>
      </div>

      <div className="dashboard-header__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => navigate("/dashboard/priorities")}
        >
          Manage priorities
        </button>

        <button
          type="button"
          className="button button--primary"
          onClick={onOpenCreateInitiative}
        >
          <Plus size={17} strokeWidth={2} />

          <span>New initiative</span>
        </button>
      </div>
    </header>
  );
}

export default DashboardHeader;
