// Mock service: the real proposal-reviewal endpoint has no concept of
// approval "legs" — it's a single Group Head decision. This module adds a
// BDO leg in front of it: the PM's "Submit for review" lands here first,
// not on the real submit-for-review endpoint. Only once the BDO approves
// does this call the real endpoint, so the BRD then shows up in the
// already-real BRD Reviews screen for the Group Head. State lives in
// memory for the session only and resets on page reload — same convention
// as the other mock modules (mocks/bdoDocumentsMock.ts etc).

import { submitProposalForReview } from "../service/ProposalService";
import type { BrdBdoDecisionRecord, BrdBdoLegStatus } from "../types/brdApprovalTypes";

const legStatusByInitiativeId = new Map<string, BrdBdoLegStatus>();
const rejectionByInitiativeId = new Map<string, BrdBdoDecisionRecord>();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 200));
}

export async function submitBrdToBdo(initiativeId: string): Promise<void> {
  legStatusByInitiativeId.set(initiativeId, "PendingBdoReview");
  rejectionByInitiativeId.delete(initiativeId);
  await delay(undefined);
}

export async function getBrdBdoLegStatus(
  initiativeId: string,
): Promise<BrdBdoLegStatus | null> {
  return delay(legStatusByInitiativeId.get(initiativeId) ?? null);
}

// BDO's approve/reject on a PM's submitted BRD. Approval calls the REAL
// submit-for-review endpoint so the Group Head then sees it through the
// already-real BRD Reviews screen; rejection stays mock-only so the PM can
// revise and resend without the Group Head ever seeing this round.
export async function reviewBrdAsBdo(
  initiativeId: string,
  proposalId: string,
  decision: { isApproved: boolean; comment: string },
): Promise<void> {
  if (decision.isApproved) {
    await submitProposalForReview(proposalId);
    legStatusByInitiativeId.set(initiativeId, "ForwardedToGroupHead");
    rejectionByInitiativeId.delete(initiativeId);
  } else {
    legStatusByInitiativeId.set(initiativeId, "RejectedByBdo");
    rejectionByInitiativeId.set(initiativeId, {
      comment: decision.comment,
      decidedAt: new Date().toISOString(),
    });
  }

  await delay(undefined);
}

export async function getBrdBdoRejection(
  initiativeId: string,
): Promise<BrdBdoDecisionRecord | null> {
  return delay(rejectionByInitiativeId.get(initiativeId) ?? null);
}
