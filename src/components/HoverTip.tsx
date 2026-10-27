import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Opóźnienie po najechaniu myszą — jak domyślne w Radix Tooltip. */
const HOVER_DELAY_MS = 700;
const GAP = 6;
const EDGE = 8;

interface Tip {
  text: string;
  /** Skrót z tabeli `lib/shortcuts.ts` (`data-tip-keys`), pokazany jako <kbd>. */
  keys?: string;
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
  const timer = useRef<number | undefined>(undefined);
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
      setTip({ text, keys: el.dataset.tipKeys, rect: el.getBoundingClientRect() });
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
      // Po dotyku fokus wraca na przycisk (zamknięte okno/menu) — dymek wisiałby bez końca.
      if (!el || touched || !el.matches(":focus-visible")) return;
      hide();
      current.current = el;
      show(el);
    };
    // Ostatnie źródło wejścia: dotyk/rysik wyłącza dymek przy fokusie, klawisz go przywraca.
    let touched = false;
    const onPointerDown = (e: PointerEvent) => { touched = e.pointerType !== "mouse"; hide(); };
    const onKey = (e: KeyboardEvent) => {
      touched = false;
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return () => {
      hide();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", onPointerDown, true);
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
      className="fixed z-modal pointer-events-none rounded-control border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-elevation-2 animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
    >
      {tip.text}
      {tip.keys && <kbd className="ml-2 rounded-field border border-border/60 px-1 font-mono text-2xs text-muted-foreground">{tip.keys}</kbd>}
    </div>,
    document.body,
  );
}
