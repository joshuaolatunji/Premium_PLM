import { useEffect } from "react";
import { sileo } from "sileo";
import { notifyWarning } from "../../utils/notify";

// How long before the session ends the warning appears.
const WARNING_MS = 1 * 60 * 1000;

interface SessionExpiryWarningProps {
  // When the session ends (ms since epoch).
  expiry: number;
}

// A Sileo warning for the last minute of a session. The backend has no way to
// extend a session yet, so this is the user's cue to save their work. After
// signing in again they're brought back to the same page. It stays up until
// the session ends (or is dismissed), and shows once per session.
function SessionExpiryWarning({ expiry }: SessionExpiryWarningProps) {
  useEffect(() => {
    let toastId: string | null = null;

    function warn() {
      const left = expiry - Date.now();
      if (left <= 0) return;

      toastId = notifyWarning({
        title: "Your session is ending",
        description: "It ends in under a minute. Save your work; you'll come back to this page after signing in.",
        duration: left,
      });
    }

    const timeoutId = window.setTimeout(warn, Math.max(0, expiry - WARNING_MS - Date.now()));

    return () => {
      window.clearTimeout(timeoutId);
      if (toastId) sileo.dismiss(toastId);
    };
  }, [expiry]);

  return null;
}

export default SessionExpiryWarning;
