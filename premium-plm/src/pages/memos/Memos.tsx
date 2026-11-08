import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { memoStatusClass, memoStatusText } from "../../service/MemoService";
import type { MemoPart, MemoRegisterRow } from "../../types/memoTypes";
import { backState } from "../../utils/navigation";
import { formatDate } from "../../utils/ticketStatus";
import { useMemoLists } from "../../utils/useMemoLists";
import PreviewBadge from "../../components/memos/PreviewBadge";

const PAGE_SIZE = 10;
const PARTS: MemoPart[] = ["Author", "Reviewer", "Signer"];
const FILTER_KEYS = ["q", "part", "status", "from", "to"] as const;
const COLUMNS = 7;

// The row's button: the next step when the memo is waiting on the user,
// otherwise just a way to read it.
const ROW_ACTION: Record<NonNullable<MemoRegisterRow["waiting"]>, string> = {
  sign: "Review & sign",
  review: "Review",
  action: "Open",
};

function matches(row: MemoRegisterRow, search: string): boolean {
  return `${row.subject} ${row.memoNumber} ${row.from} ${row.to}`.toLowerCase().includes(search);
}

// The Memos register: every memo the user is part of (written, reviewed or
// signing), searchable and filterable, a page at a time. What's waiting on
// the user is on the dashboard; this is the full record. Filters live in the
// address, so they survive a refresh and Back from a memo.
function Memos() {
  const navigate = useNavigate();
  const memos = useMemoLists();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const part = PARTS.find((item) => item === searchParams.get("part")) ?? null;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const statuses = [...new Set(memos.involved.map((row) => row.status))];
  const status = statuses.includes(searchParams.get("status") ?? "") ? searchParams.get("status") : null;

  const datesInvalid = Boolean(from && to && from > to);
  const needle = search.trim().toLowerCase();
  const filtered = datesInvalid
    ? []
    : memos.involved.filter((row) => {
        const day = (row.date ?? "").slice(0, 10);
        return (
          (!needle || matches(row, needle)) &&
          (!part || row.parts.includes(part)) &&
          (!status || row.status === status) &&
          (!from || (day && day >= from)) &&
          (!to || (day && day <= to))
        );
      });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.get("page")) || 1), totalPages);
  const first = (page - 1) * PAGE_SIZE;
  const shown = filtered.slice(first, first + PAGE_SIZE);
  const filtering = FILTER_KEYS.some((key) => searchParams.get(key));

  // Replace, not push, so Back leaves the page instead of undoing filters.
  function setParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    setSearchParams(params, { replace: true });
  }

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string) {
    setParams({ [key]: value, page: null });
  }

  const emptyText = filtering
    ? "No memos match these filters."
    : "You're not part of any memos yet. Create one to get started.";

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header__content">
          <p className="dashboard-breadcrumb">PremiumPLM / Memos</p>

          <h1 className="dashboard-title preview-title">
            Memos
            <PreviewBadge />
          </h1>

          <p className="dashboard-subtitle">Every memo you've written, reviewed or signed, in one place.</p>
        </div>

        <div className="dashboard-header__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => navigate("/dashboard/memos/new", { state: backState("Back to memos") })}
          >
            <Plus size={17} strokeWidth={2} aria-hidden="true" />
            Create memo
          </button>
        </div>
      </header>

      <section className="sign-offs-filters" aria-label="Filter memos">
        <div className="sign-offs-filters_field sign-offs-filters_field--wide">
          <label htmlFor="memos-search">Search</label>
          <div className="memo-register__search">
            <Search size={16} aria-hidden="true" />
            <input
              id="memos-search"
              type="search"
              value={search}
              placeholder="Subject, number, from or to"
              onChange={(event) => setFilter("q", event.target.value)}
            />
          </div>
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="memos-part">Your part</label>
          <select id="memos-part" value={part ?? ""} onChange={(event) => setFilter("part", event.target.value)}>
            <option value="">All parts</option>
            {PARTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="memos-status">Status</label>
          <select id="memos-status" value={status ?? ""} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {memoStatusText(item)}
              </option>
            ))}
          </select>
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="memos-from">Updated from</label>
          <input id="memos-from" type="date" value={from} max={to || undefined} onChange={(event) => setFilter("from", event.target.value)} />
        </div>

        <div className="sign-offs-filters_field">
          <label htmlFor="memos-to">Updated to</label>
          <input id="memos-to" type="date" value={to} min={from || undefined} onChange={(event) => setFilter("to", event.target.value)} />
        </div>

        {filtering && (
          <button type="button" className="button button--dark" onClick={() => setSearchParams({}, { replace: true })}>
            <X size={15} aria-hidden="true" />
            Clear filters
          </button>
        )}
      </section>

      <p className="mock-data-notice">
        Memos you've already signed aren't listed yet: the API has no memo signing history (gaps file M36). Reviews are
        kept in this browser until the backend adds them (M34).
      </p>

      <section className="dashboard-panel">
        {memos.isError && (
          <p className="initiatives-empty initiatives-empty--error">Couldn't load your memos. Try refreshing the page.</p>
        )}

        {datesInvalid && (
          <p className="initiatives-empty initiatives-empty--error">The "Updated from" date is after the "Updated to" date.</p>
        )}

        <div className="portfolio-table-wrapper">
          <table className="portfolio-table memo-table">
            <colgroup>
              <col />
              <col className="memo-table__part" />
              <col className="memo-table__party" />
              <col className="memo-table__party" />
              <col className="memo-table__date" />
              <col className="memo-table__status" />
              <col className="memo-table__action" />
            </colgroup>

            <thead>
              <tr>
                <th>Subject</th>
                <th>Your part</th>
                <th>From</th>
                <th>To</th>
                <th>Updated</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {memos.isLoading && (
                <tr>
                  <td colSpan={COLUMNS} className="initiatives-empty">
                    Loading memos…
                  </td>
                </tr>
              )}

              {/* Same row motion as the dashboard lists (MemoTable): a soft
                  staggered entrance, and filtering glides the rest into place. */}
              <AnimatePresence initial={true}>
              {!memos.isLoading &&
                shown.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 8) * 0.035 } }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ layout: { type: "spring", stiffness: 500, damping: 40 } }}
                  >
                    <td>
                      <div className="initiative-cell">
                        <strong title={row.subject}>{row.subject || "Untitled memo"}</strong>
                        {row.memoNumber && <span>{row.memoNumber}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="memo-parts">
                        {row.parts.map((item) => (
                          <span key={item} className={`memo-part memo-part--${item.toLowerCase()}`}>
                            {item}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="memo-table__text" title={row.from}>
                      {row.from || "—"}
                    </td>
                    <td className="memo-table__text" title={row.to}>
                      {row.to || "—"}
                    </td>
                    <td className="sign-offs_date">{row.date ? formatDate(row.date) : "—"}</td>
                    <td>
                      <span className={memoStatusClass(row.status)}>{memoStatusText(row.status)}</span>
                    </td>
                    <td className="memo-table__actions">
                      <button
                        type="button"
                        className={row.waiting ? "table-action table-action--premium" : "table-action table-action--dark"}
                        onClick={() => navigate(`/dashboard/memos/${row.id}`, { state: backState("Back to memos") })}
                      >
                        {row.waiting ? ROW_ACTION[row.waiting] : "View"}
                        <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {!memos.isLoading && !datesInvalid && shown.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS} className="initiatives-empty">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!memos.isLoading && filtered.length > 0 && (
          <div className="sign-offs-pager">
            <button
              type="button"
              className="button button--dark"
              onClick={() => setParams({ page: String(page - 1) })}
              disabled={page <= 1}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              Previous
            </button>

            <span>
              {first + 1}–{first + shown.length} of {filtered.length} {filtered.length === 1 ? "memo" : "memos"}
            </span>

            <button
              type="button"
              className="button button--dark"
              onClick={() => setParams({ page: String(page + 1) })}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default Memos;
