import { cn } from "@/lib/utils";

/*
  Jedno odhaczenie (nowy plan 4.2): ten sam rysowany ptaszek na liście zadań
  (ChecklistEditor) i przy „Gotowe” w Terminach, Dziś i Kalendarzu
  (ReminderQuickActions). Zwinięcie wiersza: `collapseRow` w src/lib/collapseRow.ts.
*/

/**
 * Wspólny wygląd pola wyboru listy: pusty kwadrat albo wypełniony z ptaszkiem.
 * Ptaszek jest rysowany (stroke-dashoffset, klasy `check-tick` w src/styles/motion.css):
 * przy przełączeniu w miejscu gra przejście CSS, a `drawIn` — gdy wiersz
 * dopiero się zamontował po odhaczeniu (edytor przenosi go do „ukończonych”).
 * Bez animacji przy zwykłym montażu, więc 150 kafli nie rysuje ptaszków naraz.
 */
export function CheckMark({ checked, size = "md", drawIn }: { checked: boolean; size?: "sm" | "md"; drawIn?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "rounded flex items-center justify-center shrink-0 border-[1.5px] transition-colors duration-fast",
        size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 group-hover/check:border-primary",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        className={cn(size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5", "check-tick", drawIn && "check-tick-in")} data-on={checked}>
        {/* Od krótkiego ramienia — ptaszek „pisany” jak długopisem. */}
        <path d="M4 12l5 5L20 6" pathLength={1} />
      </svg>
    </span>
  );
}

/** Tekst pozycji z przekreśleniem, które przesuwa się przez tekst przy odhaczeniu. */
export function StrikeText({ checked, drawIn, children }: { checked: boolean; drawIn?: boolean; children: React.ReactNode }) {
  // Wewnętrzny inline span: każda linia zawiniętego tekstu dostaje własną kreskę.
  return <span className={cn("check-strike", drawIn && "check-strike-in")} data-on={checked}>{children}</span>;
}
