import { useCallback, useEffect, useState } from "react";

import { getCurrentUserId } from "../apicalls/authStorage";

// Form state that survives the session expiring, a refresh or a closed tab.
//
// Works like useState, but while the value differs from its "pristine" value
// (the empty form, or what's saved on the server) it's copied to this device
// as the user types. Opening the same form again restores it. Drafts are kept
// per signed-in user and per form `key`, so nothing leaks between people or
// between records.
//
// - A create form that resets to its empty values after submitting needs no
//   extra call: back at pristine, the draft is dropped.
// - An edit form calls `markSaved()` after a successful save, so the saved
//   values become the new pristine ones.
// - Never use this for passwords or other secrets.
//
// Pass `key: null` to turn the draft off (e.g. while the form is read-only).

const PREFIX = "plm-draft";

interface StoredDraft<T> {
  value: T;
  savedAt: string;
}

function storageKey(key: string) {
  return `${PREFIX}:${getCurrentUserId() ?? "anonymous"}:${key}`;
}

function readDraft<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    return raw ? (JSON.parse(raw) as StoredDraft<T>) : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T) {
  try {
    const draft: StoredDraft<T> = { value, savedAt: new Date().toISOString() };
    localStorage.setItem(storageKey(key), JSON.stringify(draft));
  } catch {
    // Storage full or blocked — the edits just aren't kept.
  }
}

function removeDraft(key: string) {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // Nothing to remove.
  }
}

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Drops a stored draft from outside its form — e.g. once a decision whose
// comment was typed in a modal has been recorded.
export function clearDraft(key: string) {
  removeDraft(key);
}

export interface DraftControls<T> {
  // When restored edits were last typed (ISO), or null if nothing was restored.
  restoredAt: string | null;
  // Throws the restored edits away and goes back to the pristine values.
  discard: () => void;
  // After a successful save: these values are now the pristine ones.
  markSaved: (saved?: T) => void;
}

export function useDraftState<T>(
  key: string | null,
  initial: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>, DraftControls<T>] {
  const [pristine, setPristine] = useState<T>(initial);

  const [restored, setRestored] = useState<StoredDraft<T> | null>(() => {
    if (!key) {
      return null;
    }

    const draft = readDraft<T>(key);
    return draft && !same(draft.value, pristine) ? draft : null;
  });

  const [value, setValue] = useState<T>(() => restored?.value ?? pristine);

  // The same form showing a different record (e.g. moving from the PID to
  // the FRD without leaving the page) starts again from that record's own
  // draft. Without this, the previous record's input stayed on screen and
  // was then saved as the new record's draft too.
  const [activeKey, setActiveKey] = useState(key);

  if (key !== activeKey) {
    const fresh = initial instanceof Function ? initial() : initial;
    const draft = key ? readDraft<T>(key) : null;
    const nextRestored = draft && !same(draft.value, fresh) ? draft : null;

    setActiveKey(key);
    setPristine(fresh);
    setRestored(nextRestored);
    setValue(nextRestored?.value ?? fresh);
  }

  // Save (briefly debounced) while there are unsaved edits; drop the draft
  // once the value is back to pristine.
  useEffect(() => {
    if (!key) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (same(value, pristine)) {
        removeDraft(key);
      } else {
        writeDraft(key, value);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [key, value, pristine]);

  const discard = useCallback(() => {
    if (key) {
      removeDraft(key);
    }

    setRestored(null);
    setValue(pristine);
  }, [key, pristine]);

  const markSaved = useCallback(
    (saved?: T) => {
      if (key) {
        removeDraft(key);
      }

      setRestored(null);
      setPristine(saved !== undefined ? saved : value);
    },
    [key, value],
  );

  return [value, setValue, { restoredAt: restored?.savedAt ?? null, discard, markSaved }];
}
