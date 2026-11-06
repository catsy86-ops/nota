import { CalendarClock, ChevronRight, NotebookPen } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { useShifts, useShiftsReady } from "@/lib/shifts";
import { shiftInk } from "@/lib/shifts/color";
import { dayType } from "@/lib/shifts/model";
import { useShiftNow } from "@/lib/shifts/useShiftNow";
import { finishShiftNow } from "@/lib/shifts/finishNow";
import { readEveningNudgeTime } from "@/lib/shifts/eveningNudge";
import { countRemindersOn, isTomorrowPreviewTime, tomorrowLine } from "@/lib/todayTomorrow";
import { countDueToday } from "@/lib/reminderAgenda";
import { format, formatDistanceStrict } from "date-fns";
import { pl } from "date-fns/locale";
import { CardSkeleton } from "@/components/ViewSkeleton";

/**
 * Pierwsza rzecz w widoku „Dziś”: dzisiejsza zmiana z Grafiku (albo „wolne”), obok skrótów
 * do Grafiku i notatki dnia. Dane z Grafiku są tylko do odczytu — poza „Skończyłem teraz” (Dziś 2.1),
 * które zapisuje koniec zmiany tak samo jak karta „Teraz” w Grafiku (`finishShiftNow`).
 * Dziś 3.1: karta jako bohater — data jako nagłówek, duży znaczek w kolorze zmiany, godziny w kroju mono;
 * dzień wolny i nieobecność mają spokojny, szary znaczek.
 * Dziś 2.2: wieczorem (od godziny przypomnienia o Grafiku, inaczej od 18:00) wiersz „Jutro: …” → Kalendarz na jutrze.
 */
/**
 * Dziś 2.6: podgląd notatki dnia — pierwsze dwie niepuste linie i licznik odhaczeń. Prywatna notatka nie
 * pokazuje treści (projekcja jest pusta), więc tylko sam fakt istnienia.
 */
function dailyPreview(n: Note): { lines: string[]; done: number; total: number } {
  const lines = n.locked ? [] : n.content.split(String.fromCharCode(10)).map((l) => l.trim()).filter(Boolean).slice(0, 2);
  const items = n.checklist ?? [];
  return { lines, done: items.filter((i) => i.checked).length, total: items.length };
}

