import { CalendarPlus } from "lucide-react";
import { StatusPanel } from "@/components/StatusPanel";
import { addDaysToKey } from "@/lib/week";
import type { DayEntry } from "@/lib/shifts";

const primaryBtn = "pressable h-10 coarse:h-11 px-4 rounded-control bg-primary text-primary-foreground text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const secondaryBtn = "pressable h-10 coarse:h-11 px-4 rounded-card border border-border/60 hover:bg-muted text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/**
 * G2.2: pusty miesiąc i pusty tydzień mają ten sam pusty stan. Z wcześniejszymi dniami proponujemy
 * przedłużenie cyklu. Nic nie renderuje, gdy w widocznym okresie jest choć jeden wpis.
 */
export function EmptyShifts({ days, isWeek, weekStart, monthKey, onPattern, onTemplate, onCopyPreviousMonth }: {
  days: Record<string, DayEntry>;
  isWeek: boolean;
  weekStart: string;
  /** `YYYY-MM` pokazywanego miesiąca. */
  monthKey: string;
  onPattern: () => void;
  onTemplate: () => void;
  onCopyPreviousMonth: () => void;
}) {
  const empty = isWeek
    ? !Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).some((k) => days[k])
    : !Object.keys(days).some((k) => k.startsWith(monthKey));
  if (!empty) return null;
  const extend = !isWeek && Object.keys(days).some((k) => k < `${monthKey}-01`);
  return (
    // Ten sam pusty stan co w innych działach (`StatusPanel`, nowy plan 2.5): przerywana ramka, szkic kalendarza.
    <section aria-label={isWeek ? "Pusty tydzień" : "Pusty miesiąc"} className="mb-3">
      <StatusPanel size="inline" icon={CalendarPlus} className="p-4"
        title={isWeek ? "W tym tygodniu nie ma zmian." : "W tym miesiącu nie ma jeszcze zmian."}
        actions={
          <>
            <button type="button" onClick={onPattern} className={primaryBtn}>
              {extend ? "Przedłuż cykl" : "Nałóż cykl"}
            </button>
            <button type="button" onClick={onTemplate} className={secondaryBtn}>
              Szablon tygodnia
            </button>
            {!isWeek && (
              <button type="button" onClick={onCopyPreviousMonth} className={secondaryBtn}>
                Skopiuj poprzedni miesiąc
              </button>
            )}
          </>
        } />
    </section>
  );
}
