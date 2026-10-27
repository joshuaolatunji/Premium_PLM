import { useEffect, useState } from "react";
import { Clock, X } from "lucide-react";

// How long before the session ends the warning appears.
const WARNING_MS = 1 * 60 * 1000;

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface SessionExpiryWarningProps {
  // When the session ends (ms since epoch).
  expiry: number;
}

// A countdown shown for the last few minutes of a session. The backend has no
// way to extend a session yet, so this is the user's cue to save their work —
// after signing in again they're brought back to the same page.
function SessionExpiryWarning({ expiry }: SessionExpiryWarningProps) {
  const [msLeft, setMsLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function tick() {
      const left = expiry - Date.now();
      setMsLeft(left <= WARNING_MS ? left : null);
    }

    const firstTick = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);

    return () => {
      clearTimeout(firstTick);
      clearInterval(intervalId);
    };
  }, [expiry]);

  if (msLeft === null || dismissed) {
    return null;
  }

  return (
    <div className="session-warning" role="alert">
      <Clock size={20} aria-hidden="true" className="session-warning_icon" />

      <div>
        <strong>Your session ends in {formatRemaining(msLeft)}</strong>
        {/* <p>
          Save your work now. You'll be asked to sign in again, and brought back to this page.
          Anything you've typed but not saved is kept on this device.
        </p> */}
      </div>

      <button
        type="button"
        className="session-warning_close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default SessionExpiryWarning;
