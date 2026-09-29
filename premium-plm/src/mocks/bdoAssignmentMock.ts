// Mock service: there is no real endpoint yet for assigning an initiative
// to a Business Development Officer (the real create-initiative DTO only
// has projectManagerId, which we now send as null — see
// dashboardcomponents/CreateInitiativeModal.tsx). State lives in memory for
// the session only and resets on page reload; every function is `async`
// and shaped like a real service call so swapping this module's body for
// real `apiClient` calls later is a localized change, not a rewrite of any
// caller.

interface BdoAssignment {
  bdoId: string;
  assignedAt: string;
}

const assignmentsByInitiativeId = new Map<string, BdoAssignment>();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

export async function assignInitiativeToBdo(
  initiativeId: string,
  bdoId: string,
): Promise<void> {
  assignmentsByInitiativeId.set(initiativeId, {
    bdoId,
    assignedAt: new Date().toISOString(),
  });

  await delay(undefined);
}

export async function getBdoAssignment(
  initiativeId: string,
): Promise<BdoAssignment | null> {
  return delay(assignmentsByInitiativeId.get(initiativeId) ?? null);
}

// Every initiative id currently assigned to this BDO — backs the BDO's own
// "my initiatives" dashboard list.
export async function getInitiativeIdsAssignedToBdo(
  bdoId: string,
): Promise<string[]> {
  const ids = Array.from(assignmentsByInitiativeId.entries())
    .filter(([, assignment]) => assignment.bdoId === bdoId)
    .map(([initiativeId]) => initiativeId);

  return delay(ids);
}
