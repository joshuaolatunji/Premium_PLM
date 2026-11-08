import { useQuery } from "@tanstack/react-query";

import { getCurrentUserId } from "../apicalls/authStorage";

import { isMine, isRejectedAtSignOff, listMemos, listMyMemoApprovals, memoKeys } from "../service/MemoService";
import { listMemoReviews, listMyPendingReviews, memoReviewKeys, memoStage } from "../service/MemoReviewService";
import { MEMO_STATUS } from "../types/memoTypes";
import type {
  MemoPart,
  MemoPendingApproval,
  MemoPendingReview,
  MemoRegisterRow,
  MemoReview,
  MemoRow,
  MemoSummary,
} from "../types/memoTypes";

export interface MemoLists {
  // Waiting for the signed-in user's review (their turn only).
  toReview: MemoRow[];
  // Waiting for the signed-in user's signature (their turn only).
  toSign: MemoRow[];
  // The user's own memos waiting on them: declined in review, reviewed and
  // ready for signing, or rejected at signing.
  toAction: MemoRow[];
  // Written by the signed-in user.
  mine: MemoRow[];
  // Every memo the user is part of (written, reviewed or signing), newest
  // first, for the Memos register.
  involved: MemoRegisterRow[];
  isLoading: boolean;
  isError: boolean;
}

function fromSummary(memo: MemoSummary, review: MemoReview | undefined): MemoRow {
  return {
    id: memo.id,
    memoNumber: memo.memoNumber,
    subject: memo.subject,
    from: memo.from,
    to: memo.to,
    status: memoStage(memo.status, review ?? null),
    date: review && review.updatedAt > (memo.updatedAt ?? memo.createdAt) ? review.updatedAt : (memo.updatedAt ?? memo.createdAt),
  };
}

function fromPendingReview({ review, step }: MemoPendingReview): MemoRow {
  return {
    id: review.memoId,
    memoNumber: review.memoNumber,
    subject: review.subject,
    from: review.from,
    to: review.to,
    status: MEMO_STATUS.inReview,
    date: step.sentAt,
  };
}

function fromPendingApproval(item: MemoPendingApproval, summary: MemoSummary | undefined): MemoRow {
  return {
    id: item.memoId,
    memoNumber: item.memoNumber,
    subject: item.subject || summary?.subject || "",
    from: item.from || summary?.from || "",
    to: summary?.to ?? "",
    status: summary?.status ?? MEMO_STATUS.inApproval,
    date: item.assignedAt,
  };
}

const AUTHOR_ACTION: string[] = [MEMO_STATUS.reviewDeclined, MEMO_STATUS.reviewed, MEMO_STATUS.changesRequested];

// The memo lists on the Memos page and the dashboard cards: every memo (the
// API has no filters, so they're picked out here), the memos waiting on the
// user's signature, and the reviews (kept in the browser, gaps file M34).
export function useMemoLists(): MemoLists {
  const memosQuery = useQuery({ queryKey: memoKeys.list, queryFn: listMemos });
  const pendingQuery = useQuery({ queryKey: memoKeys.pending, queryFn: listMyMemoApprovals });
  const reviewsQuery = useQuery({ queryKey: memoReviewKeys.all, queryFn: listMemoReviews });
  const myReviewsQuery = useQuery({ queryKey: [...memoReviewKeys.all, "mine"], queryFn: listMyPendingReviews });

  const memos = memosQuery.data ?? [];
  const byId = new Map(memos.map((memo) => [memo.id, memo]));
  const reviews = new Map((reviewsQuery.data ?? []).map((review) => [review.memoId, review]));
  const mine = memos.filter(isMine).map((memo) => fromSummary(memo, reviews.get(memo.id)));

  const toReview = (myReviewsQuery.data ?? []).map(fromPendingReview);
  const toSign = (pendingQuery.data ?? []).map((item) => fromPendingApproval(item, byId.get(item.memoId)));
  const toAction = mine.filter((row) => AUTHOR_ACTION.includes(row.status) || isRejectedAtSignOff(row.status));

  // Memos the user reviewed, or is reviewing now (only once it reached them).
  const myId = getCurrentUserId();
  const reviewed = (reviewsQuery.data ?? [])
    .filter((review) => review.steps.some((step) => step.reviewerUserId === myId && step.status !== "Waiting"))
    .map((review) => {
      const summary = byId.get(review.memoId);
      return summary ? fromSummary(summary, review) : { ...fromPendingReview({ review, step: review.steps[0] }), date: review.updatedAt };
    });

  const register = new Map<string, MemoRegisterRow>();
  function add(rows: MemoRow[], part: MemoPart) {
    for (const row of rows) {
      const existing = register.get(row.id);
      if (existing) {
        if (!existing.parts.includes(part)) existing.parts.push(part);
      } else {
        register.set(row.id, { ...row, parts: [part], waiting: null });
      }
    }
  }
  add(mine, "Author");
  add(reviewed, "Reviewer");
  // Memos already signed aren't listed: the API has no memo signing history
  // (gaps file M36).
  add(toSign, "Signer");

  const waitingOn = (ids: MemoRow[], kind: MemoRegisterRow["waiting"]) =>
    ids.forEach((row) => {
      const entry = register.get(row.id);
      if (entry && !entry.waiting) entry.waiting = kind;
    });
  waitingOn(toSign, "sign");
  waitingOn(toReview, "review");
  waitingOn(toAction, "action");

  return {
    toReview,
    toSign,
    toAction,
    mine,
    involved: [...register.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    isLoading: memosQuery.isLoading || pendingQuery.isLoading || reviewsQuery.isLoading || myReviewsQuery.isLoading,
    isError: memosQuery.isError || pendingQuery.isError,
  };
}
