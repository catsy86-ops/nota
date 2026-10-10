import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { pl } from "date-fns/locale";
import { currentAndNextShift, shiftInk, type ShiftData, type ShiftOccurrence } from "@/lib/shifts";

/** Minutowy zegar — karta ma pokazywać „za 3 h”, nie stan sprzed godziny. */
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function when(occ: ShiftOccurrence): string {
  const time = format(occ.start, "HH:mm");
  if (isToday(occ.start)) return `dziś o ${time}`;
  if (isTomorrow(occ.start)) return `jutro o ${time}`;
  return `${format(occ.start, "EEEE d MMMM", { locale: pl })}, ${time}`;
}

/** Co teraz i co dalej — pierwsza rzecz, której szuka ktoś pracujący na zmiany. */
export function NowCard({ data }: { data: ShiftData }) {
  const now = useNow();
  const { current, next } = useMemo(() => currentAndNextShift(data, now), [data, now]);
  if (!current && !next) return null;

  const main = current ?? next!;
  const progress = current ? (now.getTime() - current.start.getTime()) / (current.end.getTime() - current.start.getTime()) : 0;

  return (
    <section aria-label="Bieżąca zmiana" className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-4 flex items-center gap-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: main.type.color }} />
      <span className="w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center font-display font-bold text-lg" style={{ backgroundColor: main.type.color, color: shiftInk(main.type.color) }}>
        {main.type.short}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {/* Pulsujący punkt „trwa teraz” — czysty CSS, bez zegara klatek. */}
          {current && <span aria-hidden className="now-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: main.type.color }} />}
          {current ? "Teraz w pracy" : "Następna zmiana"}
        </p>
        <p className="font-display font-bold truncate">
          {main.type.name}{" "}
          <span className="font-normal text-muted-foreground tabular-nums">
            {current ? `do ${format(current.end, "HH:mm")}` : when(main)}
          </span>
        </p>
        {current ? (
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Postęp zmiany"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            {/* Wypełnienie jest pełnej szerokości i wsuwa się przesunięciem (transform) — kształt końca się nie spłaszcza; tor przycina. */}
            <div className="relative h-full w-full overflow-hidden rounded-full now-bar transition-transform duration-700 ease-out-soft"
              style={{ transform: `translateX(${(Math.min(1, Math.max(0, progress)) - 1) * 100}%)`, backgroundColor: main.type.color }}>
              <span aria-hidden className="now-bar-sheen" />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">za {formatDistanceStrict(main.start, now, { locale: pl })}</p>
        )}
      </div>
      {current && next && (
        <p className="hidden sm:block text-xs text-muted-foreground text-right shrink-0">
          Potem: <span className="text-foreground font-medium">{next.type.name}</span><br />{when(next)}
        </p>
      )}
    </section>
  );
}
