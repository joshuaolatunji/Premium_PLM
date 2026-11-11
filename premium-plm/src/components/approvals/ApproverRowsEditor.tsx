import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import type { PLMUser } from "../../types/userTypes";
import type { ApproverInput } from "../../types/approvalTypes";
import { formatPersonName, formatRoleName } from "../../utils/text";
import SearchableSelect from "../ui/SearchableSelect";
import { approverLevel } from "../../utils/approvers";
import type { PersonNoun } from "../../utils/approvers";

interface ApproverRowsEditorProps {
  rows: ApproverInput[];
  setRows: (change: (current: ApproverInput[]) => ApproverInput[]) => void;
  // Everyone who can be picked (active users).
  users: PLMUser[];
  usersLoading: boolean;
  disabled?: boolean;
  // Keeps the ids unique when two pickers could be on one page.
  idPrefix?: string;
  // "1st approver" or "1st reviewer".
  noun?: PersonNoun;
}

// The approvers, in signing order: a person for each level, their title
// beside it, and tools to reorder or remove a level. Used for a document's
// sign-off and a memo's.
function ApproverRowsEditor({
  rows,
  setRows,
  users,
  usersLoading,
  disabled = false,
  idPrefix = "approver",
  noun = "approver",
}: ApproverRowsEditorProps) {
  // By full name, A–Z. Their role shows beside the dropdown once chosen.
  const sortedUsers = [...users].sort((a, b) => formatPersonName(a).localeCompare(formatPersonName(b)));

  function chooseUser(index: number, userId: string) {
    const user = users.find((entry) => entry.userId === userId);

    // Their role is their title on the sign-off, e.g. "Risk Officer".
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? { userId, name: user ? formatPersonName(user) : "", role: user?.role[0] ? formatRoleName(user.role[0]) : "" }
          : row,
      ),
    );
  }

  function moveRow(index: number, offset: -1 | 1) {
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + offset, 0, row);
      return next;
    });
  }

  return (
    <ol className="approver-list">
      {rows.map((row, index) => (
        <li key={index} className="approver-row">
          <span className="approver-row_level">
            <span className="approver-row_number">{index + 1}</span>
            {approverLevel(index + 1, noun)}
            {rows.length > 1 && index === rows.length - 1 && <em>Final</em>}
          </span>

          <div className="form-field">
            <label htmlFor={`${idPrefix}-user-${index}`} className="sr-only">
              {approverLevel(index + 1, noun)}
            </label>
            <SearchableSelect
              className="approver-picker"
              searchable
              searchPlaceholder="Search by name or role…"
              id={`${idPrefix}-user-${index}`}
              value={row.userId}
              onChange={(event) => chooseUser(index, event.target.value)}
              disabled={usersLoading || disabled}
            >
              <option value="" disabled>
                {usersLoading ? "Loading staff…" : "Select a person"}
              </option>

              {sortedUsers.map((user) => (
                <option
                  key={user.userId}
                  value={user.userId}
                  // Each person can only sign once.
                  disabled={rows.some((other, otherIndex) => otherIndex !== index && other.userId === user.userId)}
                  data-description={user.role.map(formatRoleName).join(", ")}
                >
                  {formatPersonName(user)}
                </option>
              ))}
            </SearchableSelect>
          </div>

          <span className={row.role ? "approver-row_role" : "approver-row_role approver-row_role--empty"}>
            {row.role || "No one chosen"}
          </span>

          <div className="approver-row_tools">
            <button
              type="button"
              className="icon-button"
              onClick={() => moveRow(index, -1)}
              disabled={index === 0}
              aria-label={`Move ${approverLevel(index + 1, noun)} up`}
              title="Sign earlier"
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => moveRow(index, 1)}
              disabled={index === rows.length - 1}
              aria-label={`Move ${approverLevel(index + 1, noun)} down`}
              title="Sign later"
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--danger"
              onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
              disabled={rows.length === 1}
              aria-label={`Remove ${approverLevel(index + 1, noun)}`}
              title="Remove"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default ApproverRowsEditor;
