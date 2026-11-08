import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { canCreateInitiativeMemo } from "../../service/MemoService";
import { backState } from "../../utils/navigation";

interface CreateMemoButtonProps {
  initiativeId: string;
  // For the memo page's "Back to …" link.
  backLabel: string;
  // Red where writing a memo is the page's main action; black beside a
  // document's own actions.
  variant?: "primary";
}

// "+ Create memo" for an initiative, shown to the Product Manager and the
// Group Head only.
function CreateMemoButton({ initiativeId, backLabel, variant = "primary" }: CreateMemoButtonProps) {
  const navigate = useNavigate();

  if (!canCreateInitiativeMemo()) {
    return null;
  }

  return (
    <button
      type="button"
      className={`button button--${variant}`}
      onClick={() => navigate(`/dashboard/memos/new?initiative=${initiativeId}`, { state: backState(backLabel) })}
    >
      <Plus size={17} strokeWidth={2} aria-hidden="true" />
      Create memo
    </button>
  );
}

export default CreateMemoButton;
