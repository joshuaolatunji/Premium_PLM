// A tiny browser-storage table for simulating endpoints the backend hasn't
// built yet (see docs/backend-endpoint-gaps.md). Unlike the old in-memory
// mocks, records survive a reload and are shared by every account signed in
// on this browser — so a flow that passes between roles (PM → approver,
// Lead Engineer → developer) can be tried end to end by signing in as each
// person in turn. Nothing here reaches the server or other devices.

const PREFIX = "plm-mock";

function storageKey(table: string) {
  return `${PREFIX}:${table}`;
}

export function readTable<T>(table: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(storageKey(table));
    return raw ? (JSON.parse(raw) as Record<string, T>) : {};
  } catch {
    return {};
  }
}

function writeTable<T>(table: string, rows: Record<string, T>) {
  try {
    localStorage.setItem(storageKey(table), JSON.stringify(rows));
  } catch {
    // Storage full or blocked — the simulated change just isn't kept.
  }
}

export function readRow<T>(table: string, id: string): T | null {
  return readTable<T>(table)[id] ?? null;
}

export function listRows<T>(table: string): T[] {
  return Object.values(readTable<T>(table));
}

export function writeRow<T>(table: string, id: string, row: T) {
  const rows = readTable<T>(table);
  rows[id] = row;
  writeTable(table, rows);
}

// Applies `change` to an existing row; does nothing if it isn't there.
export function updateRow<T>(table: string, id: string, change: (row: T) => T): T | null {
  const rows = readTable<T>(table);
  const row = rows[id];

  if (!row) {
    return null;
  }

  rows[id] = change(row);
  writeTable(table, rows);
  return rows[id];
}

export function deleteRow(table: string, id: string) {
  const rows = readTable(table);

  if (id in rows) {
    delete rows[id];
    writeTable(table, rows);
  }
}

export function makeLocalId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Same 150ms pause the other mocks use, so loading states still show.
export function simulateLatency<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 150));
}
