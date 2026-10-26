import { REPEAT_KIND_LABELS, WEEKDAY_ORDER, WEEKDAY_SHORT, changeRepeatKind, clampEvery, toggleWeekday, weekdaysOf, type RepeatKind, type RepeatRule } from "@/lib/reminderRepeat";
import { cn } from "@/lib/utils";

/** Rodzaje w liście wyboru powtarzania (stare cztery i nowe z 3.1). */
const REPEAT_KIND_OPTIONS: RepeatKind[] = ["none", "daily", "weekly", "monthly", "workdays", "biweekly", "yearly", "weekdays", "every"];

/** Lista rodzajów. Zmiana zachowuje wybrane dni i liczbę dni, a dzień terminu wypełnia pusty wybór. */
export function RepeatRuleSelect({ id, value, onChange, date, ariaLabel, className }: {
  id: string;
  value: RepeatRule;
  onChange: (rule: RepeatRule) => void;
  date?: Date;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value.kind}
      onChange={(e) => onChange(changeRepeatKind(e.target.value as RepeatKind, value, date))}
      aria-label={ariaLabel}
      className={className}
    >
      {REPEAT_KIND_OPTIONS.map((r) => (
        <option key={r} value={r}>{REPEAT_KIND_LABELS[r]}</option>
      ))}
    </select>
  );
}

/** Dodatkowe pola rodzaju: dni tygodnia dla „wybrane dni”, liczba dni dla „co N dni”. */
export function RepeatRuleExtras({ id, value, onChange }: { id: string; value: RepeatRule; onChange: (rule: RepeatRule) => void }) {
  return (
    <>
      {value.kind === "weekdays" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Dni tygodnia">
          {WEEKDAY_ORDER.map((d) => {
            const on = weekdaysOf(value).includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ kind: "weekdays", days: toggleWeekday(weekdaysOf(value), d) })}
                className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-primary bg-primary/15 text-primary-ink" : "border-border text-muted-foreground")}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            );
          })}
        </div>
      )}
      {value.kind === "every" && (
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-every`} className="text-xs text-muted-foreground">Co ile dni:</label>
          <input
            id={`${id}-every`}
            type="number"
            min={1}
            max={366}
            value={value.every ?? 2}
            onChange={(e) => onChange({ kind: "every", every: clampEvery(e.target.value) })}
            className="w-20 text-xs bg-muted/60 border border-border rounded-control px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground"
          />
        </div>
      )}
    </>
  );
}
