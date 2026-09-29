import { apiClient, ApiError } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import type {
  CreateProposalRequest,
  ProductProposal,
  UpdateProposalRequest,
} from "../types/proposalTypes";

// Returns null when the initiative has no BRD yet, rather than throwing —
// a 404 here is an expected, normal state (not started), not an error.
export async function getProposalByInitiativeId(
  initiativeId: string,
): Promise<ProductProposal | null> {
  const token = getToken();

  try {
    const response = await apiClient<ApiResponse<ProductProposal> | null>(
      `api/ProductProposal/proposal/${initiativeId}`,
      {
        method: "GET",
        token: token ?? undefined,
      },
    );

    return response?.data ?? null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createProposal(
  payload: CreateProposalRequest,
): Promise<ProductProposal | null> {
  const token = getToken();

  const response = await apiClient<ApiResponse<ProductProposal> | null>(
    "api/ProductProposal/create-proposal",
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );

  return response?.data ?? null;
}

export async function updateProposal(
  proposalId: string,
  payload: UpdateProposalRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductProposal> | null>(
    `api/ProductProposal/${proposalId}/update`,
    {
      method: "PUT",
      token: token ?? undefined,
      body: JSON.stringify(payload),
    },
  );
}

export async function submitProposalForReview(proposalId: string): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductProposal> | null>(
    `api/ProductProposal/${proposalId}/submit-for-review`,
    {
      method: "POST",
      token: token ?? undefined,
    },
  );
}

export async function resubmitProposal(proposalId: string): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductProposal> | null>(
    `api/ProductProposal/${proposalId}/resubmit`,
    {
      method: "POST",
      token: token ?? undefined,
    },
  );
}

// Group Head's approve/reject action. Not wired into any UI yet — that
// belongs to the "BRD Reviews" screen, which is still a placeholder in the
// sidebar. Included here so the service layer is complete for that
// follow-up.
export async function reviewProposal(
  proposalId: string,
  decision: { isApproved: boolean; comment: string },
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<ProductProposal> | null>(
    `api/ProductProposal/${proposalId}/proposal-reviewal`,
    {
      method: "POST",
      token: token ?? undefined,
      body: JSON.stringify(decision),
    },
  );
}
