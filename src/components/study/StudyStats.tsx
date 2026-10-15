import { useMemo } from "react";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { localDayKey } from "@/lib/dayDone";
import { QUESTIONS, TOPICS } from "@/lib/study/content";
import { activeStreak, openProblems, useStudy } from "@/lib/study/store";
import { accuracyByTopic, daysInLast, entriesByMonth, entriesBySite, hardestQuestions, overallAccuracy, studyDaysGrid } from "@/lib/study/stats";

const topicTitle = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id;
const WEEKDAYS = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

/**
 * Statystyki działu Praca (N4). Wykresy jednoseryjne w jednym odcieniu (`primary`) —
 * wartość zawsze podpisana tekstem obok, więc kolor niczego nie koduje sam i nie trzeba
 * legendy; `title` na każdym znaczniku daje dymek z dokładną liczbą.
 */
export function StudyStatsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" data-testid="study-stats">
        <div className="pr-8">
          <DialogTitle className="font-display text-lg">Statystyki</DialogTitle>
          <DialogDescription className="text-xs">Trafność z quizu i powtórek, dni nauki i wpisy z budowy.</DialogDescription>
        </div>
        {open && <StatsBody />}
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function StatsBody() {
  const study = useStudy();
  const today = localDayKey();
  const s = useMemo(() => {
    const overall = overallAccuracy(study.review);
    return {
      overall,
      topics: accuracyByTopic(study.review, QUESTIONS, TOPICS.map((t) => t.id)).filter((r) => r.percent !== null),
      hardest: hardestQuestions(study.review, 5),
      grid: studyDaysGrid(study.days, today, 12),
      days30: daysInLast(study.days, today, 30),
      months: entriesByMonth(study.journal, Date.now(), 6),
      sites: entriesBySite(study.journal, 6),
    };
  }, [study, today]);
  const streak = activeStreak(study);
  const open = openProblems(study.journal);
  const maxMonth = Math.max(1, ...s.months.map((m) => m.count));
  const maxSite = Math.max(1, ...s.sites.map((r) => r.count));

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="stats-tiles">
        <Tile label="Trafność" value={s.overall.percent === null ? "—" : `${s.overall.percent}%`} hint={s.overall.seen > 0 ? `${s.overall.right}/${s.overall.seen} odpowiedzi` : "jeszcze bez rund"} />
        <Tile label="Dni nauki" value={String(s.days30)} hint="w ostatnich 30 dniach" />
        <Tile label="Seria" value={String(streak)} hint={pluralPl(streak, ["dzień z rzędu", "dni z rzędu", "dni z rzędu"])} />
        <Tile label="Wpisy z budowy" value={String(study.journal.length)} hint={open > 0 ? `otwarte problemy: ${open}` : "bez otwartych problemów"} />
      </dl>

      <Section title="Trafność per temat" note="Od najsłabszego. Tematy bez odpowiedzi pominięte.">
        {s.topics.length === 0 ? (
          <Empty>Rozwiąż rundę quizu — trafność pojawi się tutaj.</Empty>
        ) : (
          <ul className="space-y-2" data-testid="stats-topics">
            {s.topics.map((r) => (
              <BarRow key={r.topic} label={topicTitle(r.topic)} ratio={r.percent! / 100} value={`${r.percent}%`} detail={`${r.right}/${r.seen}`} title={`${topicTitle(r.topic)}: ${r.percent}% (${r.right} z ${r.seen})`} />
            ))}
          </ul>
        )}
      </Section>

      {s.hardest.length > 0 && (
        <Section title="Najtrudniejsze pytania" note="Najwięcej pomyłek — wracają do powtórki następnego dnia po błędzie.">
          <ol className="space-y-1.5 text-sm" data-testid="stats-hardest">
            {s.hardest.map((h) => {
              const q = QUESTIONS.find((x) => x.id === h.id);
              return (
                <li key={h.id} className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{h.lapses}×</span>
                  <span className="min-w-0">{q?.question ?? h.id}</span>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      <Section title="Dni nauki" note="Ostatnie 12 tygodni — kratka to dzień z co najmniej jedną rundą quizu.">
        <div className="flex gap-1.5" data-testid="stats-days">
          <div className="grid grid-rows-7 gap-[3px] pr-1 text-2xs leading-none text-muted-foreground" aria-hidden>
            {WEEKDAYS.map((d, i) => <span key={d} className={cn("flex h-3.5 items-center sm:h-4", i % 2 === 1 && "invisible")}>{d}</span>)}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[3px] [grid-auto-columns:0.875rem] sm:[grid-auto-columns:1rem]" role="img" aria-label={`Dni nauki w 12 tygodniach: ${s.grid.flat().filter((c) => c.studied).length}`}>
            {s.grid.flat().map((c) => (
              <span
                key={c.key}
                title={c.future ? undefined : `${c.key}${c.studied ? " — nauka" : ""}`}
                data-studied={c.studied || undefined}
                className={cn(
                  "size-3.5 rounded-[3px] sm:size-4",
                  c.future ? "bg-transparent" : c.studied ? "bg-primary" : "bg-muted",
                  c.key === today && "ring-1 ring-foreground/40",
                )}
              />
            ))}
          </div>
        </div>
      </Section>

      <Section title="Wpisy z budowy per miesiąc" note="Ostatnie 6 miesięcy.">
        <div className="flex h-32 items-end gap-2" data-testid="stats-months">
          {s.months.map((m) => (
            <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${m.month}: ${m.count}`}>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{m.count}</span>
              <span
                className="w-full max-w-10 rounded-t bg-primary"
                // Zero to linia bazowa 2 px, nie pusty słupek — widać, że miesiąc jest, tylko bez wpisów.
                style={{ height: m.count > 0 ? `${Math.max(6, (m.count / maxMonth) * 100)}%` : "2px", opacity: m.count > 0 ? 1 : 0.35 }}
              />
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {s.sites.length > 0 && (
        <Section title="Wpisy per budowa">
          <ul className="space-y-2" data-testid="stats-sites">
            {s.sites.map((r) => (
              <BarRow
                key={r.site}
                label={r.site}
                ratio={r.count / maxSite}
                value={String(r.count)}
                detail={r.open > 0 ? `otwarte: ${r.open}` : undefined}
                title={`${r.site}: ${r.count} ${pluralPl(r.count, ["wpis", "wpisy", "wpisów"])}`}
              />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-2xl font-semibold tabular-nums leading-tight">{value}</dd>
      <dd className="text-2xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5" aria-label={title}>
      <header>
        <h3 className="font-display text-base">{title}</h3>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </header>
      {children}
    </section>
  );
}

/** Wiersz poziomego słupka: podpis, tor z wypełnieniem (zaokrąglony koniec), wartość tekstem. */
function BarRow({ label, ratio, value, detail, title }: { label: string; ratio: number; value: string; detail?: string; title: string }) {
  return (
    // Telefon: podpis nad słupkiem (obok zostawałoby kilka liter); od `sm` w jednym wierszu.
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 text-sm sm:grid-cols-[minmax(0,13rem)_1fr_auto]" title={title}>
      <span className="col-span-2 truncate sm:col-span-1">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(ratio > 0 ? 3 : 0, ratio * 100)}%` }} />
      </span>
      <span className="text-right font-mono text-xs tabular-nums">
        {value}{detail && <span className="ml-1.5 text-muted-foreground">{detail}</span>}
      </span>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{children}</p>;
}
