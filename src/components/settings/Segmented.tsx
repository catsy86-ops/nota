import { useId } from "react";
import { LayoutGroup, m as motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { spring } from "@/lib/motion";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  /** Nazwa grupy dla czytnika ekranu. */
  label: string;
}

/**
 * Przełącznik kilku opcji z jedną podświetloną (`ToggleGroup`: strzałki, jeden Tab): tło aktywnej pozycji przesuwa się
 * sprężyną (`layoutId`) zamiast przeskakiwać. Ruch transformacją — bez przeliczania
 * układu; przy ograniczonym ruchu MotionConfig (App.tsx) wyłącza animację.
 */
export function Segmented<T extends string>({ options, value, onChange, disabled, label }: SegmentedProps<T>) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <ToggleGroup
        variant="plain"
        aria-label={label}
        value={value}
        onValueChange={(v) => onChange(v as T)}
        disabled={disabled}
        className={cn("grid gap-1 rounded-xl border border-border/60 bg-muted/40 p-1", disabled && "opacity-60")}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map(({ value: v, label: l, Icon }) => (
          <ToggleGroupItem
            key={v}
            value={v}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-semibold",
              "text-muted-foreground hover:text-foreground data-[state=on]:text-primary-ink disabled:opacity-100",
            )}
          >
            {v === value && (
              <motion.span
                layoutId="segmented-active"
                transition={spring.snap}
                className="absolute inset-0 rounded-lg border border-primary/50 bg-card shadow-sm"
                aria-hidden
              />
            )}
            <Icon className="relative w-4 h-4" aria-hidden />
            <span className="relative">{l}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </LayoutGroup>
  );
}
