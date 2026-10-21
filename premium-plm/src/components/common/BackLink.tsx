import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import type { BackState } from "../../utils/navigation";

interface BackLinkProps {
  // Where to go — and what to call it — when there's no previous page in
  // the app to return to (opened in a new tab, from a bookmark, etc.).
  fallbackTo: string;
  fallbackLabel: string;
}

// "Back" that returns to the page the user actually came from (the same
// as the browser's back button), instead of a fixed parent page — so
// e.g. Initiative → View BDO Docs → Back lands on that initiative again.
// The label comes from the previous page when it supplied one (see
// backState); otherwise it's a plain "Back" so it never names the wrong
// page. Only when there's no in-app history does it use the fallback.
function BackLink({ fallbackTo, fallbackLabel }: BackLinkProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // React Router gives the very first entry of a session the key "default";
  // anything reached by navigating within the app has its own key.
  const hasInAppHistory = location.key !== "default";
  const passedLabel = (location.state as BackState | null)?.backLabel;

  const label = hasInAppHistory ? (passedLabel ?? "Back") : fallbackLabel;

  return (
    <button
      type="button"
      className="text-button"
      onClick={() => (hasInAppHistory ? navigate(-1) : navigate(fallbackTo))}
    >
      <ArrowLeft size={15} />
      {label}
    </button>
  );
}

export default BackLink;
