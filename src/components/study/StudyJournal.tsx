import { useMemo, useState } from "react";
import { Check, CheckCircle2, FileText, MapPin, Pencil, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { NoteImage } from "@/components/NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CHECKLIST, TOPICS } from "@/lib/study/content";
import { openProblems, setProblemResolved, useStudy, type JournalEntry } from "@/lib/study/store";
import {
  entriesPl, filterJournal, groupJournal, isFiltered, journalSites, KIND_LABEL, NO_FILTER, problemsPl, RECENT_DAYS, splitRecent,
  type JournalFilter, type KindFilter,
} from "@/lib/study/journalView";
import { useJournalDraft } from "@/lib/study/draft";
import { openJournalEdit, openJournalSheet } from "@/lib/study/entrySheet";
import { JournalEntrySheet, KindIcon } from "./JournalEntrySheet";
import { JournalReportDialog } from "./JournalReport";

const topicTitle = (id: string | null) => TOPICS.find((t) => t.id === id)?.title ?? null;
const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_CHIPS: { value: KindFilter | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "ok", label: "Zrobione" },
  { value: "problem", label: "Problemy" },
  { value: "open", label: "Otwarte" },
  { value: "note", label: "Notatki" },
];

const selectClass =
  "h-9 min-w-0 flex-1 truncate rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 sm:flex-none sm:max-w-[14rem]";

/**
 * Dziennik z budowy: na górze to, co już zapisane, nowy wpis w arkuszu („+ Wpis”, „+” w dolnym
 * pasku, skrót z ekranu głównego). Problem cofa temat do powtórki, a „Zrobione” liczy się jako praktyka.
 * Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego; poprawka i usunięcie wpisu — w arkuszu.
 * Oś czasu: dzień → budowa, ostatnie 30 dni (starsze za „Pokaż starsze” albo po filtrze).
 */
