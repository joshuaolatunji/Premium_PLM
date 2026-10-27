import type { DocumentType } from "./documentTypes";

// Sign-off on a document after the Group Head has approved it. The Product
// Manager picks the approvers for that project, in order; the document goes
// to each one in turn, and each signs it (or rejects it, which stops the
// chain and sends it back to the PM). The backend adds the approvers' names
// and signatures to the document's PDF.

export type ApprovalWorkflowStatus = "Draft" | "InProgress" | "Approved" | "Rejected";

// Waiting: not their turn yet. Pending: their turn now.
export type ApprovalStepStatus = "Waiting" | "Pending" | "Signed" | "Rejected";

export interface ApprovalStep {
  id: string;
  sequence: number;
  approverUserId: string;
  approverName: string;
  // Their title on the sign-off, e.g. "Chief Risk Officer".
  approverRole: string;
  status: ApprovalStepStatus;
  decidedAt: string | null;
  comment: string | null;
  // PNG data URL of the signature, once signed.
  signatureImage: string | null;
}

export interface ApprovalWorkflow {
  id: string;
  documentId: string;
  documentType: DocumentType;
  initiativeId: string;
  initiativeName: string;
  status: ApprovalWorkflowStatus;
  steps: ApprovalStep[];
  createdByUserId: string;
  createdAt: string;
  submittedAt: string | null;
}

// One document waiting for the signed-in approver.
export interface PendingApproval {
  workflowId: string;
  stepId: string;
  documentId: string | null;
  documentType: DocumentType | null;
  initiativeId: string | null;
  initiativeName: string | null;
  approverRole: string | null;
  sequence: number | null;
  totalSteps: number | null;
  sentAt: string | null;
}

// One row of the PM's approver list, before it's sent.
export interface ApproverInput {
  userId: string;
  name: string;
  role: string;
}
