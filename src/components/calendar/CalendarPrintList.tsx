import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { parseDayKey } from "@/lib/week";
import type { Occurrence } from "@/lib/reminderOccurrences";

/**
 * Wydruk miesiąca z Kalendarza: terminy dzień po dniu, bez siatki i przycisków.
 * Pokazuje tylko to, co się zapisało i jest prognozą serii (oznaczoną). Siatka i panel są
 * ukryte przez `PrintRoot`, więc ten komponent jest jedynym, co trafia na papier.
 */
export function CalendarPrintList({ month, byDay, titleOf }: {
  month: Date;
  byDay: Map<string, Occurrence[]>;
  titleOf: (noteId: string) => string;
}) {
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-`;
  const keys = [...byDay.keys()].filter((k) => k.startsWith(prefix)).sort();

  return (
    <article className="report-paper p-6 space-y-4">
      <h1 className="text-lg font-semibold first-letter:uppercase">Terminy: {format(month, "LLLL yyyy", { locale: pl })}</h1>
      {keys.length === 0 ? (
        <p className="text-sm">Brak terminów w tym miesiącu.</p>
      ) : (
        <div className="space-y-3 text-sm">
          {keys.map((k) => (
            <section key={k}>
              <h2 className="font-semibold first-letter:uppercase">{format(parseDayKey(k), "EEEE, d MMMM", { locale: pl })}</h2>
              <ul className="ml-4 list-disc">
                {(byDay.get(k) ?? []).map((occ) => (
                  <li key={`${occ.noteId}-${occ.at}`}>
                    {occ.allDay ? "cały dzień" : format(new Date(occ.at), "HH:mm")} — {titleOf(occ.noteId).trim() || "Bez tytułu"}
                    {occ.isSeries && !occ.isNext ? " (prognoza serii)" : ""}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </article>
  );
}
