// Mock: there is no real "delete user" endpoint on the live API — PLMAdmin
// only exposes remove_user_role (removes one role assignment, not the
// account itself). "Remove user" in the Super Admin's Users screen hides
// the user from that list for the session only, so the action has real
// feedback without pretending to call a delete endpoint that doesn't
// exist. State lives in memory for the session only and resets on page
// reload — same convention as the other mock modules.

const hiddenUserIds = new Set<string>();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}

export async function hideUser(userId: string): Promise<void> {
  hiddenUserIds.add(userId);
  await delay(undefined);
}

export async function getHiddenUserIds(): Promise<string[]> {
  return delay(Array.from(hiddenUserIds));
}
