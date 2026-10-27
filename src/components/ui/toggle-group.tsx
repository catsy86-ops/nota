import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Grupa „jedna z kilku” (shadcn Toggle Group na Radix, tryb `single`).
 * Radix daje `radiogroup`/`radio` z `aria-checked`, jeden przystanek Tab
 * i strzałki między pozycjami (w kółko); Spacja/Enter wybiera.
 * Kliknięcie wybranej pozycji jej nie odznacza — zawsze coś jest wybrane.
 */
const toggleGroupVariants = cva("", {
  variants: {
    variant: {
      /** Tor z wypukłą wybraną pozycją (przełącznik segmentowy). */
      segment: "grid auto-cols-fr grid-flow-col gap-1 rounded-card bg-muted/60 p-1",
      /** Bez wyglądu — układ i kafle robi wywołujący. */
      plain: "",
    },
  },
  defaultVariants: { variant: "segment" },
});

const toggleItemVariants = cva(
  "pressable outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        segment:
          "h-9 coarse:h-11 rounded-field px-2 text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground data-[state=on]:bg-card data-[state=on]:font-semibold data-[state=on]:text-primary-ink data-[state=on]:shadow-elevation-1",
        plain: "",
      },
    },
    defaultVariants: { variant: "segment" },
  },
);

type Variant = VariantProps<typeof toggleGroupVariants>["variant"];
const VariantContext = React.createContext<Variant>("segment");

type ToggleGroupProps = Omit<
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
  "type" | "value" | "defaultValue" | "onValueChange"
> &
  VariantProps<typeof toggleGroupVariants> & {
    value: string;
    onValueChange: (value: string) => void;
  };

const ToggleGroup = React.forwardRef<React.ElementRef<typeof ToggleGroupPrimitive.Root>, ToggleGroupProps>(
  ({ className, variant, value, onValueChange, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
      ref={ref}
      type="single"
      value={value}
      // Radix oddaje "" przy kliknięciu wybranej pozycji — ignorujemy (zawsze jedna wybrana).
      onValueChange={(v) => { if (v) onValueChange(v); }}
      className={cn(toggleGroupVariants({ variant }), className)}
      {...props}
    >
      <VariantContext.Provider value={variant ?? "segment"}>{children}</VariantContext.Provider>
    </ToggleGroupPrimitive.Root>
  ),
);
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantContext);
  return <ToggleGroupPrimitive.Item ref={ref} className={cn(toggleItemVariants({ variant }), className)} {...props} />;
});
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
