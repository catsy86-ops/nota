import { cn } from "@/lib/utils";
import { REVIEW_DAY_NAMES, setReviewDay, useReviewDay } from "@/lib/weeklyReview";
import { Section } from "./SettingsShared";

// Poniedziałek na początku listy, jak w kalendarzu; wartość to `Date#getDay`.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Ustawienia → Ogólne: dzień przeglądu tygodnia albo wyłączenie karty w „Dziś”. */
export function ReviewSettings() {
  const day = useReviewDay();
  const chip = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-full border text-sm transition-colors",
      active ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border/60 hover:bg-muted/60",
    );
  return (
    <Section title="Przegląd tygodnia">
      <p className="text-xs text-muted-foreground">
        Karta w widoku „Dziś” z rzeczami do ogarnięcia. Pokazuje się wieczorem w wybranym dniu i rano następnego, o ile jest co przejrzeć.
      </p>
      <div role="group" aria-label="Dzień przeglądu tygodnia" className="flex flex-wrap gap-2">
        {DAY_ORDER.map((d) => (
          <button key={d} type="button" aria-pressed={day === d} onClick={() => setReviewDay(d)} className={chip(day === d)}>
            {REVIEW_DAY_NAMES[d]}
          </button>
        ))}
        <button type="button" aria-pressed={day === null} onClick={() => setReviewDay(null)} className={chip(day === null)}>
          Wyłączony
        </button>
      </div>
    </Section>
  );
}
