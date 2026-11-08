import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { memoStatusClass, memoStatusText } from "../../service/MemoService";
import type { MemoRow } from "../../types/memoTypes";
import { backState } from "../../utils/navigation";
import { formatDate } from "../../utils/ticketStatus";

interface MemoTableProps {
  rows: MemoRow[];
  emptyText: string;
  // Where "Back" returns to from a memo, e.g. "Back to memos".
  backLabel: string;
  // The row button, e.g. "Review" or "Review & sign"; "View" by default.
  actionLabel?: string;
  isLoading?: boolean;
  // Shown above the empty text, e.g. the dashboard's "all caught up" orb.
  emptyArt?: ReactNode;
}

const COLUMNS = 6;

// A list of memos: subject and number, who it's from and to, when it last
// changed, its status, and a button to open it.
function MemoTable({ rows, emptyText, backLabel, actionLabel = "View", isLoading = false, emptyArt }: MemoTableProps) {
  const navigate = useNavigate();

  return (
    <div className="portfolio-table-wrapper">
      <table className="portfolio-table memo-table">
        {/* Fixed widths, so every memo list on a page lines up. */}
        <colgroup>
          <col />
          <col className="memo-table__party" />
          <col className="memo-table__party" />
          <col className="memo-table__date" />
          <col className="memo-table__status" />
          <col className="memo-table__action" />
        </colgroup>

        <thead>
          <tr>
            <th>Subject</th>
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
          {isLoading && (
            <tr>
              <td colSpan={COLUMNS} className="initiatives-empty">
                Loading memos…
              </td>
            </tr>
          )}

          {/* Rows ease in one after another; when the list changes (a dashboard
              filter), leaving rows fade out and the rest glide into place. */}
          <AnimatePresence initial={true}>
          {!isLoading &&
            rows.map((row, index) => (
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
                    className={actionLabel === "View" ? "table-action table-action--dark" : "table-action table-action--premium"}
                    onClick={() => navigate(`/dashboard/memos/${row.id}`, { state: backState(backLabel) })}
                  >
                    {actionLabel}
                    <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>

          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS} className="initiatives-empty">
                {emptyArt ? (
                  <div className="memo-empty">
                    {emptyArt}
                    <span>{emptyText}</span>
                  </div>
                ) : (
                  emptyText
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default MemoTable;
