import { useNavigate } from "react-router-dom";

import { clearAuthSession, getStoredUser } from "../../apicalls/authStorage";
import { capitalize, formatRoleName } from "../../utils/text";
import UserAvatar from "../../components/ui/UserAvatar";

function Profile() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.userName ? capitalize(user.userName) : "Guest";

  function handleLogout() {
    clearAuthSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Profile</p>
          <h1 className="dashboard-title">My profile</h1>
        </div>

        <div className="dashboard-header__actions">
          <button type="button" className="button button--primary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Account</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="profile-identity-row">
            <UserAvatar name={displayName} size="lg" />

            <div>
              <p className="initiative-detail-grid_value">
                <strong>{displayName}</strong>
              </p>
              <p className="initiative-detail-grid_label">{user?.email ?? "—"}</p>
            </div>
          </div>

          <div className="initiative-detail-grid">
            <div>
              <span className="initiative-detail-grid_label">Role</span>
              <span className="initiative-detail-grid_value">
                {user && user.roles.length > 0
                  ? user.roles.map(formatRoleName).join(" · ")
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Profile;
