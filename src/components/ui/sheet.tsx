import { BottomSheetMarker } from "@/lib/bottomSheets";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { OVERLAY_FADE } from "./overlay-motion";
import { cn } from "@/lib/utils";
import { OverlayBack } from "@/components/ui/overlay-back";
import { SNAP_MAX_HEIGHT, snapDecision, type SheetSnap } from "@/components/ui/sheet-snap";
import { isMotionReduced } from "@/lib/motionPref";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-modal bg-foreground/30 dark:bg-black/60", OVERLAY_FADE,
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

/** Punkty zatrzymania (3.10): stan trzyma `SheetContent`, tu tylko odczyt i zapis po puszczeniu palca. */
interface SnapControl {
  get: () => SheetSnap;
  set: (snap: SheetSnap) => void;
}

/**
 * Przeciąganie arkusza za uchwyt: podąża za palcem w dół, a po progu zamyka.
 * Z punktami zatrzymania (`snap`) przeciągnięcie w górę zmienia wysokość zamiast przesuwać arkusz.
 */
function useDragToDismiss(contentRef: React.RefObject<HTMLDivElement | null>, overlayRef: React.RefObject<HTMLDivElement | null>, close: () => void, snap?: SnapControl) {
  const start = React.useRef<{ y: number; t: number } | null>(null);
  const dy = React.useRef(0);
  const rawDy = React.useRef(0);
  /** Ostatnie położenia palca — prędkość z końcówki ruchu, nie średnia od dotknięcia. */
  const trail = React.useRef<{ y: number; t: number }[]>([]);
  const reset = (el: HTMLElement) => {
    el.style.transition = snap
      ? "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), max-height 200ms cubic-bezier(0.22, 1, 0.36, 1)"
      : "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "";
    const ov = overlayRef.current;
    if (ov) { ov.style.transition = "opacity 200ms cubic-bezier(0.22, 1, 0.36, 1)"; ov.style.opacity = ""; }
  };
  /**
   * M4.3: odjazd z prędkością palca od miejsca puszczenia. Czas = reszta drogi / prędkość (120–300 ms), krzywa
   * zaczyna mniej więcej z tą prędkością i hamuje. `data-drag-closed` wyłącza animację zamknięcia Radix
   * (zaczęłaby od zera — arkusz podskakiwał przed wyjazdem), więc po odjeździe zamknięcie jest natychmiastowe.
   */
  const fling = (el: HTMLElement, velocity: number) => {
    const ov = overlayRef.current;
    if (isMotionReduced()) { el.style.transform = ""; close(); return; }
    const remaining = Math.max(0, el.offsetHeight - dy.current);
    const v = Math.max(velocity, 1); // px/ms — wolne puszczenie po progu i tak odjeżdża żwawo
    const ms = Math.round(Math.min(300, Math.max(120, remaining / v)));
    const curve = "cubic-bezier(0.25, 0.8, 0.4, 1)";
    el.style.transition = `transform ${ms}ms ${curve}`;
    el.style.transform = "translateY(100%)";
    if (ov) { ov.style.transition = `opacity ${ms}ms ${curve}`; ov.style.opacity = "0"; }
    el.dataset.dragClosed = "";
    if (ov) ov.dataset.dragClosed = "";
    window.setTimeout(() => {
      close();
      // Arkusz trzymany w drzewie po zamknięciu (forceMount) nie może zostać wysunięty przy następnym otwarciu.
      requestAnimationFrame(() => {
        for (const n of [el, ov]) {
          if (!n) continue;
          n.style.transition = "";
          delete n.dataset.dragClosed;
        }
        el.style.transform = "";
        if (ov) ov.style.opacity = "";
      });
    }, ms);
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      start.current = { y: e.clientY, t: performance.now() };
      dy.current = 0;
      rawDy.current = 0;
      trail.current = [{ y: e.clientY, t: performance.now() }];
      e.currentTarget.setPointerCapture(e.pointerId);
      if (contentRef.current) contentRef.current.style.transition = "none";
      if (overlayRef.current) overlayRef.current.style.transition = "none";
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      const el = contentRef.current;
      if (!s || !el) return;
      rawDy.current = e.clientY - s.y;
      dy.current = Math.max(0, rawDy.current);
      el.style.transform = `translateY(${dy.current}px)`;
      const now = performance.now();
      trail.current.push({ y: e.clientY, t: now });
      while (trail.current.length > 2 && now - trail.current[0].t > 80) trail.current.shift();
      // Tło przygasa razem z drogą arkusza (przy punktach „pół/pełny” ruch w górę go nie rozjaśnia).
      const ov = overlayRef.current;
      if (ov) ov.style.opacity = String(1 - Math.min(1, dy.current / Math.max(1, el.offsetHeight)));
    },
    onPointerUp: () => {
      const s = start.current;
      const el = contentRef.current;
      start.current = null;
      if (!s || !el) return;
      const velocity = rawDy.current / Math.max(1, performance.now() - s.t); // px/ms, ze znakiem
      const first = trail.current[0];
      const last = trail.current[trail.current.length - 1];
      const flick = first && last && last.t > first.t ? (last.y - first.y) / (last.t - first.t) : velocity;
      if (snap) {
        const next = snapDecision({ snap: snap.get(), dy: rawDy.current, velocity });
        if (next === "close") {
          fling(el, flick);
          return;
        }
        snap.set(next);
        reset(el);
        return;
      }
      if (dy.current > 110 || (dy.current > 30 && velocity > 0.6)) fling(el, flick);
      else reset(el);
    },
    onPointerCancel: () => {
      start.current = null;
      if (contentRef.current) reset(contentRef.current);
    },
  };
}

