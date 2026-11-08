import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Tip {
  target: HTMLElement;
  text: string;
  // Where the pointer was; null when the tooltip came from keyboard focus.
  pointer: { x: number; y: number } | null;
}

const OPEN_DELAY = 450;
// Moving straight from one tooltip to the next shows it at once.
const WARM_WINDOW = 400;
const CLOSE_MS = 100;
// Just below and to the right of the pointer, clear of the cursor itself.
const OFFSET_X = 12;
const OFFSET_Y = 20;
const EDGE = 8;

function tipTarget(node: EventTarget | null): HTMLElement | null {
  return node instanceof Element ? node.closest<HTMLElement>("[data-tooltip]") : null;
}

// Places the tooltip at the pointer (or under the element), flipped left
// or up when it would run off the window.
function place(node: HTMLElement | null, target: HTMLElement, pointer: { x: number; y: number } | null) {
  if (!node) return;

  const { width, height } = node.getBoundingClientRect();
  let x: number;
  let y: number;

  if (pointer) {
    x = pointer.x + OFFSET_X;
    y = pointer.y + OFFSET_Y;
    if (x + width > window.innerWidth - EDGE) x = pointer.x - width - OFFSET_X / 2;
    if (y + height > window.innerHeight - EDGE) y = pointer.y - height - OFFSET_X;
  } else {
    const anchor = target.getBoundingClientRect();
    x = anchor.left + anchor.width / 2 - width / 2;
    y = anchor.bottom + 8;
    if (y + height > window.innerHeight - EDGE) y = anchor.top - height - 8;
  }

  x = Math.min(Math.max(x, EDGE), window.innerWidth - width - EDGE);
  node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

// The app's one tooltip: a short, one-line label that sits beside the mouse
// pointer for any element with data-tooltip="…", and follows it while it
// moves over that element. From the keyboard it sits just under the focused
// element. Mounted once at the root, so nothing needs wrapping. Touch
// screens never see it, since there's no hover there.
function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [open, setOpen] = useState(false);

  const tipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const openTimer = useRef(0);
  const closeTimer = useRef(0);
  const lastClosed = useRef(0);

  useEffect(() => {
    function show(target: HTMLElement, fromPointer: boolean) {
      const text = target.dataset.tooltip ?? "";
      if (!text) return;

      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);

      const warm = Date.now() - lastClosed.current < WARM_WINDOW;
      openTimer.current = window.setTimeout(
        () => {
          setTip({ target, text, pointer: fromPointer ? { ...pointerRef.current } : null });
          setOpen(true);
        },
        warm ? 0 : OPEN_DELAY,
      );
    }

    function hide() {
      window.clearTimeout(openTimer.current);
      setOpen((wasOpen) => {
        if (wasOpen) lastClosed.current = Date.now();
        return false;
      });
      closeTimer.current = window.setTimeout(() => setTip(null), CLOSE_MS);
    }

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const target = tipTarget(event.target);
      if (target && !target.contains(event.relatedTarget as Node | null)) show(target, true);
    }

    function onPointerOut(event: PointerEvent) {
      const target = tipTarget(event.target);
      if (target && !target.contains(event.relatedTarget as Node | null)) hide();
    }

    // Follows the pointer, straight on the element's style (no re-render).
    function onPointerMove(event: PointerEvent) {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const target = tipTarget(event.target);
      if (target) place(tipRef.current, target, pointerRef.current);
    }

    function onFocusIn(event: FocusEvent) {
      const target = tipTarget(event.target);
      if (target && target.matches(":focus-visible")) show(target, false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", hide, true);

    return () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  useLayoutEffect(() => {
    if (tip) place(tipRef.current, tip.target, tip.pointer);
  }, [tip]);

  // Screen readers hear the tooltip as the element's description.
  useEffect(() => {
    if (!tip || !open) return;
    const { target } = tip;
    const before = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", "app-tooltip");
    return () => {
      if (before) target.setAttribute("aria-describedby", before);
      else target.removeAttribute("aria-describedby");
    };
  }, [tip, open]);

  if (!tip) return null;

  return createPortal(
    <div ref={tipRef} id="app-tooltip" role="tooltip" className="app-tooltip" data-state={open ? "open" : "closed"}>
      <span className="app-tooltip__text">{tip.text}</span>
    </div>,
    document.body,
  );
}

export default TooltipLayer;
