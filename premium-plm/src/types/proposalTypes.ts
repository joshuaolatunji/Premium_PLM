// Matches the live API's ProductProposal schemas exactly (verified against
// the current Swagger spec). This is the "BRD" (Business Requirements
// Document) domain referenced in the design catalog.

export interface ProductProposalFunctionality {
  sequence: number;
  functionality: string;
  description: string;
}

export interface ProductProposalUserGroup {
  sequence: number;
  userClass: string;
  description: string;
  roleFunction: string;
}

// RequirementCategory (1-6) and RequirementPriority (1-3) are undocumented
// integer enums in the live Swagger spec — no labels exist anywhere in the
// API docs or the design catalog, so we present them as plain numbered
// options rather than guess at semantic names.
export interface ProductRequirement {
  sequence: number;
  category: number;
  requirement: string;
  priority: number;
  comments: string;
}

export const REQUIREMENT_CATEGORY_VALUES = [1, 2, 3, 4, 5, 6];
export const REQUIREMENT_PRIORITY_VALUES = [1, 2, 3];

// Fields common to both creating and updating a proposal.
export interface ProposalFormFields {
  author: string;
  userGroup: string;
  sponsor: string;
  projectManager: string;
  introduction: string;
  businessObjective: string;
  businessPurpose: string;
  objectivesAndGoals: string;
  targetCustomers: string;
  productPurpose: string;
  newApplicationDevelopment: boolean;
  replacementOfExistingApplication: boolean;
  rfpOrRfq: boolean;
  needStatement: string;
  affects: string;
  impact: string;
  successfulSolution: string;
  projectScope: string;
  processFlowAsIs: string;
  processFlowToBe: string;
  minimumAmount: number;
  maximumAmount: number;
  tenureInMonths: number;
  repaymentFrequency: string;
  proposedInterestRate: number;
  expectedBenefits: string;
  functionalities: ProductProposalFunctionality[];
  userGroups: ProductProposalUserGroup[];
  requirements: ProductRequirement[];
}

export interface CreateProposalRequest extends ProposalFormFields {
  productInitiativeId: string;
}

// UpdateProductProposalDto additionally carries `projectName`, which
// CreateProductProposalDto does not.
export interface UpdateProposalRequest extends ProposalFormFields {
  projectName: string;
}

// Swagger doesn't document this shape (the GET/create responses just say
// "OK"), but a real create-proposal response body confirmed these
// read-only fields exist alongside the editable ones above. `status` is a
// plain string ("Draft" confirmed live; other values are real but
// unobserved, so we display it verbatim rather than mapping it to our own
// labels) and `version` is a real string ("1.0" confirmed) — genuinely
// useful, unlike the numeric enums elsewhere in this API.
export interface ProductProposal extends ProposalFormFields {
  id: string;
  productInitiativeId: string;
  productId: string | null;
  projectName: string;
  status: string;
  version: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  creationDate: string;
  lastUpdated: string;
}

export const EMPTY_PROPOSAL_FORM: ProposalFormFields = {
  author: "",
  userGroup: "",
  sponsor: "",
  projectManager: "",
  introduction: "",
  businessObjective: "",
  businessPurpose: "",
  objectivesAndGoals: "",
  targetCustomers: "",
  productPurpose: "",
  newApplicationDevelopment: false,
  replacementOfExistingApplication: false,
  rfpOrRfq: false,
  needStatement: "",
  affects: "",
  impact: "",
  successfulSolution: "",
  projectScope: "",
  processFlowAsIs: "",
  processFlowToBe: "",
  minimumAmount: 0,
  maximumAmount: 0,
  tenureInMonths: 0,
  repaymentFrequency: "",
  proposedInterestRate: 0,
  expectedBenefits: "",
  functionalities: [],
  userGroups: [],
  requirements: [],
};
