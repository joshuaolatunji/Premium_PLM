// Mocked domain — the real proposal-reviewal endpoint has no concept of
// approval "legs"; it's a single Group Head decision. This tracks the BDO
// leg that now sits in front of it. See mocks/brdBdoReviewMock.ts.
export type BrdBdoLegStatus =
  | "PendingBdoReview"
  | "ForwardedToGroupHead"
  | "RejectedByBdo";

export interface BrdBdoDecisionRecord {
  comment: string;
  decidedAt: string;
}
