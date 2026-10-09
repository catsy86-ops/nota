import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Opóźnienie po najechaniu myszą — jak domyślne w Radix Tooltip. */
const HOVER_DELAY_MS = 700;
const GAP = 6;
const EDGE = 8;

interface Tip {
  text: string;
  rect: DOMRect;
}

/**
 * Jedna podpowiedź na całą aplikację dla elementów z `data-tip`.
 * Karta notatki ma do dziesięciu przycisków akcji; osobny Radix `Tooltip`
 * przy każdym to ~1500 instancji na 150 notatkach — tutaj zostaje jeden
 * nasłuch zdarzeń na dokumencie. Treść jest tylko wizualna (`aria-hidden`):
 * przyciski mają tę samą nazwę w `aria-label`.
 */
export function HoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number>();
  const current = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const show = (el: HTMLElement) => {
      const text = el.dataset.tip;
      if (!text || !el.isConnected) return;
      setTip({ text, rect: el.getBoundingClientRect() });
    };
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null);

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = target(e);
      if (el === current.current) return;
      hide();
      if (!el) return;
      current.current = el;
      timer.current = window.setTimeout(() => show(el), HOVER_DELAY_MS);
    };
    const onFocus = (e: FocusEvent) => {
      const el = target(e);
      if (!el || !el.matches(":focus-visible")) return;
      hide();
      current.current = el;
      show(el);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, { capture: true });
    };
  }, []);

  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!tip || !ref.current) { setPos(null); return; }
    const { width, height } = ref.current.getBoundingClientRect();
    const below = tip.rect.bottom + GAP + height <= window.innerHeight - EDGE;
    const left = Math.min(Math.max(EDGE, tip.rect.left + tip.rect.width / 2 - width / 2), window.innerWidth - width - EDGE);
    setPos({ left, top: below ? tip.rect.bottom + GAP : tip.rect.top - GAP - height });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={ref}
      aria-hidden
      className="fixed z-50 pointer-events-none rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}
