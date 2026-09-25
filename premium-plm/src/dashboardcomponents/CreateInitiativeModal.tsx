import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getCategories } from "../service/CategoryService";
import { getAllUsers } from "../service/UserService";
import { createInitiative } from "../service/InitiativeService";
import { ApiError } from "../apicalls/apiClient";
import { INITIATIVE_PRIORITIES } from "../types/initiativeTypes";
import type { CreateInitiativeRequest } from "../types/initiativeTypes";

interface CreateInitiativeModalProps {
  onClose: () => void;
}

const EMPTY_FORM: CreateInitiativeRequest = {
  projectName: "",
  description: "",
  priority: 3,
  timelineDays: 30,
  categoryId: "",
  projectManagerId: "",
};

// Rendered by the parent only while the modal should be open (see
// Dashboard.tsx), so mounting/unmounting this component is what resets its
// form state — no effect-based reset needed.
function CreateInitiativeModal({ onClose }: CreateInitiativeModalProps) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState<CreateInitiativeRequest>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["plm-categories"],
    queryFn: getCategories,
  });

  const usersQuery = useQuery({
    queryKey: ["plm-users"],
    queryFn: getAllUsers,
  });

  const projectManagers = (usersQuery.data ?? []).filter((user) =>
    user.role.includes("ProjectManager"),
  );

  const mutation = useMutation({
    mutationFn: createInitiative,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-initiatives"] });
      onClose();
    },
    onError: (error) => {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : "Unable to create initiative. Please try again.",
      );
    },
  });

  function handleClose() {
    if (mutation.isPending) {
      return;
    }

    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (
      !form.projectName.trim() ||
      !form.description.trim() ||
      !form.categoryId ||
      !form.projectManagerId
    ) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (form.timelineDays <= 0) {
      setErrorMessage("Timeline must be at least 1 day.");
      return;
    }

    mutation.mutate(form);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-initiative-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-panel_header">
          <h2 id="create-initiative-title">New initiative</h2>

          <button
            type="button"
            className="modal-panel_close"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-panel_body">
            <div className="form-field">
              <label htmlFor="projectName">Project name</label>

              <input
                id="projectName"
                type="text"
                value={form.projectName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    projectName: event.target.value,
                  }))
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
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Briefly describe the initiative"
                rows={3}
                required
              />
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="priority">Priority</label>

                <select
                  id="priority"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: Number(event.target.value),
                    }))
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

                <input
                  id="timelineDays"
                  type="number"
                  min={1}
                  value={form.timelineDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      timelineDays: Number(event.target.value),
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="categoryId">Category</label>

              <select
                id="categoryId"
                value={form.categoryId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
                disabled={categoriesQuery.isLoading}
                required
              >
                <option value="" disabled>
                  {categoriesQuery.isLoading
                    ? "Loading categories…"
                    : "Select a category"}
                </option>

                {categoriesQuery.data?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              {categoriesQuery.isError && (
                <p className="form-field_hint form-field_hint--error">
                  Couldn't load categories. Try closing and reopening this
                  dialog.
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="projectManagerId">Project manager</label>

              <select
                id="projectManagerId"
                value={form.projectManagerId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    projectManagerId: event.target.value,
                  }))
                }
                disabled={usersQuery.isLoading}
                required
              >
                <option value="" disabled>
                  {usersQuery.isLoading
                    ? "Loading project managers…"
                    : "Select a project manager"}
                </option>

                {projectManagers.map((user) => (
                  <option key={user.userId} value={user.userId}>
                    {user.userName} ({user.email})
                  </option>
                ))}
              </select>

              {usersQuery.isError && (
                <p className="form-field_hint form-field_hint--error">
                  Couldn't load project managers. Try closing and reopening
                  this dialog.
                </p>
              )}

              {usersQuery.isSuccess && projectManagers.length === 0 && (
                <p className="form-field_hint">
                  No users with the Project Manager role were found.
                </p>
              )}
            </div>

            {errorMessage && (
              <p className="form-error" role="alert">
                {errorMessage}
              </p>
            )}
          </div>

          <div className="modal-panel_footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button button--primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating…" : "Create initiative"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateInitiativeModal;
