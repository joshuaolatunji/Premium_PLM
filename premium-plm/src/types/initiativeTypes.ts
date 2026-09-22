export interface ProductInitiative {
  id: string;
  projectName: string;
  description: string;
  priority: number;
  status: number;

  createdByUserId: string;
  projectManagerId: string;

  createdAt: string;

  timelineDays: number;
  timelineStartedAt: string | null;
  originalDeadline: string | null;
  currentDeadline: string | null;

  timelineExtensionCount: number;
  extensionsRemaining: number;

  productId: string | null;
}

export interface ProductInitiativesResponse {
  statusCode: number;
  isSuccessful: boolean;
  message: string;
  data: ProductInitiative[];
}

