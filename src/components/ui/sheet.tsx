import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { OverlayBack } from "@/components/ui/overlay-back";

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
      "fixed inset-0 z-50 bg-foreground/30 dark:bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-base data-[state=closed]:duration-fast",
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

/** Przeciąganie arkusza w dół za uchwyt: podąża za palcem, a po progu zamyka. */
function useDragToDismiss(contentRef: React.RefObject<HTMLDivElement | null>, close: () => void) {
  const start = React.useRef<{ y: number; t: number } | null>(null);
  const dy = React.useRef(0);
  const reset = (el: HTMLElement) => {
    el.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "";
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      start.current = { y: e.clientY, t: performance.now() };
      dy.current = 0;
      e.currentTarget.setPointerCapture(e.pointerId);
      if (contentRef.current) contentRef.current.style.transition = "none";
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = start.current;
      const el = contentRef.current;
      if (!s || !el) return;
      dy.current = Math.max(0, e.clientY - s.y);
      el.style.transform = `translateY(${dy.current}px)`;
    },
    onPointerUp: () => {
      const s = start.current;
      const el = contentRef.current;
      start.current = null;
      if (!s || !el) return;
      const velocity = dy.current / Math.max(1, performance.now() - s.t); // px/ms
      if (dy.current > 110 || (dy.current > 30 && velocity > 0.6)) {
        el.style.transform = "";
        close();
      } else reset(el);
    },
    onPointerCancel: () => {
      start.current = null;
      if (contentRef.current) reset(contentRef.current);
    },
  };
}

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-out-soft data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-fast data-[state=open]:duration-base",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl border-t pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
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
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = "right", className, children, onInteractOutside, ...props }, ref) => {
    const closeRef = React.useRef<HTMLButtonElement>(null);
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const setRefs = React.useCallback((el: HTMLDivElement | null) => {
      contentRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    }, [ref]);
    const drag = useDragToDismiss(contentRef, () => closeRef.current?.click());
    return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        ref={setRefs}
        className={cn(sheetVariants({ side }), className)}
        onInteractOutside={(e) => {
          if (fromToast(e)) e.preventDefault();
          onInteractOutside?.(e);
        }}
        {...props}
      >
        {side === "bottom" && (
          // Uchwyt naprawdę działa: przeciągnięcie w dół zamyka arkusz (próg odległości albo szybki ruch).
          <div
            aria-hidden
            data-sheet-handle
            className="absolute left-1/2 top-0 z-10 flex h-7 w-32 -translate-x-1/2 cursor-grab touch-none justify-center pt-2 active:cursor-grabbing"
            {...drag}
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          </div>
        )}
        {children}
        <OverlayBack closeRef={closeRef} />
        <SheetPrimitive.Close ref={closeRef} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground ring-offset-background transition-colors duration-fast hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none coarse:h-11 coarse:w-11 coarse:right-2 coarse:top-2">
          <X className="h-4 w-4" />
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
