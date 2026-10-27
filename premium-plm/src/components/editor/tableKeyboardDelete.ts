import { Extension } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";

// Lets the keyboard remove a whole table, like a word processor:
// - Backspace at the very start of the line just after a table, or
// - Delete at the very end of the line just before one,
// first selects the table (it's highlighted), and pressing the key again
// deletes it — the default behaviour for a selected block. The two steps
// stop a table being wiped by one stray key press.
// (Selecting every cell and pressing Delete/Backspace also works — that's
// built into the table extension.)
function selectNeighbouringTable(state: EditorState, direction: "before" | "after") {
  const { selection } = state;

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const atEdge = direction === "before" ? $from.parentOffset === 0 : $from.parentOffset === $from.parent.content.size;

  if (!atEdge || $from.depth < 1) {
    return null;
  }

  // The block next to the one the cursor is in.
  const blockPos = direction === "before" ? $from.before() : $from.after();
  const $block = state.doc.resolve(blockPos);
  const neighbour = direction === "before" ? $block.nodeBefore : $block.nodeAfter;

  if (neighbour?.type.name !== "table") {
    return null;
  }

  const tablePos = direction === "before" ? blockPos - neighbour.nodeSize : blockPos;
  return NodeSelection.create(state.doc, tablePos);
}

export const TableKeyboardDelete = Extension.create({
  name: "tableKeyboardDelete",

  addKeyboardShortcuts() {
    const select = (direction: "before" | "after") => () => {
      const { state, view } = this.editor;
      const tableSelection = selectNeighbouringTable(state, direction);

      if (!tableSelection) {
        return false;
      }

      view.dispatch(state.tr.setSelection(tableSelection));
      return true;
    };

    return {
      Backspace: select("before"),
      Delete: select("after"),
    };
  },
});
