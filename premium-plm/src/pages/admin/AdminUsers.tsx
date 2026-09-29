import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAllUsers } from "../../service/UserService";
import {
  assignRole,
  createUser,
  getAllRoles,
  removeUserRole,
  resetUserPassword,
} from "../../service/AdminService";
import { getHiddenUserIds, hideUser } from "../../mocks/adminMock";
import { ApiError } from "../../apicalls/apiClient";
import { capitalize } from "../../utils/text";
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
  const [createSuccess, setCreateSuccess] = useState("");

  const [managingUserId, setManagingUserId] = useState<string | null>(null);

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
    () => (usersQuery.data ?? []).filter((user) => !hiddenIds.has(user.userId)),
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

      // create-user has no role field (RegisterDto only takes
      // username/email/name) and doesn't hand back the new user's id, so
      // assigning a role at creation means creating first, then finding
      // the new user by their (unique) email in a fresh list, then
      // assigning — three real calls chained client-side.
      if (createRoleId) {
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
      }
    },
    onSuccess: () => {
      setCreateError("");
      setCreateSuccess("User created successfully.");
      setCreateForm({ username: "", emailAddress: "", firstName: "", lastName: "" });
      setCreateRoleId("");
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error) => {
      setCreateSuccess("");
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
      setCreateSuccess("");
      setCreateError("Fill in every field.");
      return;
    }

    setCreateError("");
    createMutation.mutate();
  }

  const isLoading = usersQuery.isLoading || rolesQuery.isLoading;
  const hasError = usersQuery.isError || rolesQuery.isError;

  const managingUser = visibleUsers.find((user) => user.userId === managingUserId) ?? null;

  return (
    <div className="dashboard-page">
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
              setCreateSuccess("");
              setCreateError("");
            }}
            disabled={isCreating}
          >
            + New user
          </button>
        </div>
      </header>

      <p className="mock-data-notice">
        There's no real "delete user" endpoint on the live API yet — only
        role removal. "Remove" below just hides a user from this list for
        this session; it resets if you reload the page.
      </p>

      {isCreating && (
        <section className="dashboard-panel initiative-detail-panel">
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
                <option value="">
                  {rolesQuery.isLoading ? "Loading roles…" : "No role (assign later)"}
                </option>

                {(rolesQuery.data ?? [])
                  .filter((role) => role.roleId && role.roleName)
                  .map((role) => (
                    <option key={role.roleId} value={role.roleId as string}>
                      {role.roleName}
                    </option>
                  ))}
              </select>
            </div>

            {createError && (
              <p className="form-error" role="alert">
                {createError}
              </p>
            )}

            {createSuccess && (
              <p className="brd-status-message" role="status">
                {createSuccess}
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
                              {roleName}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          user.isLockedOut
                            ? "status-badge status-badge--overdue"
                            : "status-badge status-badge--approved"
                        }
                      >
                        {user.isLockedOut ? "Locked" : "Active"}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="table-action"
                        onClick={() => setManagingUserId(user.userId)}
                      >
                        Manage
                      </button>
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

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const [removeError, setRemoveError] = useState("");

  function invalidateUser() {
    queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

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

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      resetUserPassword({
        email: user.email,
        newPassword,
        confirmPassword,
      }),
    onSuccess: () => {
      setPasswordError("");
      setPasswordSuccess("Password reset.");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      setPasswordSuccess("");
      setPasswordError(errorMessageFrom(error, "Unable to reset this password."));
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

  function handleResetPassword() {
    if (!newPassword || !confirmPassword) {
      setPasswordSuccess("");
      setPasswordError("Enter and confirm the new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordSuccess("");
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordError("");
    resetPasswordMutation.mutate();
  }

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
                        {roleName}
                        <button
                          type="button"
                          className="role-chip_remove"
                          aria-label={`Remove ${roleName}`}
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
                      {role.roleName}
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

          <div className="proposal-section">
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
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
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

            {passwordSuccess && (
              <p className="brd-status-message" role="status">
                {passwordSuccess}
              </p>
            )}

            <button
              type="button"
              className="button button--secondary"
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? "Resetting…" : "Reset password"}
            </button>
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

export default AdminUsers;
