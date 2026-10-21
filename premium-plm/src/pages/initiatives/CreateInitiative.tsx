import { useState, type SubmitEvent } from "react";

import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCategory, getCategories } from "../../service/CategoryService";
import { getAllUsers } from "../../service/UserService";
import { createInitiative, getProductInitiatives } from "../../service/InitiativeService";
import { ApiError } from "../../apicalls/apiClient";
import { getStoredUser } from "../../apicalls/authStorage";
import { INITIATIVE_PRIORITIES } from "../../types/initiativeTypes";
import type { CreateInitiativeRequest } from "../../types/initiativeTypes";
import { capitalize } from "../../utils/text";
import { resolvePrimaryRole } from "../../utils/roleRouting";
import { activeUsersWithRole } from "../../utils/userStatus";
import InitiativeCreatedPanel from "../../dashboardcomponents/InitiativeCreatedPanel";
import NumberInput from "../../components/ui/NumberInput";
import BackLink from "../../components/common/BackLink";

interface CreatedInitiativeInfo {
  initiativeId: string | null;
  projectName: string;
  bdoName: string | null;
  pmName: string | null;
}

// projectManagerId and bdoId are filled in from the pmId/bdoId selects
// below at submit time — the real create-initiative endpoint accepts both
// directly.
const EMPTY_FORM: CreateInitiativeRequest = {
  projectName: "",
  description: "",
  priority: 3,
  timelineDays: 30,
  categoryId: "",
  projectManagerId: null,
  bdoId: null,
};

// Full-page "New initiative" form (previously a modal), so the Group Head
// has room to read and fill everything in properly. Opened from the
// dashboard's and Initiatives page's "+ New initiative" buttons, which pass
// their own path as `from` so Cancel returns there.
function CreateInitiative() {
  const primaryRole = resolvePrimaryRole(getStoredUser()?.roles ?? []);

  // Only the Group Head creates initiatives.
  if (primaryRole !== "GroupHead") {
    return <Navigate to="/dashboard" replace />;
  }

  return <CreateInitiativeForm />;
}

function CreateInitiativeForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const returnTo =
    (location.state as { from?: string } | null)?.from ?? "/dashboard/initiatives";

  const [form, setForm] = useState<CreateInitiativeRequest>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState("");
  const [createdInfo, setCreatedInfo] = useState<CreatedInitiativeInfo | null>(null);

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newCategoryError, setNewCategoryError] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["plm-categories"],
    queryFn: getCategories,
  });

  const createCategoryMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: async (created) => {
      setNewCategoryError("");

      // The create-category response shape is undocumented like several
      // others we've integrated — if it didn't hand back the new category's
      // id, refetch and match by the name we just submitted so it can still
      // be auto-selected.
      let newCategoryId = created?.id ?? null;

      const refreshed = await getCategories();
      queryClient.setQueryData(["plm-categories"], refreshed);

      if (!newCategoryId) {
        newCategoryId =
          refreshed.find((category) => category.name === newCategoryName)?.id ?? null;
      }

      if (newCategoryId) {
        setForm((current) => ({ ...current, categoryId: newCategoryId as string }));
      }

      setIsAddingCategory(false);
      setNewCategoryName("");
      setNewCategoryDescription("");
    },
    onError: (error) => {
      setNewCategoryError(
        error instanceof ApiError ? error.message : "Unable to add this category.",
      );
    },
  });

  function handleAddCategory() {
    if (!newCategoryName.trim()) {
      setNewCategoryError("A category name is required.");
      return;
    }

    setNewCategoryError("");
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      description: newCategoryDescription.trim(),
    });
  }

  function handleCancelAddCategory() {
    setIsAddingCategory(false);
    setNewCategoryName("");
    setNewCategoryDescription("");
    setNewCategoryError("");
  }

  const [bdoId, setBdoId] = useState("");
  const [pmId, setPmId] = useState("");

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  // Only active accounts can be assigned — deactivated users are left out.
  const bdos = activeUsersWithRole(usersQuery.data, "BusinessDevelopmentOfficer");
  const pms = activeUsersWithRole(usersQuery.data, "ProjectManager");

  const mutation = useMutation({
    mutationFn: async (payload: CreateInitiativeRequest) => {
      const created = await createInitiative(payload);
      let initiativeId = created?.id ?? null;

      // The create-initiative response schema is undocumented — if it
      // didn't hand back the new record's id, fall back to matching it by
      // name in a fresh list, the same defensive pattern used for BRD
      // proposals.
      if (!initiativeId) {
        const refreshed = await getProductInitiatives();
        initiativeId =
          refreshed.find((initiative) => initiative.projectName === payload.projectName)?.id ??
          null;
      }

      return initiativeId;
    },
    onSuccess: (initiativeId, payload) => {
      queryClient.invalidateQueries({ queryKey: ["product-initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["product-initiatives-my-assigned"] });

      const bdo = bdos.find((user) => user.userId === payload.bdoId);
      const pm = pms.find((user) => user.userId === payload.projectManagerId);

      if (!initiativeId) {
        setErrorMessage(
          "The initiative was created, but its id couldn't be confirmed. Refresh the initiative list to find it.",
        );
      }

      setCreatedInfo({
        initiativeId,
        projectName: payload.projectName,
        bdoName: bdo ? capitalize(bdo.userName) : null,
        pmName: pm ? capitalize(pm.userName) : null,
      });
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError ? error.message : "Unable to create initiative. Please try again.",
      );
    },
  });

  function handleCancel() {
    if (mutation.isPending) {
      return;
    }

    navigate(returnTo);
  }

  function handleOpenInitiative() {
    navigate(
      createdInfo?.initiativeId ? `/dashboard/initiatives/${createdInfo.initiativeId}` : returnTo,
    );
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.projectName.trim() || !form.description.trim() || !form.categoryId || !bdoId || !pmId) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (form.timelineDays <= 0) {
      setErrorMessage("Timeline must be at least 1 day.");
      return;
    }

    mutation.mutate({ ...form, projectManagerId: pmId, bdoId });
  }

  return (
    <div className="dashboard-page create-initiative-page">
      <BackLink fallbackTo={returnTo} fallbackLabel="Back" />

      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Initiatives / New initiative</p>

          <h1 className="dashboard-title">New initiative</h1>

          <p className="dashboard-subtitle">
            Define the initiative, plan its timeline, and assign the people who'll deliver it.
          </p>
        </div>
      </header>

      {createdInfo ? (
        <section className="dashboard-panel create-initiative-success">
          <InitiativeCreatedPanel
            projectName={createdInfo.projectName}
            bdoName={createdInfo.bdoName}
            pmName={createdInfo.pmName}
            onOpenInitiative={handleOpenInitiative}
          />

          {errorMessage && (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          )}
        </section>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <section className="dashboard-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Initiative details</h2>
                <p>What this initiative is and why it matters.</p>
              </div>
            </div>

            <div className="proposal-section">
              <div className="form-field">
                <label htmlFor="projectName">Project name</label>

                <input
                  id="projectName"
                  type="text"
                  value={form.projectName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, projectName: event.target.value }))
                  }
                  placeholder="e.g. NGX Integration"
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="description">Description</label>

                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="Briefly describe the initiative"
                  rows={4}
                  required
                />
              </div>
            </div>
          </section>

          <section className="dashboard-panel initiative-detail-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Planning</h2>
                <p>Priority, delivery timeline, and the product category it belongs to.</p>
              </div>
            </div>

            <div className="proposal-section">
              <div className="form-field-row">
                <div className="form-field">
                  <label htmlFor="priority">Priority</label>

                  <select
                    id="priority"
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, priority: Number(event.target.value) }))
                    }
                  >
                    {INITIATIVE_PRIORITIES.map((priority) => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="timelineDays">Timeline (days)</label>

                  <NumberInput
                    id="timelineDays"
                    min={1}
                    value={form.timelineDays}
                    onValueChange={(value) =>
                      setForm((current) => ({ ...current, timelineDays: value }))
                    }
                    required
                  />
                  <p className="form-field_hint">
                    The countdown starts once the BRD is approved.
                  </p>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="categoryId">Category</label>

                <select
                  id="categoryId"
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, categoryId: event.target.value }))
                  }
                  disabled={categoriesQuery.isLoading}
                  required
                >
                  <option value="" disabled>
                    {categoriesQuery.isLoading ? "Loading categories…" : "Select a category"}
                  </option>

                  {categoriesQuery.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {categoriesQuery.isError && (
                  <p className="form-field_hint form-field_hint--error">
                    Couldn't load categories. Try refreshing the page.
                  </p>
                )}

                {!isAddingCategory && (
                  <button
                    type="button"
                    className="text-button category-add-toggle"
                    onClick={() => setIsAddingCategory(true)}
                  >
                    + New category
                  </button>
                )}

                {isAddingCategory && (
                  <div className="category-add-form">
                    <div className="form-field">
                      <label htmlFor="newCategoryName">Category name</label>

                      <input
                        id="newCategoryName"
                        type="text"
                        value={newCategoryName}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        placeholder="e.g. Payments & Collections"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="newCategoryDescription">Description</label>

                      <input
                        id="newCategoryDescription"
                        type="text"
                        value={newCategoryDescription}
                        onChange={(event) => setNewCategoryDescription(event.target.value)}
                        placeholder="Briefly describe this category"
                      />
                    </div>

                    {newCategoryError && (
                      <p className="form-field_hint form-field_hint--error">{newCategoryError}</p>
                    )}

                    <div className="category-add-form_actions">
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={handleCancelAddCategory}
                        disabled={createCategoryMutation.isPending}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="button button--primary"
                        onClick={handleAddCategory}
                        disabled={createCategoryMutation.isPending}
                      >
                        {createCategoryMutation.isPending ? "Adding…" : "Add category"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="dashboard-panel initiative-detail-panel">
            <div className="dashboard-panel__header">
              <div>
                <h2>Assignment</h2>
                <p>Both are notified as soon as the initiative is created.</p>
              </div>
            </div>

            <div className="proposal-section">
              <div className="form-field-row">
                <div className="form-field">
                  <label htmlFor="bdoId">Business Development Officer</label>

                  <select
                    id="bdoId"
                    value={bdoId}
                    onChange={(event) => setBdoId(event.target.value)}
                    disabled={usersQuery.isLoading}
                    required
                  >
                    <option value="" disabled>
                      {usersQuery.isLoading ? "Loading BDOs…" : "Select a Business Development Officer"}
                    </option>

                    {bdos.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {capitalize(user.userName)} ({user.email})
                      </option>
                    ))}
                  </select>

                  {usersQuery.isError && (
                    <p className="form-field_hint form-field_hint--error">
                      Couldn't load BDOs. Try refreshing the page.
                    </p>
                  )}

                  {usersQuery.isSuccess && bdos.length === 0 && (
                    <p className="form-field_hint">
                      No users with the Business Development Officer role were found yet.
                    </p>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="pmId">Product Manager</label>

                  <select
                    id="pmId"
                    value={pmId}
                    onChange={(event) => setPmId(event.target.value)}
                    disabled={usersQuery.isLoading}
                    required
                  >
                    <option value="" disabled>
                      {usersQuery.isLoading ? "Loading Product Managers…" : "Select a Product Manager"}
                    </option>

                    {pms.map((user) => (
                      <option key={user.userId} value={user.userId}>
                        {capitalize(user.userName)} ({user.email})
                      </option>
                    ))}
                  </select>

                  {usersQuery.isError && (
                    <p className="form-field_hint form-field_hint--error">
                      Couldn't load Product Managers. Try refreshing the page.
                    </p>
                  )}

                  {usersQuery.isSuccess && pms.length === 0 && (
                    <p className="form-field_hint">
                      No users with the Product Manager role were found yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="bdo-action-bar bdo-action-bar--static create-initiative-actions">
            <div>
              <p className="bdo-action-bar_hint">
                All fields are required. The BDO can start their documentation once this is created.
              </p>

              {errorMessage && (
                <p className="form-error" role="alert">
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="brd-reviews-actions">
              <button
                type="button"
                className="button button--secondary"
                onClick={handleCancel}
                disabled={mutation.isPending}
              >
                Cancel
              </button>

              <button type="submit" className="button button--primary" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating…" : "Create initiative"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default CreateInitiative;
