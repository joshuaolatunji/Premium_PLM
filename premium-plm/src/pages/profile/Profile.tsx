import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";

import { changePassword } from "../../service/LoginService";
import { ApiError } from "../../apicalls/apiClient";
import { clearAuthSession, getStoredUser } from "../../apicalls/authStorage";
import { capitalize, formatRoleName } from "../../utils/text";
import UserAvatar from "../../components/ui/UserAvatar";

function Profile() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const displayName = user?.userName ? capitalize(user.userName) : "Guest";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: () => changePassword({ currentPassword, newPassword, confirmPassword }),
    onSuccess: () => {
      setFormError("");
      setFormSuccess("Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      setFormSuccess("");
      setFormError(
        error instanceof ApiError ? error.message : "Unable to change your password. Try again.",
      );
    },
  });

  function handleChangePassword() {
    setFormSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError("Fill in all three fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("New password and confirmation don't match.");
      return;
    }

    setFormError("");
    changePasswordMutation.mutate();
  }

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

      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Change password</h2>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>

          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                maxLength={15}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                maxLength={15}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          {formSuccess && (
            <p className="brd-status-message" role="status">
              {formSuccess}
            </p>
          )}

          <button
            type="button"
            className="button button--primary button--align-start"
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? "Changing…" : "Change password"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default Profile;