const sheetVariants = cva(
  "fixed z-modal gap-4 bg-background p-6 shadow-elevation-3 transition ease-out-soft data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-fast data-[state=open]:duration-base",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 max-h-sheet overflow-y-auto rounded-t-[var(--overlay-radius,var(--r-card))] border-t pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

/** Klik w dymek (Cofnij, przypomnienie) nie jest „poza arkuszem” — nie zamyka go (jak w `dialog.tsx`). */
const fromToast = (e: Event) => !!(e.target as Element | null)?.closest?.("[data-sonner-toaster]");

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** Dolny arkusz z punktami „pół” i „pełny” (3.10): startuje na „pół”, przeciągnięcie w górę otwiera „pełny”. */
  snap?: boolean;
}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, onInteractOutside, snap = false, style, ...props }, ref) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback((el: HTMLDivElement | null) => {
      contentRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    }, [ref]);
    const useSnap = snap && side === "bottom";
    const [snapState, setSnapState] = React.useState<SheetSnap>("half");
    const snapRef = React.useRef<SheetSnap>("half");
    const snapControl = React.useMemo<SnapControl | undefined>(
      () => (useSnap ? { get: () => snapRef.current, set: (s) => { snapRef.current = s; setSnapState(s); } } : undefined),
      [useSnap],
    );
    const overlayRef = React.useRef<HTMLDivElement | null>(null);
    const drag = useDragToDismiss(contentRef, overlayRef, () => closeRef.current?.click(), snapControl);
    return (
    <SheetPortal>
      <SheetOverlay ref={overlayRef} />
      <SheetPrimitive.Content
        ref={setRefs}
        className={cn(sheetVariants({ side }), className)}
        onInteractOutside={(e) => {
          if (fromToast(e)) e.preventDefault();
          onInteractOutside?.(e);
        }}
        {...props}
        style={useSnap ? { ...style, maxHeight: SNAP_MAX_HEIGHT[snapState] } : style}
      >
        {side === "bottom" && <BottomSheetMarker />}
        {side === "bottom" && (
          // Uchwyt naprawdę działa: przeciągnięcie w dół zamyka arkusz (próg odległości albo szybki ruch).
          <div
            aria-hidden
            data-sheet-handle
            className="absolute left-1/2 top-0 z-raised flex h-7 w-32 -translate-x-1/2 cursor-grab touch-none justify-center pt-2 active:cursor-grabbing"
            {...drag}
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          </div>
        )}
        {children}
        <OverlayBack closeRef={closeRef} />
        <SheetPrimitive.Close ref={closeRef} className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-control text-muted-foreground ring-offset-background transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none coarse:h-11 coarse:w-11 coarse:right-2 coarse:top-2 coarse:after:absolute coarse:after:-inset-2 coarse:after:content-['']">
          <X className="size-4" />
          <span className="sr-only">Zamknij</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
