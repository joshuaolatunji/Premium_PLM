import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getStoredUser } from "../apicalls/authStorage";
import { capitalize } from "../utils/text";

interface DashboardHeaderProps {
  onOpenCreateInitiative: () => void;
  overSlaBrdCount: number;
}

function DashboardHeader({ onOpenCreateInitiative, overSlaBrdCount }: DashboardHeaderProps) {
  const navigate = useNavigate();
  const user = getStoredUser();

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
          Hello, {user?.userName ? capitalize(user.userName) : "there"}
        </h1>

        <p className="dashboard-subtitle">
          {today}
          {overSlaBrdCount > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              <strong>
                {overSlaBrdCount} BRD{overSlaBrdCount === 1 ? "" : "s"}{" "}
                {overSlaBrdCount === 1 ? "has" : "have"} been waiting more than 3 days.
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
