import { format, formatDistanceStrict, isToday, isTomorrow } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { formatDuration, setDayEntry, shiftInk, type ShiftData, type ShiftOccurrence } from "@/lib/shifts";
import { useShiftNow } from "@/lib/shifts/useShiftNow";
import { toastWithUndo } from "@/lib/undoToast";
import { haptic } from "@/lib/haptics";

/** Kończy zmianę „teraz”: odchylenie od planu = różnica między teraz a planowanym końcem. */
function finishNow(occ: ShiftOccurrence): void {
  const plannedEnd = occ.end.getTime() - (occ.entry.extraMin ?? 0) * 60_000;
  const extra = Math.round((Date.now() - plannedEnd) / 60_000);
  if (extra === (occ.entry.extraMin ?? 0)) { toast("Zmiana już ma taki koniec"); return; }
  const before = occ.entry;
  const { extraMin: _drop, ...rest } = before;
  setDayEntry(occ.dayKey, extra === 0 ? rest : { ...rest, extraMin: extra });
  const label = extra === 0 ? "zgodnie z planem" : `${extra > 0 ? "+" : "−"}${formatDuration(Math.abs(extra))} względem planu`;
  toastWithUndo(`Zakończono zmianę: ${label}`, () => setDayEntry(occ.dayKey, before));
  haptic("success");
}


function when(occ: ShiftOccurrence): string {
  const time = format(occ.start, "HH:mm");
  if (isToday(occ.start)) return `dziś o ${time}`;
  if (isTomorrow(occ.start)) return `jutro o ${time}`;
  return `${format(occ.start, "EEEE d MMMM", { locale: pl })}, ${time}`;
}

/** Zakończona przed chwilą zmiana: „Skończyłem teraz” zapisze nadgodziny jednym stuknięciem. */
function EndedCard({ occ }: { occ: ShiftOccurrence }) {
  return (
    <section aria-label="Zakończona zmiana" className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-4 flex items-center gap-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: occ.type.color }} />
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Zmiana się skończyła</p>
        <p className="font-display font-bold line-clamp-2 wrap-anywhere">
          {occ.type.name} <span className="font-normal text-muted-foreground tabular-nums">do {format(occ.end, "HH:mm")}</span>
        </p>
        <p className="text-xs text-muted-foreground">Zostajesz dłużej? Zapisz koniec, zanim zmiana zniknie z karty.</p>
      </div>
      <button type="button" onClick={() => finishNow(occ)}
        className="pressable shrink-0 h-10 coarse:h-11 px-3 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        Skończyłem teraz
      </button>
    </section>
  );
}

/** Co teraz i co dalej — pierwsza rzecz, której szuka ktoś pracujący na zmiany. */
export function NowCard({ data }: { data: ShiftData }) {
  const { now, current, next, ended } = useShiftNow(data);
  // Zmiana skończona przed chwilą (nadgodziny): karta zostaje, z odchyleniem liczonym od planu.
  if (ended && !next) return <EndedCard occ={ended} />;
  if (!current && !next) return null;

  const main = current ?? next!;
  const progress = current ? (now.getTime() - current.start.getTime()) / (current.end.getTime() - current.start.getTime()) : 0;

  return (
    <section aria-label="Bieżąca zmiana" className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-4 flex items-center gap-4">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: main.type.color }} />
      <span className="w-12 h-12 shrink-0 rounded-card flex items-center justify-center font-display font-bold text-lg" style={{ backgroundColor: main.type.color, color: shiftInk(main.type.color) }}>
        {main.type.short}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {/* Pulsujący punkt „trwa teraz” — czysty CSS, bez zegara klatek. */}
          {current && <span aria-hidden className="now-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: main.type.color }} />}
          {current ? "Teraz w pracy" : "Następna zmiana"}
        </p>
        <p className="font-display font-bold line-clamp-2 wrap-anywhere">
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
      {current && (
        <button type="button" onClick={() => finishNow(current)}
          className="pressable shrink-0 h-10 coarse:h-11 px-3 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          Skończyłem teraz
        </button>
      )}
      {current && next && (
        <p className="hidden sm:block text-xs text-muted-foreground text-right shrink-0">
          Potem: <span className="text-foreground font-medium">{next.type.name}</span><br />{when(next)}
        </p>
      )}
    </section>
  );
}
