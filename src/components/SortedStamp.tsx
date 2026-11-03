import { cn } from "@/lib/utils";

/**
 * Pieczątka „Posortowane” (plan Skrzynki 4.4): odbija się, gdy Skrzynka zejdzie do zera. Ruch to istniejące
 * `stamp-in` i `stamp-ring` (te same co pieczątka zmiany w Grafiku); przy ograniczonym ruchu globalna reguła
 * `html[data-motion="reduced"]` zostawia samo pojawienie się.
 */
export function SortedStamp({ className }: { className?: string }) {
  return (
    <p
      role="status"
      data-testid="sorted-stamp"
      style={{ ["--stamp" as string]: "var(--primary)" }}
      className={cn(
        "stamp-in relative inline-flex -rotate-3 items-center rounded-card border-[3px] border-double border-primary/80 px-4 py-1.5",
        "font-display text-sm font-bold uppercase tracking-[0.2em] text-primary-ink",
        className,
      )}
    >
      Posortowane
    </p>
  );
}
