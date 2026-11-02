import { CalendarClock } from "lucide-react";
import { format, formatDistanceStrict } from "date-fns";
import { pl } from "date-fns/locale";
import { localDayKey } from "@/lib/dayDone";
import { useShifts, useShiftsReady } from "@/lib/shifts";
import { dayType } from "@/lib/shifts/model";
import { useShiftNow } from "@/lib/shifts/useShiftNow";

/**
 * Widżet 4.5: jedna linia dzisiejszej zmiany z Grafiku — „R 6–14 · za 2 h 10 min”. Ładowana leniwie z
 * `WidgetPanel`, żeby dane Grafiku nie trafiały do paczki startowej. Bez zmiany w grafiku nic nie pokazuje
 * poza „Dziś nie ma zmiany”.
 */
export default function WidgetShiftLine() {
  const ready = useShiftsReady();
  const data = useShifts();
  const { now, current, next } = useShiftNow(data);
  if (!ready) return null;
  const entry = data.days[localDayKey(new Date())];
  const type = entry ? data.types.find((t) => t.id === entry.type) : undefined;
  let shift = "Dziś nie ma zmiany";
  if (entry && type) {
    const t = dayType(type, entry);
    shift = t.kind === "absence" ? t.name : `${t.name} ${t.start}–${t.end}`;
  } else if (entry) {
    shift = "Zaplanowana zmiana";
  }
  const timing = current ? `trwa, do ${format(current.end, "HH:mm")}`
    : next ? `za ${formatDistanceStrict(next.start, now, { locale: pl })}`
    : null;
  return (
    <p className="flex items-center gap-2 text-sm" data-testid="widget-shift">
      <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate">
        {shift}{timing && <span className="text-muted-foreground"> · {timing}</span>}
      </span>
    </p>
  );
}
