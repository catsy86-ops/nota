import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Przycisk z samą ikoną: jeden rozmiar celu, jeden stan wciśnięcia (`.pressable`),
// jeden wygląd otwartego menu. Etykieta zawsze przez `aria-label`.
const iconButtonVariants = cva(
  "pressable relative inline-flex shrink-0 items-center justify-center rounded-lg ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      tone: {
        muted:
          "text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground",
        // Wewnątrz segmentu na tle `bg-muted/40` (ViewControls) — podniesienie zamiast przyciemnienia.
        segment:
          "text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-elevation-1 data-[state=open]:bg-background data-[state=open]:text-foreground data-[state=open]:shadow-elevation-1",
        active: "bg-primary/10 text-primary hover:bg-primary/15",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "text-destructive hover:bg-destructive/10",
      },
      size: {
        /** Gęste paski narzędzi (composer, zaznaczenie). */
        sm: "h-7 w-7 coarse:h-9 coarse:w-9",
        /** Nagłówek i kontrolki widoku. Na dotyku 36 px, nie 44: pięć przycisków
         *  musi zmieścić się w nagłówku 320 px (odstępy dokładają resztę celu). */
        md: "h-8 w-8 sm:h-9 sm:w-9 coarse:h-9 coarse:w-9",
      },
    },
    defaultVariants: {
      tone: "muted",
      size: "md",
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, tone, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(iconButtonVariants({ tone, size }), className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = "IconButton";

export { IconButton };
