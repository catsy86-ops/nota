import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { StatusPanel } from "@/components/StatusPanel";
import { addDaysToKey } from "@/lib/week";
import type { DayEntry } from "@/lib/shifts";

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
            <Button type="button" onClick={onPattern} className="coarse:h-11">
              {extend ? "Przedłuż cykl" : "Nałóż cykl"}
            </Button>
            <Button type="button" onClick={onTemplate} variant="outline" className="coarse:h-11">
              Szablon tygodnia
            </Button>
            {!isWeek && (
              <Button type="button" onClick={onCopyPreviousMonth} variant="outline" className="coarse:h-11">
                Skopiuj poprzedni miesiąc
              </Button>
            )}
          </>
        } />
    </section>
  );
}
