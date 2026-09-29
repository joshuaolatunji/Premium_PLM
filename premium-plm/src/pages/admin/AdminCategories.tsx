import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCategory,
  deactivateCategory,
  getCategories,
  updateCategory,
} from "../../service/CategoryService";
import { ApiError } from "../../apicalls/apiClient";
import type { PLMCategory } from "../../types/categoryTypes";

const CATEGORIES_QUERY_KEY = ["plm-categories"];

function errorMessageFrom(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function AdminCategories() {
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const categoriesQuery = useQuery({
    queryKey: CATEGORIES_QUERY_KEY,
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createCategory({ name: createName.trim(), description: createDescription.trim() }),
    onSuccess: () => {
      setErrorMessage("");
      setIsCreating(false);
      setCreateName("");
      setCreateDescription("");
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error) => {
      setErrorMessage(errorMessageFrom(error, "Unable to create this category."));
    },
  });

  function handleCreate() {
    if (!createName.trim() || !createDescription.trim()) {
      setErrorMessage("Fill in both fields.");
      return;
    }

    setErrorMessage("");
    createMutation.mutate();
  }

  function startEditing(category: PLMCategory) {
    setErrorMessage("");
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description);
  }

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      updateCategory(id, { name: editName.trim(), description: editDescription.trim() }),
    onSuccess: () => {
      setErrorMessage("");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error) => {
      setErrorMessage(errorMessageFrom(error, "Unable to update this category."));
    },
  });

  function handleSaveEdit() {
    if (!editingId) {
      return;
    }

    if (!editName.trim() || !editDescription.trim()) {
      setErrorMessage("Fill in both fields.");
      return;
    }

    setErrorMessage("");
    updateMutation.mutate(editingId);
  }

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateCategory(id),
    onSuccess: () => {
      setErrorMessage("");
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error) => {
      setErrorMessage(errorMessageFrom(error, "Unable to deactivate this category."));
    },
  });

  const categories = categoriesQuery.data ?? [];

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Categories</p>

          <h1 className="dashboard-title">Categories</h1>

          <p className="dashboard-subtitle">
            Create, edit, and deactivate initiative categories.
          </p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setIsCreating(true);
              setErrorMessage("");
            }}
            disabled={isCreating}
          >
            + New category
          </button>
        </div>
      </header>

      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {isCreating && (
        <section className="dashboard-panel initiative-detail-panel">
          <div className="dashboard-panel__header">
            <div>
              <h2>New category</h2>
            </div>
          </div>

          <div className="proposal-section">
            <div className="form-field">
              <label htmlFor="categoryName">Name</label>
              <input
                id="categoryName"
                type="text"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="categoryDescription">Description</label>
              <textarea
                id="categoryDescription"
                rows={2}
                value={createDescription}
                onChange={(event) => setCreateDescription(event.target.value)}
              />
            </div>
          </div>

          <div className="modal-panel_footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setIsCreating(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </button>

            <button
              type="button"
              className="button button--primary"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create category"}
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
                <th>Description</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {categoriesQuery.isLoading && (
                <tr>
                  <td colSpan={3} className="initiatives-empty">
                    Loading categories…
                  </td>
                </tr>
              )}

              {categoriesQuery.isError && (
                <tr>
                  <td colSpan={3} className="initiatives-empty initiatives-empty--error">
                    Couldn't load categories. Try refreshing the page.
                  </td>
                </tr>
              )}

              {!categoriesQuery.isLoading &&
                !categoriesQuery.isError &&
                categories.map((category) =>
                  editingId === category.id ? (
                    <tr key={category.id}>
                      <td>
                        <input
                          type="text"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                        />
                      </td>

                      <td className="brd-reviews-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => setEditingId(null)}
                          disabled={updateMutation.isPending}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="table-action"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? "Saving…" : "Save"}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={category.id}>
                      <td>
                        <strong>{category.name}</strong>
                      </td>

                      <td>{category.description}</td>

                      <td className="brd-reviews-actions">
                        <button
                          type="button"
                          className="table-action"
                          onClick={() => startEditing(category)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="table-action"
                          onClick={() => deactivateMutation.mutate(category.id)}
                          disabled={
                            deactivateMutation.isPending &&
                            deactivateMutation.variables === category.id
                          }
                        >
                          {deactivateMutation.isPending &&
                          deactivateMutation.variables === category.id
                            ? "Deactivating…"
                            : "Deactivate"}
                        </button>
                      </td>
                    </tr>
                  ),
                )}

              {!categoriesQuery.isLoading && !categoriesQuery.isError && categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="initiatives-empty">
                    No categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AdminCategories;
