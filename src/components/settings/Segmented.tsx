import { useId } from "react";
import { LayoutGroup, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { spring } from "@/lib/motion";
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
 * Przełącznik kilku opcji z jedną podświetloną: tło aktywnej pozycji przesuwa się
 * sprężyną (`layoutId`) zamiast przeskakiwać. Ruch transformacją — bez przeliczania
 * układu; przy ograniczonym ruchu MotionConfig (App.tsx) wyłącza animację.
 */
export function Segmented<T extends string>({ options, value, onChange, disabled, label }: SegmentedProps<T>) {
  const group = useId();
  return (
    <LayoutGroup id={group}>
      <div role="group" aria-label={label} className={cn("grid gap-1 rounded-xl border border-border/60 bg-muted/40 p-1", disabled && "opacity-60")}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(({ value: v, label: l, Icon }) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(v)}
              className={cn(
                "pressable relative flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 text-xs font-semibold outline-hidden",
                "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                active ? "text-primary-ink" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="segmented-active"
                  transition={spring.snap}
                  className="absolute inset-0 rounded-lg border border-primary/50 bg-card shadow-sm"
                  aria-hidden
                />
              )}
              <Icon className="relative w-4 h-4" aria-hidden />
              <span className="relative">{l}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
