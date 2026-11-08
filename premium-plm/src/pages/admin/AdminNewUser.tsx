import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { sileo } from "sileo";

import { getAllUsers } from "../../service/UserService";
import { assignRole, createUser, getAllRoles } from "../../service/AdminService";
import { ApiError } from "../../apicalls/apiClient";
import { formatRoleName } from "../../utils/text";
import { useDraftState } from "../../utils/useDraftState";
import BackLink from "../../components/common/BackLink";
import DraftRestoredNotice from "../../components/common/DraftRestoredNotice";

const USERS_QUERY_KEY = ["plm-users"];
const EMPTY_FORM = { username: "", emailAddress: "", firstName: "", lastName: "" };

// The Super Admin's "New user" page: username, email, name and role. Once
// created, it goes back to the Users list with a confirmation.
function AdminNewUser() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Kept on this device until the user is created (see useDraftState). There
  // is no password field; those are never stored.
  const [form, setForm, formDraft] = useDraftState("admin-new-user", EMPTY_FORM);
  const [roleId, setRoleId, roleDraft] = useDraftState("admin-new-user:role", "");
  const drafts = [formDraft, roleDraft];
  const [error, setError] = useState("");

  const rolesQuery = useQuery({ queryKey: ["plm-roles"], queryFn: getAllRoles });

  const createMutation = useMutation({
    mutationFn: async () => {
      await createUser(form);

      // create-user has no role field and doesn't return the new user's id,
      // so the role is assigned right after: find the new user by their
      // (unique) email in a fresh list, then assign it.
      const created = (await getAllUsers()).find(
        (user) => user.email.toLowerCase() === form.emailAddress.trim().toLowerCase(),
      );

      if (!created) {
        throw new Error("User was created, but couldn't be found to give them a role. Set it from Manage instead.");
      }

      await assignRole({ userId: created.userId, roleId });
    },
    onSuccess: async () => {
      drafts.forEach((draft) => draft.discard());
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
      sileo.success({
        title: "User created",
        description: `${form.firstName.trim() || form.username.trim()} can now sign in as ${formatRoleName(
          rolesQuery.data?.find((role) => role.roleId === roleId)?.roleName ?? "",
        )}.`,
      });
      navigate("/dashboard/admin/users", { replace: true });
    },
    onError: async (caught) => {
      setError(caught instanceof ApiError || caught instanceof Error ? caught.message : "Unable to create this user.");
      await queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
    },
  });

  function update(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleCreate() {
    if (!form.username.trim() || !form.emailAddress.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setError("Fill in every field.");
      return;
    }

    if (!roleId) {
      setError("Choose a role for this user.");
      return;
    }

    setError("");
    createMutation.mutate();
  }

  const fields: { key: keyof typeof EMPTY_FORM; label: string; type: "text" | "email" }[][] = [
    [
      { key: "username", label: "Username", type: "text" },
      { key: "emailAddress", label: "Email", type: "email" },
    ],
    [
      { key: "firstName", label: "First name", type: "text" },
      { key: "lastName", label: "Last name", type: "text" },
    ],
  ];

  return (
    <div className="dashboard-page">
      <BackLink fallbackTo="/dashboard/admin/users" fallbackLabel="Back to users" />

      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Users / New user</p>

          <h1 className="dashboard-title">New user</h1>

          <p className="dashboard-subtitle">
            Add someone to Premium PLM and give them a role.
          </p>
        </div>
      </header>

      <DraftRestoredNotice
        savedAt={formDraft.restoredAt ?? roleDraft.restoredAt}
        onDiscard={() => drafts.forEach((draft) => draft.discard())}
        keepHint="Create the user to keep them."
      />

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Account details</h2>
            <p>Their sign-in name, email and full name.</p>
          </div>
        </div>

        <div className="proposal-section">
          {fields.map((row, index) => (
            <div className="form-field-row" key={index}>
              {row.map((field) => (
                <div className="form-field" key={field.key}>
                  <label htmlFor={`new-user-${field.key}`}>{field.label}</label>
                  <input
                    id={`new-user-${field.key}`}
                    type={field.type}
                    placeholder=" "
                    value={form[field.key]}
                    onChange={(event) => update(field.key, event.target.value)}
                    disabled={createMutation.isPending}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-panel initiative-detail-panel">
        <div className="dashboard-panel__header">
          <div>
            <h2>Role</h2>
            <p>Each user has one role. It decides their workspace and what they can do.</p>
          </div>
        </div>

        <div className="proposal-section">
          <div className="form-field">
            <label htmlFor="new-user-role">Role</label>
            <select
              id="new-user-role"
              value={roleId}
              onChange={(event) => setRoleId(event.target.value)}
              disabled={rolesQuery.isLoading || createMutation.isPending}
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

          {rolesQuery.isError && (
            <p className="form-error" role="alert">
              Couldn't load the roles. Try refreshing the page.
            </p>
          )}
        </div>
      </section>

      <div className="bdo-action-bar bdo-action-bar--static">
        <div>
          <p className="bdo-action-bar_hint">Fill in every field and choose a role, then create the user.</p>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="brd-reviews-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              // Cancelled on purpose, so what was typed isn't kept.
              drafts.forEach((draft) => draft.discard());
              navigate("/dashboard/admin/users");
            }}
            disabled={createMutation.isPending}
          >
            Cancel
          </button>

          <button type="button" className="button button--primary" onClick={handleCreate} disabled={createMutation.isPending}>
            <UserPlus size={17} aria-hidden="true" />
            {createMutation.isPending ? "Creating…" : "Create user"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminNewUser;
