import { useQueries, useQuery } from "@tanstack/react-query";

import { getInitiativeDocuments } from "../service/DocumentService";
import { canListWorkflows, getSignOffs } from "../service/ApprovalWorkflowService";
import { getDiscoveryByInitiativeId } from "../service/ProductDiscoveryService";
import { DOCUMENT_TYPES } from "../types/documentTypes";
import type {
  DocumentStatus,
  DocumentType,
  InitiativeDocuments,
  ProductDocument,
} from "../types/documentTypes";

export const EMPTY_DOCUMENTS: InitiativeDocuments = { PID: null, FRD: null, BRD: null, SWR: null };

// Query key for one initiative's four documents — shared by every page so
// they all read (and invalidate) the same cache entry.
export function documentsQueryKey(initiativeId: string | null | undefined) {
  return ["product-documents", initiativeId];
}

// What the tabs know about each document; one left out shows no status.
export type KnownDocuments = Partial<Record<DocumentType, ProductDocument | null>>;

export function documentStatusLabel(status: DocumentStatus | null | undefined): string {
  switch (status) {
    case "Draft":
      return "Draft";
    case "PendingBDOReview":
      return "With BDO";
    case "PendingGroupHeadReview":
      return "With Group Head";
    case "Approved":
      return "Approved";
    case "Rejected":
      return "Returned";
    case "Cancelled":
      return "Cancelled";
    default:
      return "Not started";
  }
}

export function documentStatusBadgeClass(status: DocumentStatus | null | undefined): string {
  switch (status) {
    case "Approved":
      return "status-badge status-badge--approved";
    case "PendingBDOReview":
      return "status-badge status-badge--brd-awaiting-bdo-review";
    case "PendingGroupHeadReview":
      return "status-badge status-badge--brd-under-review";
    case "Rejected":
      return "status-badge status-badge--bdo-documentation-rejected";
    case "Draft":
      return "status-badge status-badge--brd-drafting";
    default:
      return "status-badge status-badge--not-started";
  }
}

// The status as shown, naming who has the document while it's out for
// sign-off ("With Naomi Okafor (Chief Risk Officer)").
export function documentStatusText(document: ProductDocument | null | undefined): string {
  const signOff = document?.signOff;

  if (signOff && !signOff.complete) {
    if (!signOff.approverName) {
      return signOff.approverRole ? `With ${signOff.approverRole}` : "Out for sign-off";
    }

    return signOff.approverRole ? `With ${signOff.approverName} (${signOff.approverRole})` : `With ${signOff.approverName}`;
  }

  return documentStatusLabel(document?.status);
}

export function documentStatusClass(document: ProductDocument | null | undefined): string {
  return document?.signOff && !document.signOff.complete
    ? "status-badge status-badge--brd-under-review"
    : documentStatusBadgeClass(document?.status);
}

export function isInReview(status: DocumentStatus | null | undefined): boolean {
  return status === "PendingBDOReview" || status === "PendingGroupHeadReview";
}

// Only a missing, draft or returned document can be edited by the PM.
export function isEditable(document: ProductDocument | null): boolean {
  return !document || document.status === "Draft" || document.status === "Rejected";
}

// Where "Start / Continue documentation" takes the PM: the first document,
// in PID → FRD → BRD → SWR order, that still needs their work. Falls back to
// the PID (which is where the PM usually starts).
export function nextDocumentToWorkOn(documents: InitiativeDocuments): DocumentType {
  return DOCUMENT_TYPES.find((type) => isEditable(documents[type])) ?? "PID";
}

export function documentationProgress(documents: InitiativeDocuments) {
  const list = DOCUMENT_TYPES.map((type) => documents[type]);

  return {
    started: list.filter(Boolean).length,
    approved: list.filter((doc) => doc?.status === "Approved").length,
    allApproved: list.every((doc) => doc?.status === "Approved"),
  };
}

// Loads the four documents for each initiative in the list, in parallel —
// but only once that initiative's BDO documentation is approved. Before
// then no document can exist, so asking would only return four 404s per
// initiative. The discovery lookup shares its cache key with the pages' own
// discovery queries, so it doesn't add requests.
export function useInitiativeDocuments(initiativeIds: string[]) {
  const discoveryQueries = useQueries({
    queries: initiativeIds.map((initiativeId) => ({
      queryKey: ["product-discovery", initiativeId],
      queryFn: () => getDiscoveryByInitiativeId(initiativeId),
      enabled: Boolean(initiativeId),
    })),
  });

  // The documents without the approvers' names, so the list shows as soon as
  // the documents arrive. Its own key (under documentsQueryKey, so the same
  // invalidations refresh it) keeps it apart from the document pages' copy.
  const queries = useQueries({
    queries: initiativeIds.map((initiativeId, index) => ({
      queryKey: [...documentsQueryKey(initiativeId), "list"],
      queryFn: () => getInitiativeDocuments(initiativeId, { withApprover: false }),
      enabled: Boolean(initiativeId) && discoveryQueries[index]?.data?.status === "Approved",
    })),
  });

  // Then, only if a document is out for sign-off, one request for who has
  // each one, across every initiative.
  const anyInSignOff = queries.some((query) =>
    DOCUMENT_TYPES.some((type) => query.data?.[type]?.signOff && !query.data[type]?.signOff?.complete),
  );
  const signOffsQuery = useQuery({
    queryKey: ["approval-workflows", "sign-offs"],
    queryFn: () => getSignOffs(),
    // Only the PM and Group Head may read the workflow list.
    enabled: anyInSignOff && canListWorkflows(),
    retry: false,
  });

  function documentsFor(index: number): InitiativeDocuments {
    const documents = queries[index]?.data ?? EMPTY_DOCUMENTS;
    const signOffs = signOffsQuery.data;

    if (!signOffs) {
      return documents;
    }

    return Object.fromEntries(
      DOCUMENT_TYPES.map((type) => {
        const document = documents[type];
        const signOff = document?.signOff ? signOffs.get(document.id) : undefined;
        return [type, document && signOff ? { ...document, signOff } : document];
      }),
    ) as InitiativeDocuments;
  }

  return {
    documentsFor,
    // The BDO documentation's status ("Approved", "Rejected"…), or "" before it exists.
    discoveryStatusFor: (index: number): string => discoveryQueries[index]?.data?.status ?? "",
    isLoading:
      discoveryQueries.some((query) => query.isLoading) || queries.some((query) => query.isLoading),
    isError: discoveryQueries.some((query) => query.isError) || queries.some((query) => query.isError),
  };
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Wrapped in a plain function so components can read the time without
// tripping the react-hooks/purity lint rule (same as Dashboard.tsx).
export function currentTimestamp(): number {
  return Date.now();
}

export function daysSince(iso: string | null | undefined, now: number): number {
  if (!iso) {
    return 0;
  }

  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / MS_PER_DAY));
}