export function TodayShiftCard({ onOpenShifts, onDailyNote, dailyNote = null, reminderNotes = [], onOpenTomorrow }: {
  onOpenShifts: () => void;
  onDailyNote: () => void;
  /** Notatka dnia, jeśli już jest (dopisz zamiast zakładać). */
  dailyNote?: Note | null;
  /** Notatki z terminami — do licznika jutra (2.2). */
  reminderNotes?: readonly Note[];
  /** Klik w wiersz „Jutro” (Kalendarz na jutrzejszym dniu); bez niego wiersza nie ma. */
  onOpenTomorrow?: () => void;
}) {
  const ready = useShiftsReady();
  const data = useShifts();
  const today = new Date();
  const dateLabel = today.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
  const entry = ready ? data.days[localDayKey(today)] : undefined;
  const type = entry ? data.types.find((t) => t.id === entry.type) : undefined;
  // G2.1: „trwa teraz” albo „za X” liczone jak w karcie Teraz w Grafiku (ten sam zegar i te same zmiany).
  const { now, current, next, ended } = useShiftNow(data);
  // B3: pasek postępu bieżącej zmiany (0–1), liczony z tego samego zegara co napis.
  const progress = current ? Math.min(1, Math.max(0, (now.getTime() - current.start.getTime()) / (current.end.getTime() - current.start.getTime()))) : null;
  const timing = !ready ? null
    : current ? `Trwa teraz, do ${format(current.end, "HH:mm")}`
    : ended ? `Zmiana skończyła się o ${format(ended.end, "HH:mm")}`
    : next ? `Zaczynasz za ${formatDistanceStrict(next.start, now, { locale: pl })}, o ${format(next.start, "HH:mm")}`
    : null;
  const finishable = current ?? ended;

  // Dziś 1.3: zanim Grafik się wczyta — ten sam szkielet co przy leniwym ładowaniu karty, zamiast napisu.
  if (!ready) return <div aria-busy="true" aria-label="Wczytuję grafik"><CardSkeleton /></div>;

  const t = type ? dayType(type, entry) : undefined;
  const working = !!t && t.kind !== "absence";
  // Znaczek: zmiana w swoim kolorze; nieobecność i wolne — spokojnie, w barwach karty.
  const badge = t ? t.short : "—";
  const badgeStyle = working ? { backgroundColor: t!.color, color: shiftInk(t!.color) } : undefined;

  let tomorrow: string | null = null;
  if (onOpenTomorrow && isTomorrowPreviewTime(now, readEveningNudgeTime())) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const terms = countRemindersOn(reminderNotes, d);
    // Bez Grafiku i bez terminów „Jutro: wolne” nic nie mówi — wiersza nie ma.
    if (terms > 0 || Object.keys(data.days).length > 0) tomorrow = tomorrowLine(data.days[localDayKey(d)], data.types, terms);
  }
  // Dziś 3.6: pusty dzień (bez zmiany i bez terminów) — jedna spokojna karta zamiast kilku pustych sekcji.
  const quiet = !entry && countDueToday([...reminderNotes]) === 0;

  return (
    <section aria-label="Dziś" data-testid="today-card" className="rounded-card border border-border bg-card p-4 sm:p-5">
      <p className="font-display text-base font-semibold first-letter:uppercase text-foreground sm:text-lg">{dateLabel}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden data-testid="today-badge"
            className={`grid size-12 shrink-0 place-items-center rounded-card font-display text-lg font-bold ${working ? "" : "bg-muted text-muted-foreground"}`}
            style={badgeStyle}>
            {badge}
          </span>
          <p className="min-w-0 text-sm sm:text-base" data-testid="today-shift">
            {quiet ? <><span className="font-display font-semibold">Wolne. Nic nie czeka.</span><span className="sr-only"> Dziś nie ma zmiany w grafiku.</span></>
              : !entry ? "Dziś nie ma zmiany w grafiku."
              : !t ? "Zaplanowana zmiana (rodzaj usunięty)."
              // Godziny wpisane na ten dzień wygrywają z godzinami rodzaju (tak jak w Kalendarzu); nieobecność bez godzin.
              : t.kind === "absence" ? <span className="font-semibold">{t.name}</span>
              : <><span className="font-semibold">{t.name}</span>, <span className="font-mono tabular-nums">{t.start}–{t.end}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {finishable && (
            <Button variant="outline" size="sm" onClick={() => finishShiftNow(finishable)} className="coarse:h-11">
              Skończyłem teraz
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onOpenShifts} className="coarse:h-11">
            <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden />Grafik
          </Button>
          <Button variant={quiet && !dailyNote ? "default" : "outline"} size="sm" onClick={onDailyNote} className="coarse:h-11">
            <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden />{dailyNote ? "Dopisz" : "Notatka dnia"}
          </Button>
        </div>
      </div>
      {timing && <p className="ui-meta mt-2" data-testid="today-timing">{timing}</p>}
      {progress !== null && (
        <div role="progressbar" aria-label="Postęp zmiany" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${progress * 100}%`, ...(current?.type?.color ? { backgroundColor: current.type.color } : {}) }} data-testid="today-progress" />
        </div>
      )}
      {dailyNote && (() => {
        const p = dailyPreview(dailyNote);
        return (
          <div className="mt-3 rounded-field bg-muted/40 px-3 py-2 text-sm" data-testid="today-daily-preview">
            {dailyNote.locked ? <p className="text-muted-foreground">Notatka dnia jest w skarbcu.</p> : p.lines.length > 0 ? p.lines.map((l, i) => <p key={i} className="truncate">{l}</p>) : <p className="text-muted-foreground">Notatka dnia jest pusta.</p>}
            {p.total > 0 && <p className="ui-meta mt-1">Odhaczone: {p.done} z {p.total}</p>}
          </div>
        );
      })()}
      {tomorrow && (
        <button type="button" onClick={onOpenTomorrow} data-testid="today-tomorrow"
          className="pressable mt-3 flex w-full items-center justify-between gap-2 rounded-field border-t border-border/50 pt-3 text-left text-sm text-muted-foreground hover:text-foreground coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0 truncate">{tomorrow}</span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      )}
    </section>
  );
}
