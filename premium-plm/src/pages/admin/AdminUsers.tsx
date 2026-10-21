import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAllUsers } from "../../service/UserService";
import {
  activateUser,
  assignRole,
  createUser,
  deactivateUser,
  getAllRoles,
  removeUserRole,
  resetUserPassword,
} from "../../service/AdminService";
import { getHiddenUserIds, hideUser } from "../../mocks/adminMock";
import { ApiError } from "../../apicalls/apiClient";
import { capitalize, formatRoleName } from "../../utils/text";
import { isUserActive } from "../../utils/userStatus";
import type { PLMUser } from "../../types/userTypes";

const USERS_QUERY_KEY = ["plm-users"];
const HIDDEN_IDS_QUERY_KEY = ["admin-hidden-user-ids"];

function errorMessageFrom(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

const TOAST_DURATION_MS = 4_000;

function AdminUsers() {
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    emailAddress: "",
    firstName: "",
    lastName: "",
  });
  const [createRoleId, setCreateRoleId] = useState("");
  const [createError, setCreateError] = useState("");

  const [managingUserId, setManagingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  // Short-lived confirmation ("User created successfully.", "Password
  // reset for …") shown as a toast at the top of the screen.
  const [toastMessage, setToastMessage] = useState("");

  // Auto-dismisses the toast after a few seconds. Re-runs (restarting the
  // timer) whenever a new message replaces the current one.
  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = setTimeout(() => setToastMessage(""), TOAST_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [toastMessage]);

  const usersQuery = useQuery({
    queryKey: USERS_QUERY_KEY,
    queryFn: getAllUsers,
  });

  const rolesQuery = useQuery({
    queryKey: ["plm-roles"],
    queryFn: getAllRoles,
  });

  const hiddenIdsQuery = useQuery({
    queryKey: HIDDEN_IDS_QUERY_KEY,
    queryFn: getHiddenUserIds,
  });

  const hiddenIds = useMemo(() => new Set(hiddenIdsQuery.data ?? []), [hiddenIdsQuery.data]);

  const visibleUsers = useMemo(
    // Alphabetical by name — the API returns users in no meaningful order
    // and has no `createdAt` to sort newest-first by. Switch to that once
    // the backend adds it.
    () =>
      (usersQuery.data ?? [])
        .filter((user) => !hiddenIds.has(user.userId))
        .toSorted((a, b) =>
          (a.userName ?? "").localeCompare(b.userName ?? "", undefined, { sensitivity: "base" }),
        ),
    [usersQuery.data, hiddenIds],
  );

  const roleNameToId = useMemo(() => {
    const map = new Map<string, string>();

    (rolesQuery.data ?? []).forEach((role) => {
      if (role.roleName && role.roleId) {
        map.set(role.roleName, role.roleId);
      }
    });

    return map;
  }, [rolesQuery.data]);

  const createMutation = useMutation({
    mutationFn: async () => {
      await createUser(createForm);

      // Every new user must get a role (enforced in handleCreate). But
      // create-user has no role field (RegisterDto only takes
      // username/email/name) and doesn't hand back the new user's id, so
      // the role is assigned right after: create, find the new user by
      // their (unique) email in a fresh list, then assign — three real
      // calls chained client-side.
      const freshUsers = await getAllUsers();
      const created = freshUsers.find(
        (user) => user.email.toLowerCase() === createForm.emailAddress.trim().toLowerCase(),
      );

      if (!created) {
        throw new Error(
          "User was created, but couldn't be found to assign the role. Assign it from the list instead.",
        );
      }

      await assignRole({ userId: created.userId, roleId: createRoleId });
    },
    onSuccess: () => {
      setCreateError("");
      setToastMessage("User created successfully.");
      setCreateForm({ username: "", emailAddress: "", firstName: "", lastName: "" });
      setCreateRoleId("");
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error) => {
      setCreateError(errorMessageFrom(error, "Unable to create this user."));
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });

  function handleCreate() {
    if (
      !createForm.username.trim() ||
      !createForm.emailAddress.trim() ||
      !createForm.firstName.trim() ||
      !createForm.lastName.trim()
    ) {
      setCreateError("Fill in every field.");
      return;
    }

    if (!createRoleId) {
      setCreateError("Choose a role for this user.");
      return;
    }

    setCreateError("");
    createMutation.mutate();
  }

  const isLoading = usersQuery.isLoading || rolesQuery.isLoading;
  const hasError = usersQuery.isError || rolesQuery.isError;

  const managingUser = visibleUsers.find((user) => user.userId === managingUserId) ?? null;
  const resettingUser = visibleUsers.find((user) => user.userId === resettingUserId) ?? null;

  return (
    <div className="dashboard-page">
      {toastMessage && (
        <div className="app-toast" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{toastMessage}</span>
          <button
            type="button"
            className="app-toast_close"
            onClick={() => setToastMessage("")}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Users</p>

          <h1 className="dashboard-title">Users</h1>

          <p className="dashboard-subtitle">
            Create users, assign or remove roles, and reset passwords.
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setIsCreating(true);
              setCreateError("");
            }}
            disabled={isCreating}
          >
            + New user
          </button>
        </div>
      </header>

      {isCreating && (
        <section className="dashboard-panel initiative-detail-panel admin-users-create-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>New user</h2>
            </div>
          </div>

          <div className="proposal-section">
            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="username">Username</label>
                <input
                  placeholder=" "
                  id="username"
                  type="text"
                  value={createForm.username}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, username: event.target.value }))
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="emailAddress">Email</label>
                <input
                  placeholder=" "
                  id="emailAddress"
                  type="email"
                  value={createForm.emailAddress}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      emailAddress: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="firstName">First name</label>
                <input
                  placeholder=" "
                  id="firstName"
                  type="text"
                  value={createForm.firstName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, firstName: event.target.value }))
                  }
                />
              </div>

              <div className="form-field">
                <label htmlFor="lastName">Last name</label>
                <input
                  placeholder=" "
                  id="lastName"
                  type="text"
                  value={createForm.lastName}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="createRoleId">Role</label>

              <select
                id="createRoleId"
                value={createRoleId}
                onChange={(event) => setCreateRoleId(event.target.value)}
                disabled={rolesQuery.isLoading}
              >
                <option value="" disabled>
                  {rolesQuery.isLoading ? "Loading roles…" : "Select a role"}
                </option>

                {(rolesQuery.data ?? [])
                  .filter((role) => role.roleId && role.roleName)
                  .map((role) => (
                    <option key={role.roleId} value={role.roleId as string}>
                      {formatRoleName(role.roleName as string)}
                    </option>
                  ))}
              </select>
            </div>

            {createError && (
              <p className="form-error" role="alert">
                {createError}
              </p>
            )}
          </div>

          <div className="modal-panel_footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setIsCreating(false)}
              disabled={createMutation.isPending}
            >
              Close
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create user"}
            </button>
          </div>
        </section>
      )}

      <section className="dashboard-panel">
        <div className="portfolio-table-wrapper">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    Loading users…
                  </td>
                </tr>
              )}

              {hasError && (
                <tr>
                  <td colSpan={5} className="initiatives-empty initiatives-empty--error">
                    Couldn't load users. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !hasError &&
                visibleUsers.map((user) => (
                  <tr key={user.userId}>
                    <td>
                      <strong>{capitalize(user.userName)}</strong>
                    </td>

                    <td>{user.email}</td>

                    <td>
                      {user.role.length === 0 ? (
                        <span className="admin-users-empty-roles">No roles</span>
                      ) : (
                        <ul className="role-chip-list">
                          {user.role.map((roleName) => (
                            <li key={roleName} className="role-chip">
                              {formatRoleName(roleName)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          isUserActive(user)
                            ? "status-badge status-badge--approved"
                            : "status-badge status-badge--overdue"
                        }
                      >
                        {isUserActive(user) ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="admin-users-row-actions">
                        <button
                          type="button"
                          className="table-action table-action--dark"
                          onClick={() => setManagingUserId(user.userId)}
                        >
                          Manage
                        </button>

                        <button
                          type="button"
                          className="table-action table-action--premium"
                          onClick={() => {
                            setResettingUserId(user.userId);
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!isLoading && !hasError && visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="initiatives-empty">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {managingUser && (
        <ManageUserModal
          user={managingUser}
          roleNameToId={roleNameToId}
          availableRoles={rolesQuery.data ?? []}
          onClose={() => setManagingUserId(null)}
        />
      )}

      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUserId(null)}
          onResetSuccess={() => {
            setToastMessage(`Password reset for ${capitalize(resettingUser.userName)}.`);
            setResettingUserId(null);
          }}
        />
      )}
    </div>
  );
}

interface ManageUserModalProps {
  user: PLMUser;
  roleNameToId: Map<string, string>;
  availableRoles: { roleId: string | null; roleName: string | null }[];
  onClose: () => void;
}

function ManageUserModal({
  user,
  roleNameToId,
  availableRoles,
  onClose,
}: ManageUserModalProps) {
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleError, setRoleError] = useState("");

  const [removeError, setRemoveError] = useState("");
  const [statusError, setStatusError] = useState("");

  function invalidateUser() {
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  const toggleActiveMutation = useMutation({
    mutationFn: () =>
      isUserActive(user) ? deactivateUser(user.userId) : activateUser(user.userId),
    onSuccess: () => {
      setStatusError("");
      invalidateUser();
    },
    onError: (error) => {
      setStatusError(
        errorMessageFrom(
          error,
          isUserActive(user) ? "Unable to deactivate this user." : "Unable to activate this user.",
        ),
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: (roleId: string) => assignRole({ userId: user.userId, roleId }),
    onSuccess: () => {
      setRoleError("");
      setSelectedRoleId("");
      invalidateUser();
    },
    onError: (error) => {
      setRoleError(errorMessageFrom(error, "Unable to assign this role."));
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleId: string) => removeUserRole({ userId: user.userId, roleId }),
    onSuccess: () => {
      setRoleError("");
      invalidateUser();
    },
    onError: (error) => {
      setRoleError(errorMessageFrom(error, "Unable to remove this role."));
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: () => hideUser(user.userId),
    onSuccess: () => {
      setRemoveError("");
      queryClient.invalidateQueries({ queryKey: HIDDEN_IDS_QUERY_KEY });
      onClose();
    },
    onError: () => {
      setRemoveError("Unable to remove this user. Try again.");
    },
  });

  const assignableRoles = availableRoles.filter(
    (role) => role.roleId && role.roleName && !user.role.includes(role.roleName),
  );

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-user-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel_header">
          <h2 id="manage-user-title">{capitalize(user.userName)}</h2>
        </div>

        <div className="modal-panel_body">
          <div className="proposal-section">
            <div className="form-field-row">
              <div>
                <label>Account status</label>

                <p
                  className={isUserActive(user) ? "brd-status-message" : "form-error"}
                  role="status"
                >
                  {isUserActive(user) ? "Active" : "Inactive"}
                </p>
              </div>

              <div className="form-field">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => toggleActiveMutation.mutate()}
                  disabled={toggleActiveMutation.isPending}
                >
                  {toggleActiveMutation.isPending
                    ? "Working…"
                    : isUserActive(user)
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </div>

            {statusError && (
              <p className="form-error" role="alert">
                {statusError}
              </p>
            )}
          </div>

          <div className="proposal-section">
            <div>
              <label>Roles</label>

              {user.role.length === 0 ? (
                <p className="admin-users-empty-roles">No roles assigned.</p>
              ) : (
                <ul className="role-chip-list">
                  {user.role.map((roleName) => {
                    const roleId = roleNameToId.get(roleName);

                    return (
                      <li key={roleName} className="role-chip">
                        {formatRoleName(roleName)}
                        <button
                          type="button"
                          className="role-chip_remove"
                          aria-label={`Remove ${formatRoleName(roleName)}`}
                          disabled={!roleId || removeRoleMutation.isPending}
                          onClick={() => roleId && removeRoleMutation.mutate(roleId)}
                        >
                          <X size={12} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="assignRoleId">Assign a role</label>

                <select
                  id="assignRoleId"
                  value={selectedRoleId}
                  onChange={(event) => setSelectedRoleId(event.target.value)}
                >
                  <option value="" disabled>
                    {assignableRoles.length === 0 ? "No roles left to assign" : "Select a role"}
                  </option>

                  {assignableRoles.map((role) => (
                    <option key={role.roleId} value={role.roleId as string}>
                      {formatRoleName(role.roleName as string)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>&nbsp;</label>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => selectedRoleId && assignMutation.mutate(selectedRoleId)}
                  disabled={!selectedRoleId || assignMutation.isPending}
                >
                  {assignMutation.isPending ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>

            {roleError && (
              <p className="form-error" role="alert">
                {roleError}
              </p>
            )}
          </div>

          {removeError && (
            <p className="form-error" role="alert">
              {removeError}
            </p>
          )}
        </div>

        <div className="modal-panel_footer">
          <button
            type="button"
            className="button button--secondary brd-reject-button"
            onClick={() => removeUserMutation.mutate()}
            disabled={removeUserMutation.isPending}
          >
            {removeUserMutation.isPending ? "Removing…" : "Remove user"}
          </button>

          <button type="button" className="button button--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// The Super Admin's password reset (PLMAuth/autoreset-password), opened
// from a user row's Reset button. The API doesn't generate a password — the
// admin sets one (max 15 chars, per the Swagger DTO). `email` always comes
// from the row it was opened for, never typed, so a reset can't land on the
// wrong account.
interface ResetPasswordFormProps {
  email: string;
  // Called after a successful reset — the Reset modal closes itself and
  // the page shows a confirmation toast.
  onSuccess: () => void;
}

function ResetPasswordForm({ email, onSuccess }: ResetPasswordFormProps) {
  const fieldId = useId();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const resetPasswordMutation = useMutation({
    mutationFn: () => resetUserPassword({ email, newPassword, confirmPassword }),
    onSuccess,
    onError: (error) => {
      setPasswordError(errorMessageFrom(error, "Unable to reset this password."));
    },
  });

  function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      setPasswordError("Enter and confirm the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordError("");
    resetPasswordMutation.mutate();
  }

  return (
    <>
      <div className="form-field">
        <label htmlFor={`${fieldId}-email`}>Email</label>
        <input id={`${fieldId}-email`} placeholder=" " type="email" value={email} readOnly disabled />
      </div>

      <div className="form-field-row">
        <div className="form-field">
          <label htmlFor={`${fieldId}-new`}>New password</label>
          <input
            placeholder=" "
            id={`${fieldId}-new`}
            type="password"
            autoComplete="new-password"
            maxLength={15}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label htmlFor={`${fieldId}-confirm`}>Confirm password</label>
          <input
            placeholder=" "
            id={`${fieldId}-confirm`}
            type="password"
            autoComplete="new-password"
            maxLength={15}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
      </div>

      {passwordError && (
        <p className="form-error" role="alert">
          {passwordError}
        </p>
      )}

      <button
        type="button"
        className="button button--dark"
        onClick={handleResetPassword}
        disabled={resetPasswordMutation.isPending}
      >
        {resetPasswordMutation.isPending ? "Resetting…" : "Reset password"}
      </button>
    </>
  );
}

interface ResetPasswordModalProps {
  user: PLMUser;
  onClose: () => void;
  onResetSuccess: () => void;
}

function ResetPasswordModal({ user, onClose, onResetSuccess }: ResetPasswordModalProps) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel_header">
          <h2 id="reset-password-title">Reset password — {capitalize(user.userName)}</h2>
        </div>

        <div className="modal-panel_body">
          <div className="proposal-section">
            <ResetPasswordForm email={user.email} onSuccess={onResetSuccess} />
          </div>
        </div>

        <div className="modal-panel_footer">
          <button type="button" className="button button--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
