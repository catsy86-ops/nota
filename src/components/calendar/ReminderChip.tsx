import { Repeat } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { REMINDER_REPEAT_LABELS } from "@/lib/reminderRepeat";
import type { Occurrence } from "@/lib/reminderOccurrences";
import { cn } from "@/lib/utils";

/**
 * Pojedynczy termin w kalendarzu.
 *
 * Wystąpienie serii, które **nie** jest najbliższe, rysuje się przerywanym
 * obramowaniem i bez wypełnienia: to prognoza, a nie zapisany termin. Model
 * trzyma jeden timestamp na notatkę, więc tylko `isNext` da się edytować,
 * przeciągnąć i usunąć — reszta jest rysunkiem i UI nie może obiecywać inaczej.
 */

function occurrenceLabel(occ: Occurrence, title: string): string {
  const when = format(new Date(occ.at), "d MMMM, HH:mm", { locale: pl });
  const name = title.trim() || "Bez tytułu";
  const repeat = occ.isSeries ? `, powtarza się ${REMINDER_REPEAT_LABELS[occ.repeat].toLowerCase()}` : "";
  const forecast = occ.isSeries && !occ.isNext ? " (prognoza serii)" : "";
  return `Przypomnienie: ${name}, ${when}${repeat}${forecast}`;
}

interface ReminderChipProps {
  occurrence: Occurrence;
  title: string;
  /** `true` w panelu dnia — więcej miejsca, więc pełny tytuł i data. */
  detailed?: boolean;
  className?: string;
}

export function ReminderChip({ occurrence, title, detailed = false, className }: ReminderChipProps) {
  const isForecast = occurrence.isSeries && !occurrence.isNext;
  const isPast = occurrence.at < Date.now();

  return (
    <span
      title={occurrenceLabel(occurrence, title)}
      className={cn(
        "flex items-center gap-1 rounded-md border px-1 py-px text-left leading-tight",
        detailed ? "text-xs px-2 py-1 gap-1.5" : "text-[10px]",
        isForecast
          ? "border-dashed border-primary/40 text-primary/70"
          : isPast
            ? "border-transparent bg-muted text-muted-foreground"
            : "border-transparent bg-primary/12 text-primary",
        className,
      )}
    >
      <span className="font-medium tabular-nums shrink-0">
        {format(new Date(occurrence.at), "HH:mm")}
      </span>
      <span className="truncate">{title.trim() || "Bez tytułu"}</span>
      {occurrence.isSeries && <Repeat className={cn("shrink-0", detailed ? "w-3 h-3" : "w-2.5 h-2.5")} />}
    </span>
  );
}
