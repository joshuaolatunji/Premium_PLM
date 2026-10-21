import { apiClient, ApiError } from "../apicalls/apiClient";
import { getToken } from "../apicalls/authStorage";

import type { ApiResponse } from "../types/apiTypes";
import {
  REQUIREMENT_CATEGORY_VALUES,
  REQUIREMENT_PRIORITY_VALUES,
  type CreateProposalRequest,
  type ProductProposal,
  type ProductRequirement,
  type UpdateProposalRequest,
} from "../types/proposalTypes";

// Requirement category/priority are string enums now, but BRDs saved while
// they were integers may still come back as 1-based numbers (or in a
// different letter case). Both are mapped onto the enum name here, at the
// service boundary, so the rest of the app only ever sees valid names.
function toEnumName<T extends string>(values: readonly T[], raw: unknown): T {
  if (typeof raw === "number") {
    return values[raw - 1] ?? values[0];
  }

  return values.find((value) => value.toLowerCase() === String(raw).toLowerCase()) ?? values[0];
}

function normalizeProposal(proposal: ProductProposal): ProductProposal {
  return {
    ...proposal,
    requirements: (proposal.requirements ?? []).map(
      (row): ProductRequirement => ({
        ...row,
        category: toEnumName(REQUIREMENT_CATEGORY_VALUES, row.category),
        priority: toEnumName(REQUIREMENT_PRIORITY_VALUES, row.priority),
      }),
    ),
  };
}

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

    return response?.data ? normalizeProposal(response.data) : null;
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

  return response?.data ? normalizeProposal(response.data) : null;
}

// After create-proposal, a BRD is updated section by section — one PATCH
// per section (PATCH .../{proposalId}/sections/{section}), each taking only
// that section's fields. The field lists match the Swagger DTOs exactly
// (PatchBusinessOverviewDto, PatchProblemScopeProcessDto,
// PatchProductFinancialsDto, PatchRequirementsStakeholdersDto) and together
// cover every editable BRD field.
export const PROPOSAL_SECTIONS = {
  "business-overview": [
    "projectName",
    "author",
    "userGroup",
    "sponsor",
    "projectManager",
    "introduction",
    "businessObjective",
    "businessPurpose",
    "objectivesAndGoals",
    "targetCustomers",
    "productPurpose",
  ],
  "problem-scope-process": [
    "newApplicationDevelopment",
    "replacementOfExistingApplication",
    "rfpOrRfq",
    "needStatement",
    "affects",
    "impact",
    "successfulSolution",
    "projectScope",
    "processFlowAsIs",
    "processFlowToBe",
  ],
  "product-financials": [
    "minimumAmount",
    "maximumAmount",
    "tenureInMonths",
    "repaymentFrequency",
    "proposedInterestRate",
    "expectedBenefits",
  ],
  "requirements-stakeholders": ["functionalities", "userGroups", "requirements"],
} as const satisfies Record<string, readonly (keyof UpdateProposalRequest)[]>;

export type ProposalSection = keyof typeof PROPOSAL_SECTIONS;

const ALL_PROPOSAL_SECTIONS = Object.keys(PROPOSAL_SECTIONS) as ProposalSection[];

function sectionFields(section: ProposalSection, payload: UpdateProposalRequest) {
  return Object.fromEntries(PROPOSAL_SECTIONS[section].map((field) => [field, payload[field]]));
}

export async function patchProposalSection(
  proposalId: string,
  section: ProposalSection,
  payload: UpdateProposalRequest,
): Promise<void> {
  const token = getToken();

  await apiClient<ApiResponse<unknown> | null>(
    `api/ProductProposal/${proposalId}/sections/${section}`,
    {
      method: "PATCH",
      token: token ?? undefined,
      body: JSON.stringify(sectionFields(section, payload)),
    },
  );
}

// Saves an existing BRD by patching only the sections that differ from
// `previous` (the last saved copy); with no `previous`, every section is
// sent. Sections are sent one after another so a failure points at a
// specific section. Returns the sections that were patched — empty means
// nothing had changed.
export async function updateProposal(
  proposalId: string,
  payload: UpdateProposalRequest,
  previous?: UpdateProposalRequest,
): Promise<ProposalSection[]> {
  const changed = previous
    ? ALL_PROPOSAL_SECTIONS.filter(
        (section) =>
          JSON.stringify(sectionFields(section, payload)) !==
          JSON.stringify(sectionFields(section, previous)),
      )
    : ALL_PROPOSAL_SECTIONS;

  for (const section of changed) {
    await patchProposalSection(proposalId, section, payload);
  }

  return changed;
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
