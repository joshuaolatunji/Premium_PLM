# Product documents API (PID, FRD, BRD, SWR)

Proposed contract for the backend. The frontend is already built against this shape using a temporary in-browser mock (`src/service/DocumentService.ts`). Once these endpoints exist, only that file changes.

## What it supports

After the Group Head approves an initiative's BDO documentation (discovery), the assigned Product Manager prepares four documents, in **any order**:

| Type | Name |
|---|---|
| `PID` | Product Initiation Document |
| `FRD` | Functional Requirement Document |
| `BRD` | Business Requirements Document |
| `SWR` | Standard Work Requirement |

Every document has the same shape (an Overview plus a rich-text Description) and goes through the same review chain:

```
PM saves (Draft) → PM submits → BDO reviews → Group Head reviews → Approved
                                    │ reject          │ reject
                                    └──────► Rejected ◄┘   (back to the PM, who edits and resubmits)
```

When all four are `Approved`, the initiative moves into Product Development.

## Data model

```jsonc
// ProductDocumentDto
{
  "id": "guid",
  "productInitiativeId": "guid",
  "type": "PID | FRD | BRD | SWR",
  "author": "string",
  "sponsor": "string",
  "userGroup": "string",
  "productManager": "string",
  "introduction": "string",
  "description": "string",          // HTML from the rich-text editor — see "Description HTML"
  "status": "Draft | PendingBDOReview | PendingGroupHeadReview | Approved | Rejected",
  "version": 0,                      // 0 while never submitted; +1 on every submit/resubmit
  "createdByUserId": "guid",
  "createdAt": "datetime",
  "updatedAt": "datetime",
  "submittedAt": "datetime | null",  // when it last reached its current reviewer
  "lastDecision": {                  // null until someone has reviewed it
    "reviewer": "BDO | GroupHead",
    "isApproved": true,
    "comment": "string",             // required when rejecting
    "decidedAt": "datetime"
  }
}
```

Responses use the existing `ApiResponse<T>` envelope (`statusCode`, `isSuccessful`, `message`, `data`).

## Endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `api/product-documents/{initiativeId}` | Anyone on the initiative, Group Head | All four documents for an initiative. Return an object keyed by type, with `null` for any not started: `{ "PID": {…} \| null, "FRD": …, "BRD": …, "SWR": … }` |
| POST | `api/product-documents/{initiativeId}/{type}` | Assigned PM | Create the document as `Draft`. Body: `SaveProductDocumentDto` |
| PUT | `api/product-documents/{documentId}` | Assigned PM | Save changes. Body: `SaveProductDocumentDto` |
| POST | `api/product-documents/{documentId}/submit` | Assigned PM | `Draft`/`Rejected` → `PendingBDOReview`; `version += 1`; sets `submittedAt` |
| POST | `api/product-documents/{documentId}/review` | BDO, Group Head | Body: `{ "isApproved": bool, "comment": "string" }` — see rules |
| GET | `api/product-documents/pending-review` | BDO, Group Head | Everything waiting on the **caller** (see below) |
| GET | `api/product-documents/{documentId}/pdf` | Anyone who can read it | *(Optional, later)* PDF export, like the current `brd-pdf` |

```jsonc
// SaveProductDocumentDto
{
  "author": "string",
  "sponsor": "string",
  "userGroup": "string",
  "productManager": "string",
  "introduction": "string",
  "description": "string"   // HTML
}
```

### Rules the API should enforce

- **Create / submit** only after the initiative's discovery is `Approved` (otherwise `409`).
- **One document per type per initiative** (a second create for the same type returns `409`).
- **Edit / submit** only by the initiative's assigned PM, and only while the status is `Draft` or `Rejected` (otherwise `409`).
- **Review**:
  - The **BDO assigned to the initiative** may decide only at `PendingBDOReview`.
    - Approve → `PendingGroupHeadReview` and reset `submittedAt` to now, because it has just reached the Group Head.
    - Reject → `Rejected`.
  - The **Group Head** may decide only at `PendingGroupHeadReview`.
    - Approve → `Approved`.
    - Reject → `Rejected`.
  - `comment` is required when `isApproved` is false.
  - Any other status returns `409`.
- Record each decision in `lastDecision`. A full decision history is optional but useful for the Audit Trail.

### `pending-review`, the approval queues

Both dashboards show an **Approval queue** of everything waiting on the signed-in reviewer, as soon as it reaches them.

- **BDO:** documents at `PendingBDOReview` on initiatives where they are the BDO.
- **Group Head:** documents at `PendingGroupHeadReview`. The Group Head's queue also includes BDO documentation awaiting approval, which the existing discovery endpoints already cover.

Return each item with the document plus the initiative's `projectName` and `priority`. Without this endpoint the frontend has to fetch documents initiative by initiative.

## Description HTML

The Description is written in a rich-text editor (Tiptap) and saved as an HTML string.

- **Length:** please allow long values. Use `nvarchar(max)` or similar, with no short `maxLength`.
- **Elements used:**
  - text and blocks: `p`, `h1`–`h3`, `strong`, `em`, `u`, `s`, `code`, `blockquote`;
  - lists: `ul`, `ol`, `li`;
  - `a` with `href`;
  - `mark`, and `span` with a `style` colour attribute.
- **Sanitising:** the frontend sanitises the HTML before displaying it (DOMPurify). The backend should sanitise it too, for example with HtmlSanitizer for .NET, before storing it or using it in a PDF.
- **PDFs:** if a PDF export is added, render the HTML rather than printing it as text.

## The BRD

The BRD moves to this same format: the Overview plus a Description. That replaces today's `ProductProposal` sections (business case, scope, financials, functionalities, requirements).

Simplest option: treat the BRD as `type: "BRD"` in this API.

If `ProductProposal` is kept instead, it needs:
- a `description` field (HTML, as above);
- the old section fields made optional;
- the same submit, review and queue behaviour as above.

Existing BRDs only have the old section fields. Please confirm whether they need migrating into the Description, or whether they stay readable as they are.

## Notifications (when available)

Suggested triggers:
- submitted → notify the BDO;
- BDO approved → notify the Group Head;
- rejected by either reviewer → notify the PM;
- Group Head approved → notify the PM and the BDO.
