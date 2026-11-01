import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { PlanPoint } from "@/lib/plans/model";
import { clampView, fitView, panBy, pinchView, screenToImage, zoomAt, type Viewport } from "@/lib/plans/viewport";

/** Ruch krótszy niż tyle pikseli ekranu to stuknięcie, nie przesunięcie. */
const TAP_SLOP = 8;
const KEY_PAN = 48;

export interface PlanCanvasHandle {
  fit(): void;
  zoomBy(factor: number): void;
  /** Aktualny widok (do testów i paneli, które przeliczają współrzędne). */
  view(): Viewport;
}

interface Props {
  /** Adres obrazu do wyświetlenia (kopia robocza albo oryginał); `null` = bajtów nie ma na urządzeniu. */
  url: string | null | undefined;
  /** Wymiary ORYGINAŁU — `viewBox` i wszystkie współrzędne nakładek są w jego pikselach. */
  width: number;
  height: number;
  /** Nakładki w układzie obrazu; dostają skalę, żeby linie i uchwyty miały stałą grubość na ekranie. */
  children?: (scale: number) => ReactNode;
  /** Stuknięcie w plan (bez przesunięcia) — punkt w pikselach oryginału. */
  onTap?: (p: PlanPoint) => void;
  /** Ruch kursora nad planem (podgląd rysowanej trasy) — punkt w pikselach oryginału; `null` = poza planem. */
  onHover?: (p: PlanPoint | null) => void;
  /**
   * Naciśnięcie na planie: `true` = to uchwyt (np. punkt trasy) — dalszy ruch idzie do `onPressMove`
   * zamiast przesuwać plan, a puszczenie do `onPressEnd`. `scale` pozwala liczyć promień trafienia na ekranie.
   */
  onPressStart?: (p: PlanPoint, scale: number) => boolean;
  onPressMove?: (p: PlanPoint) => void;
  onPressEnd?: () => void;
  /** Klawisz na płótnie przed obsługą widoku: `true` = obsłużony. `center` = środek okna w pikselach obrazu (celownik). */
  onKeyAction?: (key: string, center: PlanPoint) => boolean;
  /** Celownik w środku okna przy obsłudze z klawiatury (rysowanie, kalibracja). */
  crosshair?: boolean;
  label: string;
  cursor?: string;
  /** Bajty obrazu niezgodne z analizą (nie są dekodowane) — komunikat zamiast planu. */
  badImage?: boolean;
}

/**
 * Płótno planu: SVG z obrazem w układzie oryginału i transformacją widoku (`viewport.ts`). Jeden palec
 * albo mysz przesuwa, dwa palce przybliżają, kółko przybliża wokół kursora, klawiatura: strzałki,
 * `+`/`-`, `0` = dopasuj. Krótkie stuknięcie bez ruchu idzie do `onTap` (rysowanie, kalibracja).
 */
