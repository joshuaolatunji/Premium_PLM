import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extensions";
import {
  Baseline,
  Bold,
  ChevronDown,
  Code,
  Heading,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  TextQuote,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";

// Highlight and text colours offered in the toolbar. Mid-tone colours, so
// text stays readable in both light and dark mode.
const HIGHLIGHT_COLOURS = [
  { label: "Yellow", value: "#fde68a" },
  { label: "Green", value: "#bbf7d0" },
  { label: "Blue", value: "#bfdbfe" },
  { label: "Pink", value: "#fbcfe8" },
  { label: "Orange", value: "#fed7aa" },
];

const TEXT_COLOURS = [
  { label: "Red", value: "#dd2025" },
  { label: "Orange", value: "#d97706" },
  { label: "Green", value: "#15803d" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Grey", value: "#6b7280" },
];

const TEXT_STYLES = [
  { label: "Normal text", level: 0 },
  { label: "Heading 1", level: 1 },
  { label: "Heading 2", level: 2 },
  { label: "Heading 3", level: 3 },
] as const;

type MenuName = "highlight" | "colour" | "style";

interface ToolButtonProps {
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function ToolButton({ label, onClick, isActive = false, disabled = false, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      className={isActive ? "rte-tool rte-tool--active" : "rte-tool"}
      // Keeps the text selection in the editor when a button is pressed.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isActive}
      title={label}
    >
      {children}
    </button>
  );
}

// "example.com" → "https://example.com", so a pasted address still opens.
function normaliseUrl(url: string): string {
  const trimmed = url.trim();

  if (!trimmed || /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function promptForLink(editor: Editor) {
  const current = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link address", current ?? "https://");

  // Cancelled — leave the link as it was.
  if (url === null) {
    return;
  }

  const href = normaliseUrl(url);

  if (!href || href === "https://") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
}

interface RichTextEditorProps {
  id?: string;
  // HTML. An empty editor reports "".
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

// A text box with a formatting toolbar (Tiptap). Saves HTML; anything that
// displays it again must go through RichTextContent, which sanitises it.
function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Click to add…",
  disabled = false,
  ariaLabel,
}: RichTextEditorProps) {
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "rte-content rich-text-content",
        ...(id ? { id } : {}),
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.isEmpty ? "" : current.getHTML());
    },
  });

  // Toolbar highlighting follows the cursor.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      strike: current?.isActive("strike") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      code: current?.isActive("code") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
      link: current?.isActive("link") ?? false,
      highlight: current?.isActive("highlight") ?? false,
      headingLevel: [1, 2, 3].find((level) => current?.isActive("heading", { level })) ?? 0,
      canIndent: current?.can().sinkListItem("listItem") ?? false,
      canOutdent: current?.can().liftListItem("listItem") ?? false,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  });

  // Content loaded after the editor mounted (e.g. a saved document arriving
  // from the server) replaces what's shown — without counting as an edit.
  useEffect(() => {
    if (!editor) {
      return;
    }

    const shown = editor.isEmpty ? "" : editor.getHTML();

    if (value !== shown) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // Close an open dropdown when clicking anywhere outside the toolbar.
  useEffect(() => {
    if (!openMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openMenu]);

  if (!editor || !state) {
    return <div className="rte rte--loading" />;
  }

  const chain = () => editor.chain().focus();

  function toggleMenu(menu: MenuName) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  function runAndClose(action: () => void) {
    action();
    setOpenMenu(null);
  }

  const currentStyle = TEXT_STYLES.find((style) => style.level === state.headingLevel) ?? TEXT_STYLES[0];

  return (
    <div className={disabled ? "rte rte--disabled" : "rte"}>
      <EditorContent editor={editor} />

      {!disabled && (
        <div className="rte-toolbar" ref={toolbarRef} role="toolbar" aria-label="Formatting">
          <div className="rte-group">
            <ToolButton label="Bold" isActive={state.bold} onClick={() => chain().toggleBold().run()}>
              <Bold size={17} />
            </ToolButton>
            <ToolButton label="Italic" isActive={state.italic} onClick={() => chain().toggleItalic().run()}>
              <Italic size={17} />
            </ToolButton>
            <ToolButton label="Underline" isActive={state.underline} onClick={() => chain().toggleUnderline().run()}>
              <Underline size={17} />
            </ToolButton>
            <ToolButton label="Strikethrough" isActive={state.strike} onClick={() => chain().toggleStrike().run()}>
              <Strikethrough size={17} />
            </ToolButton>
          </div>

          <div className="rte-group">
            <ToolButton label="Bulleted list" isActive={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
              <List size={17} />
            </ToolButton>
            <ToolButton label="Numbered list" isActive={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
              <ListOrdered size={17} />
            </ToolButton>
            <ToolButton label="Decrease indent" disabled={!state.canOutdent} onClick={() => chain().liftListItem("listItem").run()}>
              <IndentDecrease size={17} />
            </ToolButton>
            <ToolButton label="Increase indent" disabled={!state.canIndent} onClick={() => chain().sinkListItem("listItem").run()}>
              <IndentIncrease size={17} />
            </ToolButton>
          </div>

          <div className="rte-group">
            <div className="rte-menu">
              <ToolButton label="Highlight colour" isActive={state.highlight || openMenu === "highlight"} onClick={() => toggleMenu("highlight")}>
                <Highlighter size={17} />
                <ChevronDown size={13} />
              </ToolButton>

              {openMenu === "highlight" && (
                <div className="rte-menu_panel rte-swatches" role="menu">
                  {HIGHLIGHT_COLOURS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      className="rte-swatch"
                      style={{ background: colour.value }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runAndClose(() => chain().toggleHighlight({ color: colour.value }).run())}
                      aria-label={`${colour.label} highlight`}
                      title={colour.label}
                    />
                  ))}
                  <button
                    type="button"
                    className="rte-menu_item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runAndClose(() => chain().unsetHighlight().run())}
                  >
                    No highlight
                  </button>
                </div>
              )}
            </div>

            <div className="rte-menu">
              <ToolButton label="Text colour" isActive={openMenu === "colour"} onClick={() => toggleMenu("colour")}>
                <Baseline size={17} />
                <ChevronDown size={13} />
              </ToolButton>

              {openMenu === "colour" && (
                <div className="rte-menu_panel rte-swatches" role="menu">
                  {TEXT_COLOURS.map((colour) => (
                    <button
                      key={colour.value}
                      type="button"
                      className="rte-swatch"
                      style={{ background: colour.value }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => runAndClose(() => chain().setColor(colour.value).run())}
                      aria-label={`${colour.label} text`}
                      title={colour.label}
                    />
                  ))}
                  <button
                    type="button"
                    className="rte-menu_item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => runAndClose(() => chain().unsetColor().run())}
                  >
                    Default colour
                  </button>
                </div>
              )}
            </div>

            <div className="rte-menu">
              <ToolButton label={`Text style: ${currentStyle.label}`} isActive={openMenu === "style"} onClick={() => toggleMenu("style")}>
                <Heading size={17} />
                <ChevronDown size={13} />
              </ToolButton>

              {openMenu === "style" && (
                <div className="rte-menu_panel" role="menu">
                  {TEXT_STYLES.map((style) => (
                    <button
                      key={style.level}
                      type="button"
                      className={
                        style.level === state.headingLevel
                          ? `rte-menu_item rte-menu_item--active rte-menu_item--h${style.level}`
                          : `rte-menu_item rte-menu_item--h${style.level}`
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        runAndClose(() =>
                          style.level === 0
                            ? chain().setParagraph().run()
                            : chain().toggleHeading({ level: style.level }).run(),
                        )
                      }
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rte-group">
            <ToolButton label="Inline code" isActive={state.code} onClick={() => chain().toggleCode().run()}>
              <Code size={17} />
            </ToolButton>
            <ToolButton label="Quote" isActive={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
              <TextQuote size={17} />
            </ToolButton>
            <ToolButton label={state.link ? "Edit link" : "Insert link"} isActive={state.link} onClick={() => promptForLink(editor)}>
              <Link size={17} />
            </ToolButton>
            <ToolButton label="Remove link" disabled={!state.link} onClick={() => chain().extendMarkRange("link").unsetLink().run()}>
              <Unlink size={17} />
            </ToolButton>
            <ToolButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
              <RemoveFormatting size={17} />
            </ToolButton>
          </div>

          <div className="rte-group">
            <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
              <Undo2 size={17} />
            </ToolButton>
            <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
              <Redo2 size={17} />
            </ToolButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default RichTextEditor;
