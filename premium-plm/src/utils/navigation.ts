// Router state a page can pass when linking forward, so the next page's
// BackLink (components/common/BackLink.tsx) can name where it leads — e.g.
// navigate(to, { state: backState("Back to Discount Hub") }).
export interface BackState {
  backLabel?: string;
}

export function backState(backLabel: string): BackState {
  return { backLabel };
}
