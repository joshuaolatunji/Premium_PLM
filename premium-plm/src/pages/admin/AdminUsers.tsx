import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAllUsers } from "../../service/UserService";
import { activateUser, assignRole, deactivateUser, getAllRoles, removeUserRole } from "../../service/AdminService";
import { ApiError } from "../../apicalls/apiClient";
import { capitalize, formatRoleName } from "../../utils/text";
import { isUserActive } from "../../utils/userStatus";
import UserAvatar from "../../components/ui/UserAvatar";
import type { PLMUser } from "../../types/userTypes";
import ModalShell from "../../components/common/ModalShell";
import SearchableSelect from "../../components/ui/SearchableSelect";
import { notifySuccess } from "../../utils/notify";

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

function AdminUsers() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [managingUserId, setManagingUserId] = useState<string | null>(null);
  // The user whose activate/deactivate is being confirmed.
  const [statusUserId, setStatusUserId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState("");
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

  const statusMutation = useMutation({
    mutationFn: (user: PLMUser) => (isUserActive(user) ? deactivateUser(user.userId) : activateUser(user.userId)),
    onSuccess: (_data, user) => {
      setStatusError("");
      setStatusUserId(null);
      notifySuccess({
        title: isUserActive(user) ? "User deactivated" : "User activated",
        description: isUserActive(user)
          ? `${capitalize(user.userName)} can no longer sign in.`
          : `${capitalize(user.userName)} can sign in again.`,
      });
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
    onError: (error, user) => {
      setStatusError(
        errorMessageFrom(error, isUserActive(user) ? "Unable to deactivate this user." : "Unable to activate this user."),
      );
    },
  });

  const isLoading = usersQuery.isLoading || rolesQuery.isLoading;
  const hasError = usersQuery.isError || rolesQuery.isError;

  const managingUser = users.find((user) => user.userId === managingUserId) ?? null;
  const statusUser = users.find((user) => user.userId === statusUserId) ?? null;

  return (
    <div className="dashboard-page">
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
            onClick={() => navigate("/dashboard/admin/users/new")}
          >
            <Plus size={17} aria-hidden="true" />
            New user
          </button>
        </div>
      </header>

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

      <AnimatePresence>
        {managingUser && (
          <ChangeRoleModal
            key={managingUser.userId}
            user={managingUser}
            availableRoles={rolesQuery.data ?? []}
            onClose={() => setManagingUserId(null)}
            onChanged={(roleName) => {
              notifySuccess({
                title: "Role changed",
                description: `${capitalize(managingUser.userName)} is now ${formatRoleName(roleName)}.`,
              });
              setManagingUserId(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {statusUser && (
          <ModalShell
            open
            onClose={() => setStatusUserId(null)}
            busy={statusMutation.isPending}
            labelledBy="user-status-title"
            className="modal-panel--compact"
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
          </ModalShell>
        )}
      </AnimatePresence>
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
    <ModalShell
      open
      onClose={onClose}
      busy={changeMutation.isPending}
      labelledBy="manage-user-title"
      className="user-manage-modal"
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
              <SearchableSelect
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
              </SearchableSelect>
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
    </ModalShell>
  );
}

export default AdminUsers;
