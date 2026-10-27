import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";
import { lastInputWasTouch } from "@/lib/inputModality";

const TooltipProvider = TooltipPrimitive.Provider;

/** Po dotyku dymek nie otwiera się z fokusu (powrót fokusu po zamknięciu menu zostawiał go na ekranie). */
function Tooltip({ open: openProp, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <TooltipPrimitive.Root
      {...props}
      open={openProp ?? open}
      onOpenChange={(next) => {
        if (next && lastInputWasTouch()) return;
        setOpen(next);
        onOpenChange?.(next);
      }}
    />
  );
}

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-modal overflow-hidden rounded-control border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-elevation-2 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