export function StudyJournal({ onPractice }: { onPractice: (topicId: string) => void }) {
  const study = useStudy();
  const draft = useJournalDraft();
  const hasDraft = !!draft.text.trim() || draft.images.length > 0 || draft.checked.length > 0;
  const [zoom, setZoom] = useState<string | null>(null);
  const [filter, setFilter] = useState<JournalFilter>(NO_FILTER);
  const [showOlder, setShowOlder] = useState(false);
  const [report, setReport] = useState(false);
  const patch = (p: Partial<JournalFilter>) => setFilter((f) => ({ ...f, ...p }));
  const filtered = isFiltered(filter);

  const sites = useMemo(() => journalSites(study.journal), [study.journal]);
  const hasUnsited = useMemo(() => sites.length > 0 && study.journal.some((e) => !e.site.trim()), [sites, study.journal]);
  const topics = useMemo(() => {
    const used = new Set(study.journal.map((e) => e.topic));
    return TOPICS.filter((t) => used.has(t.id));
  }, [study.journal]);

  // Filtr szuka w całym dzienniku — inaczej wpis sprzed dwóch miesięcy „nie istnieje”.
  const view = useMemo(() => {
    const matches = filterJournal(study.journal, filter, topicTitle);
    if (filtered || showOlder) return { days: groupJournal(matches), shown: matches.length, older: 0 };
    const { recent, older } = splitRecent(matches);
    return { days: groupJournal(recent), shown: recent.length, older };
  }, [study.journal, filter, filtered, showOlder]);

  const week = useMemo(() => {
    const since = Date.now() - 7 * DAY_MS;
    const recent = study.journal.filter((e) => e.at >= since);
    return { all: recent.length, problems: recent.filter((e) => e.kind === "problem").length };
  }, [study.journal]);
  const open = useMemo(() => openProblems(study.journal), [study.journal]);

  return (
    <div className="space-y-6" data-testid="study-journal">
      <section aria-label="Wpisy">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight">Dziennik</h3>
            <p className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="journal-week">
              7 dni: {entriesPl(week.all)}, {problemsPl(week.problems)}
            </p>
            {open > 0 && (
              <button
                type="button"
                onClick={() => patch({ kind: filter.kind === "open" ? null : "open" })}
                aria-pressed={filter.kind === "open"}
                title="Pokaż tylko otwarte problemy"
                className={cn(
                  "pressable mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground coarse:min-h-9",
                  filter.kind === "open" ? "bg-warning/25 ring-1 ring-warning/60" : "bg-warning/10 hover:bg-warning/20",
                )}
                data-testid="journal-open-problems"
              >
                <KindIcon kind="problem" className="h-3.5 w-3.5" />
                Otwarte problemy: <span className="font-mono tabular-nums">{open}</span>
              </button>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {study.journal.length > 0 && (
              <Button variant="outline" onClick={() => setReport(true)} className="max-sm:w-9 max-sm:px-0 coarse:h-11 max-sm:coarse:w-11" title="Raport dnia albo okresu dla budowy">
                <FileText className="h-4 w-4 sm:mr-1" aria-hidden /><span className="max-sm:sr-only">Raport</span>
              </Button>
            )}
            <Button onClick={() => openJournalSheet()} className="coarse:h-11">
              <Plus className="mr-1 h-4 w-4" aria-hidden />{hasDraft ? "Dokończ wpis" : "Wpis"}
            </Button>
          </div>
        </header>

        {study.journal.length === 0 ? (
          <button
            type="button"
            onClick={() => openJournalSheet()}
            className="block w-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            Brak wpisów. Zapisz, co robisz na budowie — dziennik połączy to z tematami, które przerabiasz.
          </button>
        ) : (
          <>
            <div className="mb-4 space-y-2" role="search" aria-label="Filtry dziennika">
              <label className="relative block">
                <span className="sr-only">Szukaj w dzienniku</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  value={filter.query}
                  onChange={(ev) => patch({ query: ev.target.value })}
                  placeholder="Szukaj: rura, Lipowa, szczelność…"
                  enterKeyHint="search"
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm"
                />
              </label>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="group" aria-label="Rodzaj wpisu">
                {KIND_CHIPS.map((c) => {
                  const on = filter.kind === c.value;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patch({ kind: c.value })}
                      className={cn(
                        "pressable shrink-0 rounded-full border px-3 py-1 text-xs coarse:min-h-11 coarse:px-4 coarse:text-sm",
                        on ? "border-primary bg-primary/10 font-medium text-primary-ink" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {(sites.length > 0 || topics.length > 0) && (
                <div className="flex gap-2">
                  {sites.length > 0 && (
                    <select
                      aria-label="Budowa"
                      value={filter.site === null ? "all" : `s:${filter.site}`}
                      onChange={(ev) => patch({ site: ev.target.value === "all" ? null : ev.target.value.slice(2) })}
                      className={selectClass}
                    >
                      <option value="all">Wszystkie budowy</option>
                      {sites.map((s) => <option key={s} value={`s:${s}`}>{s}</option>)}
                      {hasUnsited && <option value="s:">Bez budowy</option>}
                    </select>
                  )}
                  {topics.length > 0 && (
                    <select
                      aria-label="Temat"
                      value={filter.topic ?? ""}
                      onChange={(ev) => patch({ topic: ev.target.value || null })}
                      className={selectClass}
                    >
                      <option value="">Wszystkie tematy</option>
                      {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  )}
                </div>
              )}
              {filtered && (
                <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite" data-testid="journal-results">
                  <span className="font-mono tabular-nums">Pasuje: {entriesPl(view.shown)}</span>
                  <button type="button" onClick={() => setFilter(NO_FILTER)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground coarse:min-h-11">
                    <X className="h-3.5 w-3.5" aria-hidden />Wyczyść filtry
                  </button>
                </p>
              )}
            </div>

            {view.days.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {filtered ? "Nic nie pasuje. Zmień słowa albo wyczyść filtry." : `Brak wpisów z ostatnich ${RECENT_DAYS} dni.`}
              </p>
            ) : (
              <div className="space-y-5">
                {view.days.map((d) => (
                  <section key={d.key} aria-label={d.label} data-journal-day={d.key}>
                    <h4 className="sticky top-[var(--app-header-h,0px)] z-10 -mx-1 mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 bg-background/95 px-1 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur transition-[top] duration-300 ease-out motion-reduce:transition-none [html.header-hidden_&]:top-0">
                      <span>{d.label}</span>
                      <span className="font-mono normal-case tracking-normal tabular-nums">{entriesPl(d.count)}</span>
                    </h4>
                    <div className="space-y-3">
                      {d.sites.map((g) => (
                        <div key={g.site}>
                          {(g.site || d.sites.length > 1) && (
                            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground/80" data-journal-site={g.site}>
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden />
                              <span className="truncate">{g.site || "Bez budowy"}</span>
                            </p>
                          )}
                          <ul className="space-y-2">
                            {g.entries.map((e) => <JournalItem key={e.id} entry={e} onPractice={onPractice} onZoom={setZoom} />)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {view.older > 0 && (
              <Button variant="outline" className="mt-4 w-full coarse:h-11" onClick={() => setShowOlder(true)}>
                Pokaż starsze ({entriesPl(view.older)})
              </Button>
            )}
          </>
        )}
      </section>
      <JournalEntrySheet onPractice={onPractice} />
      <JournalReportDialog open={report} onOpenChange={setReport} journal={study.journal} sites={sites} initialSite={filter.site} />
      <Dialog open={zoom !== null} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent className="max-w-3xl p-3">
          <DialogTitle className="sr-only">Zdjęcie z budowy</DialogTitle>
          {zoom && <NoteImage imageRef={zoom} alt="Zdjęcie z budowy" loading="eager" className="max-h-[80dvh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JournalItem({ entry: e, onPractice, onZoom }: { entry: JournalEntry; onPractice: (topicId: string) => void; onZoom: (ref: string) => void }) {
  const total = CHECKLIST.filter((c) => c.topic === e.topic).length;
  const resolved = e.kind === "problem" && e.resolved !== undefined;

  function toggleResolved() {
    haptic(resolved ? "tap" : "success");
    setProblemResolved(e.id, !resolved);
  }

  return (
    <li className="rounded-xl border border-border bg-card p-3" data-journal-entry={e.kind} data-resolved={resolved || undefined}>
      <div className="flex items-start gap-2.5">
        {resolved ? <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <KindIcon kind={e.kind} />}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm leading-snug">{e.text || "Sprawdzone punkty listy"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {new Date(e.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>{resolved ? "Problem rozwiązany" : KIND_LABEL[e.kind]}</span>
            {e.topic && (
              <button
                type="button"
                onClick={() => onPractice(e.topic!)}
                className="rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10 hover:text-primary-ink"
                title="Ćwicz pytania z tego tematu"
              >
                {topicTitle(e.topic)}
              </button>
            )}
            {e.checked.length > 0 && <span className="tabular-nums">punkty {e.checked.length}/{total}</span>}
          </div>
          {e.kind === "problem" && (
            <button
              type="button"
              onClick={toggleResolved}
              className={cn(
                "pressable mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3.5 coarse:text-sm",
                resolved ? "border-border text-muted-foreground hover:text-foreground" : "border-warning/60 bg-warning/10 font-medium text-foreground hover:bg-warning/20",
              )}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {resolved ? "Otwórz ponownie" : "Oznacz jako rozwiązany"}
            </button>
          )}
          {e.images.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Zdjęcia wpisu">
              {e.images.map((ref) => (
                <li key={ref}>
                  <button type="button" onClick={() => onZoom(ref)} aria-label="Powiększ zdjęcie" className="block overflow-hidden rounded-lg">
                    <NoteImage imageRef={ref} alt="" className="h-16 w-16 object-cover" placeholderClassName="h-16 w-16" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => openJournalEdit(e)}
          aria-label="Edytuj wpis"
          title="Edytuj albo usuń wpis"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:h-11 coarse:w-11"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
