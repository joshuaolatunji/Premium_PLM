import { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Search } from "lucide-react";

// A <select> that opens a searchable list instead of the browser's own.
//
// Use it exactly like <select>, with the same <option> children, value and
// onChange. The <select> itself stays on the page (so every existing style,
// label and form rule still applies); only its list is replaced. Picking an
// item sets the select's value and fires a real change event, so onChange
// handlers reading event.target.value work unchanged.
//
// Extra, per <option>:
//   data-description  a second line under the label (e.g. a person's role),
//                     also matched by the search
//   data-keywords     more words the search should match
//
// A disabled option with value "" is the placeholder: it shows in the
// closed select but isn't listed.

interface Item {
  value: string;
  label: string;
  description: string;
  keywords: string;
  disabled: boolean;
}

type OptionProps = ComponentProps<"option"> & { "data-description"?: string; "data-keywords"?: string };

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

function readItems(children: ReactNode): Item[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<OptionProps> => isValidElement(child) && child.type === "option")
    .map((child) => {
      const label = textOf(child.props.children).trim();
      return {
        value: child.props.value === undefined ? label : String(child.props.value),
        label,
        description: child.props["data-description"] ?? "",
        keywords: child.props["data-keywords"] ?? "",
        disabled: Boolean(child.props.disabled),
      };
    });
}

// Every word typed must appear in the label, description or keywords.
function matches(item: Item, query: string): boolean {
  const haystack = `${item.label} ${item.description} ${item.keywords}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

// Sets the select's value the way a user would, so React's onChange runs.
function pick(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

const OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " ", "F4"]);
const PANEL_GAP = 6;
const PANEL_MAX = 340;

type SearchableSelectProps = ComponentProps<"select"> & {
  // Shows the search box (on by default; false hides it).
  searchable?: boolean;
  searchPlaceholder?: string;
};

function SearchableSelect({
  children,
  searchable,
  searchPlaceholder = "Search…",
  onMouseDown,
  onKeyDown,
  ref,
  ...selectProps
}: SearchableSelectProps) {
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number }>();

  const items = useMemo(() => readItems(children).filter((item) => !(item.disabled && item.value === "")), [children]);
  const showSearch = searchable ?? true;
  const shown = useMemo(() => (query ? items.filter((item) => matches(item, query)) : items), [items, query]);
  const current = String(selectProps.value ?? "");

  function setRefs(node: HTMLSelectElement | null) {
    selectRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  function firstEnabled(list: Item[], from = 0, step = 1): number {
    for (let index = from; index >= 0 && index < list.length; index += step) {
      if (!list[index].disabled) return index;
    }
    return -1;
  }

  function openWith(initialQuery = "") {
    if (selectProps.disabled) return;
    const list = initialQuery ? items.filter((item) => matches(item, initialQuery)) : items;
    const selected = list.findIndex((item) => item.value === current && !item.disabled);
    setQuery(initialQuery);
    setActive(selected >= 0 ? selected : firstEnabled(list));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) selectRef.current?.focus();
  }

  function choose(item: Item) {
    if (item.disabled || !selectRef.current) return;
    if (item.value !== current) pick(selectRef.current, item.value);
    close();
  }

  // Beside the select: below it, or above when there's more room there.
  useLayoutEffect(() => {
    if (!open) return;

    function measure() {
      const rect = selectRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 32);
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      const below = window.innerHeight - rect.bottom - PANEL_GAP - 12;
      const above = rect.top - PANEL_GAP - 12;
      const upward = below < 240 && above > below;
      const maxHeight = Math.min(PANEL_MAX, upward ? above : below);
      setPlace(
        upward
          ? { left, width, bottom: window.innerHeight - rect.top + PANEL_GAP, maxHeight }
          : { left, width, top: rect.bottom + PANEL_GAP, maxHeight },
      );
    }

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  // Closes on a click anywhere else, and on Escape before any modal does.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !selectRef.current?.contains(target)) close(false);
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      close();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape, true);
    };
  });

  // Keeps the highlighted item in view.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function moveActive(step: 1 | -1) {
    if (shown.length === 0) return;
    const start = active < 0 ? (step === 1 ? 0 : shown.length - 1) : active + step;
    const next = firstEnabled(shown, start, step);
    if (next >= 0) setActive(next);
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && shown[active]) choose(shown[active]);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <>
      <select
        {...selectProps}
        ref={setRefs}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          if (event.button !== 0 || selectProps.disabled) return;
          // Stops the browser's own list; ours opens instead.
          event.preventDefault();
          event.currentTarget.focus();
          if (open) close();
          else openWith();
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (open || selectProps.disabled) return;
          if (OPEN_KEYS.has(event.key) || (event.altKey && event.key === "ArrowDown")) {
            event.preventDefault();
            openWith();
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && showSearch) {
            // Typing on the closed select starts a search.
            event.preventDefault();
            openWith(event.key);
          }
        }}
      >
        {children}
      </select>

      {createPortal(
        <AnimatePresence>
          {open && place && (
            <motion.div
              ref={panelRef}
              className="select-menu"
              style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
              initial={{ opacity: 0, y: place.top !== undefined ? -4 : 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              onKeyDown={onListKeyDown}
            >
              {showSearch && (
                <div className="select-menu__search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    aria-controls={listId}
                    aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                    onChange={(event) => {
                      const next = event.target.value;
                      setQuery(next);
                      setActive(firstEnabled(next ? items.filter((item) => matches(item, next)) : items));
                    }}
                  />
                </div>
              )}

              <ul
                ref={listRef}
                id={listId}
                className="select-menu__list"
                role="listbox"
                // Without a search box, the list itself takes the keys.
                tabIndex={showSearch ? -1 : 0}
                autoFocus={!showSearch}
                aria-activedescendant={!showSearch && active >= 0 ? `${listId}-${active}` : undefined}
              >
                {shown.map((item, index) => {
                  const selected = item.value === current;
                  return (
                    <li
                      key={`${item.value}-${index}`}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={item.disabled || undefined}
                      className={[
                        "select-menu__option",
                        index === active && "select-menu__option--active",
                        selected && "select-menu__option--selected",
                        item.disabled && "select-menu__option--disabled",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseMove={() => !item.disabled && index !== active && setActive(index)}
                      onClick={() => choose(item)}
                    >
                      <span className="select-menu__text">
                        <span className="select-menu__label">{item.label}</span>
                        {item.description && <span className="select-menu__description">{item.description}</span>}
                      </span>
                      {selected && <Check size={16} className="select-menu__check" aria-hidden="true" />}
                    </li>
                  );
                })}

                {shown.length === 0 && <li className="select-menu__empty">No matches for “{query}”</li>}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

export default SearchableSelect;
