import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

import { clearAuthSession } from "../../apicalls/authStorage";

// Signs out in one click: ends the session, forgets everything fetched for
// this user (so the next person on this browser starts clean), and goes to
// the sign-in page.
function LogoutButton({ className }: { className: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  function logout() {
    clearAuthSession();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={logout}
      aria-label="Log out"
      data-tooltip="Log out"
    >
      <LogOut size={17} aria-hidden="true" />
    </button>
  );
}

export default LogoutButton;
