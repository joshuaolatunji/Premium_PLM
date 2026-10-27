import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDraftState } from "../../utils/useDraftState";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";

import { getAllUsers } from "../../service/UserService";
import {
  activateUser,
  assignRole,
  createUser,
  deactivateUser,
  getAllRoles,
  removeUserRole,
} from "../../service/AdminService";
import { ApiError } from "../../apicalls/apiClient";
import { capitalize, formatRoleName } from "../../utils/text";
import { isUserActive } from "../../utils/userStatus";
import UserAvatar from "../../components/ui/UserAvatar";
import type { PLMUser } from "../../types/userTypes";

const USERS_QUERY_KEY = ["plm-users"];

function errorMessageFrom(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

// Each user has exactly one role. The API still sends it in a list.
function roleOf(user: PLMUser): string | null {
  return user.role[0] ?? null;
}

const TOAST_DURATION_MS = 4_000;

function AdminUsers() {
  const queryClient = useQueryClient();

  // The new-user form is kept on this device until the user is created
  // (see useDraftState). It has no password field — those are never stored.
  const [createForm, setCreateForm, createFormDraft] = useDraftState("admin-new-user", {
    username: "",
    emailAddress: "",
    firstName: "",
    lastName: "",
  });
  const [createRoleId, setCreateRoleId, createRoleDraft] = useDraftState("admin-new-user:role", "");
  const newUserDrafts = [createFormDraft, createRoleDraft];
  // Reopens the form if a half-filled user was restored.
  const [isCreating, setIsCreating] = useState(
    () => Object.values(createForm).some(Boolean) || Boolean(createRoleId),
  );
  const newUserRestoredAt = createFormDraft.restoredAt ?? createRoleDraft.restoredAt;
  const [createError, setCreateError] = useState("");

  const [managingUserId, setManagingUserId] = useState<string | null>(null);
  // The user whose activate/deactivate is being confirmed.
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
  // Short-lived confirmation ("User created successfully.", "Daniel
  // deactivated.") shown as a toast at the top of the screen.
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

  const users = useMemo(
    // Alphabetical by name — the API returns users in no meaningful order
    // and has no `createdAt` to sort newest-first by. Switch to that once
    // the backend adds it.
    () =>
      (usersQuery.data ?? []).toSorted((a, b) =>
        (a.userName ?? "").localeCompare(b.userName ?? "", undefined, { sensitivity: "base" }),
      ),
    [usersQuery.data],
  );

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
          "User was created, but couldn't be found to give them a role. Set it from Manage instead.",
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

  const statusMutation = useMutation({
    mutationFn: (user: PLMUser) => (isUserActive(user) ? deactivateUser(user.userId) : activateUser(user.userId)),
    onSuccess: (_data, user) => {
      setStatusError("");
      setStatusUserId(null);
      setToastMessage(`${capitalize(user.userName)} ${isUserActive(user) ? "deactivated" : "activated"}.`);
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error, user) => {
      setStatusError(
        errorMessageFrom(error, isUserActive(user) ? "Unable to deactivate this user." : "Unable to activate this user."),
      );
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

  const managingUser = users.find((user) => user.userId === managingUserId) ?? null;
  const statusUser = users.find((user) => user.userId === statusUserId) ?? null;

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
            Create users, change their role, and activate or deactivate accounts.
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

      <DraftRestoredNotice
        savedAt={newUserRestoredAt}
        onDiscard={() => newUserDrafts.forEach((draft) => draft.discard())}
        keepHint="Create the user to keep them."
      />

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
              onClick={() => {
                // Cancelled on purpose — don't keep what was typed.
                newUserDrafts.forEach((draft) => draft.discard());
                setIsCreating(false);
              }}
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
                <th>Role</th>
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
                users.map((user) => {
                  const role = roleOf(user);
                  const active = isUserActive(user);

                  return (
                    <tr key={user.userId}>
                      <td>
                        <strong>{capitalize(user.userName)}</strong>
                      </td>

                      <td>{user.email}</td>

                      <td>
                        {role ? (
                          <span className="role-chip">{formatRoleName(role)}</span>
                        ) : (
                          <span className="admin-users-empty-roles">No role</span>
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            active ? "status-badge status-badge--approved" : "status-badge status-badge--overdue"
                          }
                        >
                          {active ? "Active" : "Inactive"}
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
                            className={active ? "table-action table-action--premium" : "table-action table-action--success"}
                            onClick={() => {
                              setStatusError("");
                              setStatusUserId(user.userId);
                            }}
                          >
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!isLoading && !hasError && users.length === 0 && (
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
        <ChangeRoleModal
          user={managingUser}
          availableRoles={rolesQuery.data ?? []}
          onClose={() => setManagingUserId(null)}
          onChanged={(roleName) => {
            setToastMessage(`${capitalize(managingUser.userName)} is now ${formatRoleName(roleName)}.`);
            setManagingUserId(null);
          }}
        />
      )}

      {statusUser && (
        <div className="modal-overlay" role="presentation" onClick={() => !statusMutation.isPending && setStatusUserId(null)}>
          <div
            className="modal-panel modal-panel--compact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-status-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel_header">
              <h2 id="user-status-title">
                {isUserActive(statusUser) ? "Deactivate" : "Activate"} {capitalize(statusUser.userName)}?
              </h2>
            </div>

            <div className="modal-panel_body">
              <p className="brd-confirm-copy">
                {isUserActive(statusUser)
                  ? "They won't be able to sign in, and can't be assigned to anything new. Their existing work stays as it is. You can activate them again at any time."
                  : "They'll be able to sign in again and can be assigned to work."}
              </p>

              {statusError && (
                <p className="form-error" role="alert">
                  {statusError}
                </p>
              )}
            </div>

            <div className="modal-panel_footer">
              <button
                type="button"
                className="button button--secondary"
                onClick={() => setStatusUserId(null)}
                disabled={statusMutation.isPending}
              >
                Cancel
              </button>

              <button
                type="button"
                className="button button--primary"
                onClick={() => statusMutation.mutate(statusUser)}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? "Working…" : isUserActive(statusUser) ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ChangeRoleModalProps {
  user: PLMUser;
  availableRoles: { roleId: string | null; roleName: string | null }[];
  onClose: () => void;
  onChanged: (roleName: string) => void;
}

// A user has exactly one role, so it's changed rather than added to: the new
// role is assigned, then the old one removed (unless the API already
// replaced it). The API has no single "change role" call (gaps file R21).
function ChangeRoleModal({ user, availableRoles, onClose, onChanged }: ChangeRoleModalProps) {
  const queryClient = useQueryClient();
  const currentRole = roleOf(user);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleError, setRoleError] = useState("");

  const roles = availableRoles.filter((role) => role.roleId && role.roleName && role.roleName !== currentRole);
  const currentRoleId = availableRoles.find((role) => role.roleName === currentRole)?.roleId ?? null;

  const changeMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await assignRole({ userId: user.userId, roleId });

      if (currentRole && currentRoleId) {
        const fresh = (await getAllUsers()).find((entry) => entry.userId === user.userId);

        if (fresh?.role.includes(currentRole)) {
          await removeUserRole({ userId: user.userId, roleId: currentRoleId });
        }
      }

      return availableRoles.find((role) => role.roleId === roleId)?.roleName ?? "";
    },
    onSuccess: async (roleName) => {
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      onChanged(roleName);
    },
    onError: async (error) => {
      setRoleError(errorMessageFrom(error, "Unable to change this user's role."));
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });

  const active = isUserActive(user);
  const newRoleName = availableRoles.find((role) => role.roleId === selectedRoleId)?.roleName ?? null;

  return (
    <div className="modal-overlay" role="presentation" onClick={() => !changeMutation.isPending && onClose()}>
      <div
        className="modal-panel user-manage-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-user-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="user-manage-modal_header">
          <UserAvatar name={capitalize(user.userName)} size="lg" />

          <div className="user-manage-modal_identity">
            <h2 id="manage-user-title">{capitalize(user.userName)}</h2>
            <p title={user.email}>{user.email}</p>
          </div>

          <span className={active ? "status-badge status-badge--approved" : "status-badge status-badge--overdue"}>
            {active ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="modal-panel_body user-manage-modal_body">
          <h3 className="user-manage-modal_section-title">Role</h3>

          <dl className="user-manage-modal_roles">
            <div className="user-manage-modal_row">
              <dt>Current role</dt>
              <dd>
                <span className="role-chip">{currentRole ? formatRoleName(currentRole) : "No role"}</span>
              </dd>
            </div>

            <div className="user-manage-modal_row">
              <dt>
                <label htmlFor="changeRoleId">New role</label>
              </dt>
              <dd className="form-field">
                <select
                  id="changeRoleId"
                  value={selectedRoleId}
                  onChange={(event) => {
                    setRoleError("");
                    setSelectedRoleId(event.target.value);
                  }}
                  disabled={changeMutation.isPending}
                >
                  <option value="" disabled>
                    Select a role
                  </option>

                  {roles.map((role) => (
                    <option key={role.roleId} value={role.roleId as string}>
                      {formatRoleName(role.roleName as string)}
                    </option>
                  ))}
                </select>
              </dd>
            </div>
          </dl>

          <p className="user-manage-modal_hint">
            {newRoleName
              ? `${capitalize(user.userName)} will become ${formatRoleName(newRoleName)} and lose ${
                  currentRole ? formatRoleName(currentRole) : "their current role"
                }. Their workspace changes the next time they sign in.`
              : "A user has one role. Choosing a new one replaces it."}
          </p>

          {roleError && (
            <p className="form-error" role="alert">
              {roleError}
            </p>
          )}
        </div>

        <div className="modal-panel_footer">
          <button type="button" className="button button--secondary" onClick={onClose} disabled={changeMutation.isPending}>
            Cancel
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={() => selectedRoleId && changeMutation.mutate(selectedRoleId)}
            disabled={!selectedRoleId || changeMutation.isPending}
          >
            {changeMutation.isPending ? "Changing…" : "Change role"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
