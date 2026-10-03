// Matches the API's InitiativePriority enum (1 = Critical … 5 = Low).
export const INITIATIVE_PRIORITIES = [
  { value: 1, label: "Critical" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Normal" },
  { value: 5, label: "Low" },
] as const;

export interface ProductInitiative {
  id: string;
  projectName: string;
  description: string;
  priority: number;
  status: number;

  createdByUserId: string;
  // Real and populated at creation now — the Group Head picks both a BDO
  // and a PM in the same form (see CreateInitiativeModal.tsx).
  projectManagerId: string | null;
  // Confirmed on both the write side (CreateProductInitiativeDto.bdoId)
  // and the read side (seen directly in a live GET response).
  bdoId: string | null;

  createdAt: string;

  timelineDays: number;
  timelineStartedAt: string | null;
  originalDeadline: string | null;
  currentDeadline: string | null;

  timelineExtensionCount: number;
  extensionsRemaining: number;

  productId: string | null;
}

// export interface ProductInitiativesResponse {
//   statusCode: number;
//   isSuccessful: boolean;
//   message: string;
//   data: ProductInitiative[];
// }


export interface CreateInitiativeRequest {
  projectName: string,
  description: string,
  priority: number,
  timelineDays: number,
  categoryId: string,
  // Real — the Group Head selects both the Project Manager and the BDO in
  // the same form, sent directly to the API now (see
  // CreateInitiativeModal.tsx).
  projectManagerId: string | null,
  bdoId: string | null,
}

