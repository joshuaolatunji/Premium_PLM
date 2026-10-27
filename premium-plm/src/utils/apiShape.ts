// Readers for API responses that have no documented schema yet (the ticket
// and approval-workflow endpoints only say "200 OK" in Swagger). They look
// for a value under each of the likely field names, so the pages keep
// working whichever names the backend settles on. Once the response DTOs
// are published (gaps file R10, R14), the services can read fields directly.

export type ApiRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// The `data` of the usual { statusCode, isSuccessful, message, data }
// envelope, or the body itself when it isn't wrapped.
export function unwrapData(body: unknown): unknown {
  if (isRecord(body) && "data" in body && ("isSuccessful" in body || "statusCode" in body)) {
    return body.data;
  }

  return body;
}

// A list from the response: the array itself, or the first array found
// under one of `keys` (e.g. { items: [...] }).
export function readList(body: unknown, keys: string[] = ["items", "results", "data"]): ApiRecord[] {
  const data = unwrapData(body);

  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (isRecord(data)) {
    for (const key of keys) {
      const value = data[key];

      if (Array.isArray(value)) {
        return value.filter(isRecord);
      }
    }
  }

  return [];
}

export function readString(record: ApiRecord | null | undefined, ...keys: string[]): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

export function readNumber(record: ApiRecord | null | undefined, ...keys: string[]): number | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

export function readRecord(record: ApiRecord | null | undefined, ...keys: string[]): ApiRecord | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (isRecord(value)) {
      return value;
    }
  }

  return null;
}

export function readArray(record: ApiRecord | null | undefined, ...keys: string[]): ApiRecord[] | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return null;
}

// The id of something just created: the body may be the new record, a bare
// id string, or { id } / { workflowId } etc.
export function readCreatedId(body: unknown, ...keys: string[]): string | null {
  const data = unwrapData(body);

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  const record = readFirstRecord(body);
  return record ? readString(record, ...keys, "id") : null;
}

// The record in `data`, or the first one when `data` is a list (several
// endpoints wrap a single result in a one-item list).
export function readFirstRecord(body: unknown): ApiRecord | null {
  const data = unwrapData(body);

  if (Array.isArray(data)) {
    return data.find(isRecord) ?? null;
  }

  return isRecord(data) ? data : null;
}

// "In_Progress", "inProgress", "In Progress" → "inprogress", for matching
// status names whose exact spelling isn't documented.
export function statusKey(value: unknown): string {
  return String(value ?? "").replace(/[^a-z]/gi, "").toLowerCase();
}
