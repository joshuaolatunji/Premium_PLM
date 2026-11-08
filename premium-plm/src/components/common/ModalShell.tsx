import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  // While busy (saving, sending…) the backdrop, Escape and Cancel can't close it.
  busy?: boolean;
  labelledBy: string;
  // Extra panel classes, e.g. "modal-panel--compact".
  className?: string;
  role?: "dialog" | "alertdialog";
  children: ReactNode;
}

// The app's modal: a dimmed, softly blurred backdrop and a panel that rises
// into place on a gentle spring, then sinks away when closed (the exit is
// why it needs motion; a CSS animation can't run on something being
// removed). The backdrop or Escape closes it, unless it's busy.
function ModalShell({ open, onClose, busy = false, labelledBy, className = "", role = "dialog", children }: ModalShellProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  return (
    // propagate: when a parent AnimatePresence removes the whole modal (as
    // with DecisionModal), the panel still plays its exit.
    <AnimatePresence propagate>
      {open && (
        <motion.div
          className="modal-overlay modal-overlay--motion"
          role="presentation"
          onClick={() => !busy && onClose()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18, delay: 0.04 } }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <motion.div
            className={`modal-panel ${className}`.trim()}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.16, ease: "easeIn" } }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ModalShell;