export const PlanCanvas = forwardRef<PlanCanvasHandle, Props>(function PlanCanvas({ url, width, height, children, onTap, onHover, onPressStart, onPressMove, onPressEnd, onKeyAction, crosshair, label, cursor, badImage }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<Viewport | null>(null);
  const viewRef = useRef<Viewport | null>(null);
  viewRef.current = view;
  const pointers = useRef(new Map<number, PlanPoint>());
  const gesture = useRef<{ start: PlanPoint; moved: boolean; pinched: boolean; handle: boolean } | null>(null);

  const local = (e: { clientX: number; clientY: number }): PlanPoint => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const apply = useCallback((v: Viewport) => setView(clampView(v, width, height, size.w, size.h)), [width, height, size.w, size.h]);
  const fit = useCallback(() => { if (size.w && size.h) setView(fitView(width, height, size.w, size.h)); }, [width, height, size.w, size.h]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Widok początkowy: cały plan w oknie. Nowy obraz albo pierwszy pomiar okna — dopasowanie od nowa.
  useEffect(() => { if (size.w && size.h && !viewRef.current) fit(); }, [size.w, size.h, fit]);
  useEffect(() => { setView(null); }, [width, height]);

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (factor: number) => { const v = viewRef.current; if (v) apply(zoomAt(v, factor, { x: size.w / 2, y: size.h / 2 })); },
    view: () => viewRef.current ?? { scale: 1, tx: 0, ty: 0 },
  }), [fit, apply, size.w, size.h]);

  // Kółko: natywny nasłuch bez `passive`, żeby przewijanie strony nie szło razem z przybliżaniem.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (!v) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      apply(zoomAt(v, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [apply]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const v = viewRef.current;
    if (pointers.current.size === 1) {
      const handle = !!(v && onPressStart?.(screenToImage(v, p), v.scale));
      gesture.current = { start: p, moved: false, pinched: false, handle };
    } else if (gesture.current) {
      // Drugi palec w trakcie przeciągania uchwytu: kończymy uchwyt, dalej szczypanie.
      if (gesture.current.handle) { gesture.current.handle = false; onPressEnd?.(); }
      gesture.current.pinched = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    const v = viewRef.current;
    if (v && onHover && pointers.current.size === 0) onHover(screenToImage(v, p));
    const prev = pointers.current.get(e.pointerId);
    if (!prev || !v) return;
    if (pointers.current.size >= 2) {
      const ids = [...pointers.current.keys()].slice(0, 2);
      const before = ids.map((id) => pointers.current.get(id)!) as [PlanPoint, PlanPoint];
      pointers.current.set(e.pointerId, p);
      const after = ids.map((id) => pointers.current.get(id)!) as [PlanPoint, PlanPoint];
      apply(pinchView(v, before, after));
      return;
    }
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g?.handle) { g.moved = true; onPressMove?.(screenToImage(v, p)); return; }
    if (g && !g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) < TAP_SLOP) return;
    if (g && !g.moved) { g.moved = true; apply(panBy(v, p.x - g.start.x, p.y - g.start.y)); return; }
    apply(panBy(v, p.x - prev.x, p.y - prev.y));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const had = pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 0) {
      gesture.current = null;
      if (g?.handle) { onPressEnd?.(); if (g.moved) return; }
      const v = viewRef.current;
      if (had && g && !g.moved && !g.pinched && v && onTap && e.type === "pointerup") onTap(screenToImage(v, local(e)));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = viewRef.current;
    if (!v) return;
    const center = { x: size.w / 2, y: size.h / 2 };
    if (onKeyAction?.(e.key, screenToImage(v, center))) { e.preventDefault(); return; }
    const step: Record<string, () => Viewport> = {
      ArrowLeft: () => panBy(v, KEY_PAN, 0), ArrowRight: () => panBy(v, -KEY_PAN, 0),
      ArrowUp: () => panBy(v, 0, KEY_PAN), ArrowDown: () => panBy(v, 0, -KEY_PAN),
      "+": () => zoomAt(v, 1.25, center), "=": () => zoomAt(v, 1.25, center), "-": () => zoomAt(v, 0.8, center),
    };
    if (e.key === "0") { e.preventDefault(); fit(); return; }
    const f = step[e.key];
    if (f) { e.preventDefault(); apply(f()); }
  };

  return (
    <div
      ref={box}
      role="application"
      aria-label={label}
      aria-roledescription="plan"
      tabIndex={0}
      data-testid="plan-canvas"
      data-scale={view ? view.scale.toFixed(4) : undefined}
      data-tx={view ? view.tx.toFixed(2) : undefined}
      data-ty={view ? view.ty.toFixed(2) : undefined}
      className="plan-canvas relative h-full w-full touch-none select-none overflow-hidden bg-[#f4f5f7] outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring dark:bg-[#1b1d22]"
      style={{ cursor: cursor ?? "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => { if (pointers.current.size === 0) onHover?.(null); }}
      onKeyDown={onKeyDown}
    >
      {view && (
        <svg width={size.w} height={size.h} className="absolute inset-0" aria-hidden>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {/* Plan zawsze na białej kartce — zrzuty z DWG FastView mają ciemne linie na jasnym tle. */}
            <rect width={width} height={height} fill="#ffffff" />
            {url && <image href={url} width={width} height={height} preserveAspectRatio="none" style={{ imageRendering: view.scale > 2 ? "pixelated" : "auto" }} />}
            {children?.(view.scale)}
          </g>
        </svg>
      )}
      {crosshair && (
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 hidden h-7 w-7 -translate-x-1/2 -translate-y-1/2 [.plan-canvas:focus-visible_&]:block">
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-foreground/70" />
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-foreground/70" />
        </span>
      )}
      {badImage && (
        <p role="alert" className="absolute inset-x-4 top-4 rounded-card bg-card/95 p-3 text-sm text-destructive-ink shadow">
          Obraz planu na tym urządzeniu jest uszkodzony albo niezgodny z analizą — nie został otwarty. Trasy i opisy zostają.
        </p>
      )}
      {url === null && !badImage && (
        <p className="absolute inset-x-4 top-4 rounded-card bg-card/95 p-3 text-sm text-muted-foreground shadow">
          Obraz planu jeszcze nie dotarł na to urządzenie. Otwórz analizę na urządzeniu, na którym ją utworzono, albo poczekaj na synchronizację.
        </p>
      )}
    </div>
  );
});
