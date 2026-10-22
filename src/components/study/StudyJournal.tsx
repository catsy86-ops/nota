import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { fittingsLine } from "@/lib/study/fittings";
import { testLine } from "@/lib/study/pressureTest";
import { Archive, Check, ChevronLeft, Clock, Gauge, Mic, Package, CircleCheck, ChevronRight, FileText, MapPin, Pencil, Play, Plus, Search, TriangleAlert, Wrench, X } from "lucide-react";
import { mapsUrl } from "@/lib/study/geo";
import { pluralPl } from "@/lib/plural";
import { studyReminders, type StudyReminder } from "@/lib/study/reminders";
import { useDayClock } from "@/lib/dayClock";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/StatusPanel";
import { EmptySketch } from "@/components/EmptyIllustration";
import { JOURNAL_GLYPH } from "@/lib/emptyGlyphs";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { NoteImage } from "@/components/NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TOPICS } from "@/lib/study/content";
import { JOURNAL_SOLUTION_MAX, openProblems, setProblemResolved, setProblemSolution, setSite, useStudy, useStudyLists, type JournalEntry } from "@/lib/study/store";
import {
  entriesPl, filterJournal, groupJournal, isFiltered, KIND_LABEL, NO_FILTER, problemsPl, RECENT_DAYS, splitRecent,
  type JournalFilter, type KindFilter,
} from "@/lib/study/journalView";
import { patchJournalDraft, useJournalDraft } from "@/lib/study/draft";
import { openJournalEdit, openJournalSheet } from "@/lib/study/entrySheet";
import { JournalEntrySheet, KindIcon } from "./JournalEntrySheet";
import { JournalReportDialog } from "./JournalReport";
import { SiteCardDialog } from "./SiteCardDialog";
import { NewSiteDialog } from "./NewSiteDialog";
import { DayHoursDialog } from "./DayHoursDialog";
import { EntryCheckCard } from "./EntryCheck";
import { useShifts } from "@/lib/shifts";
import { formatHoursShort } from "@/lib/shifts/time";
import { dayKeyOf, workOn } from "@/lib/study/report";
import { dayHours, type DayHours } from "@/lib/study/siteHours";
import { consumeJournalReportRequest, useJournalReportRequest, type JournalReportRequest } from "@/lib/study/reportLink";
import { stageProgress } from "@/lib/study/stages";
import { entrySiteId, siteDirectory } from "@/lib/study/sites";

const AudioPreview = lazy(() => import("@/components/VoiceAttachmentParts").then((m) => ({ default: m.AudioPreview })));

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
  "h-9 w-full min-w-0 truncate rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 sm:w-auto sm:max-w-56";

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
  /** Powiększone zdjęcia wpisu i bieżące — galeria przewija wszystkie zdjęcia jednego wpisu. */
  const [zoom, setZoom] = useState<{ refs: string[]; index: number } | null>(null);
  const [filter, setFilter] = useState<JournalFilter>(NO_FILTER);
  const [showOlder, setShowOlder] = useState(false);
  const [report, setReport] = useState(false);
  /** Budowa raportu otwartego z karty; `null` = z filtra albo ostatnia. */
  const [reportSite, setReportSite] = useState<string | null>(null);
  // Przypomnienie o raporcie (dnia albo tygodnia): okno raportu z zakresem z prośby — jedna budowa albo
  // wszystkie, dzień ostatniego wpisu albo 7 dni. Zwykłe otwarcie raportu czyści prośbę (`null`).
  const [reportRequest, setReportRequest] = useState<JournalReportRequest | null>(null);
  const reportRequested = useJournalReportRequest();
  useEffect(() => {
    if (!reportRequested) return;
    const req = consumeJournalReportRequest();
    if (req) { setReportSite(null); setReportRequest(req); setReport(true); }
  }, [reportRequested]);
  const [card, setCard] = useState<string | null>(null);
  /** Dzień w oknie „Godziny na budowach”. */
  const [hoursDay, setHoursDay] = useState<{ key: string; label: string } | null>(null);
  const shifts = useShifts();
  const [showArchived, setShowArchived] = useState(false);
  // Przypomnienia „> 3 dni” liczą się od dzisiaj — po północy lista ma się odświeżyć sama.
  const dayTick = useDayClock();
  const patch = (p: Partial<JournalFilter>) => setFilter((f) => ({ ...f, ...p }));
  const filtered = isFiltered(filter);

  const dir = useMemo(() => siteDirectory(study.sites, study.journal), [study.sites, study.journal]);
  // Postęp etapów przy nazwie budowy — tylko budowy z własną listą (ktoś już odhaczał).
  const stagesBySite = useMemo(
    () => new Map(dir.filter((x) => x.stages).map((x) => [x.id, stageProgress(x.stages!)] as const)),
    [dir],
  );
  // Pigułki: budowy z wpisami; archiwalne za „Archiwum”, chyba że wybrana.
  // Budowy z wpisami i zapisane karty bez wpisów (nowa budowa), żeby nowa była od razu na liście.
  const used = useMemo(() => dir.filter((x) => x.count > 0 || x.stored), [dir]);
  const [newSiteOpen, setNewSiteOpen] = useState(false);
  const archivedCount = used.filter((x) => x.archived !== undefined).length;
  const sites = used.filter((x) => x.archived === undefined || showArchived || x.id === filter.site);
  const hasUnsited = useMemo(() => used.length > 0 && study.journal.some((e) => !entrySiteId(e)), [used, study.journal]);
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

  // Podział godzin tylko dla dni z kilkoma budowami albo z wpisanymi godzinami (H2, `siteHours.ts`).
  const hoursByDay = useMemo(() => {
    const out = new Map<string, DayHours>();
    for (const d of view.days) {
      const work = workOn(shifts, d.key)?.minutes ?? 0;
      const split = dayHours(study.journal, study.sites, work, d.key, dayKeyOf);
      if (split.sites.length > 1 || split.sites.some((s) => s.set)) out.set(d.key, split);
    }
    return out;
  }, [view.days, shifts, study.journal, study.sites]);

  const week = useMemo(() => {
    const since = Date.now() - 7 * DAY_MS;
    const recent = study.journal.filter((e) => e.at >= since);
    return { all: recent.length, problems: recent.filter((e) => e.kind === "problem").length };
  }, [study.journal]);
  const open = useMemo(() => openProblems(study.journal), [study.journal]);
  const reminders = useMemo(() => { void dayTick; return studyReminders(study.journal, Date.now(), study.sites); }, [study.journal, study.sites, dayTick]);

  return (
    <div className="space-y-6" data-testid="study-journal">
      {/* Szeroki ekran (xl): wpisy w kolumnie do 48 rem, obok przyklejony panel filtrów — przewijanie
          dziennika nie zabiera wyszukiwarki ani „Otwarte” (plan UI 2.4). Węższe: jedna kolumna jak dotąd. */}
      <section aria-label="Wpisy" className="xl:grid xl:grid-cols-[minmax(0,48rem)_20rem] xl:grid-rows-[auto_auto_1fr] xl:justify-between xl:gap-x-10">
        <header className="mb-3 flex items-center justify-between gap-3 xl:col-start-1 xl:row-start-1">
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
                  "pressable mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-foreground coarse:min-h-11 coarse:px-3 coarse:text-sm",
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
              <Button variant="outline" onClick={() => { setReportSite(null); setReportRequest(null); setReport(true); }} className="max-sm:w-9 max-sm:px-0 coarse:h-11 max-sm:coarse:w-11" title="Raport dnia albo okresu dla budowy">
                <FileText className="h-4 w-4 sm:mr-1" aria-hidden /><span className="max-sm:sr-only">Raport</span>
              </Button>
            )}
            <Button onClick={() => openJournalSheet()} className="coarse:h-11">
              <Plus className="mr-1 h-4 w-4" aria-hidden />{hasDraft ? "Dokończ wpis" : "Wpis"}
            </Button>
          </div>
        </header>

        <EntryCheckCard />

        {reminders.length > 0 && (
          <ul aria-label="Przypomnienia" className="mb-4 space-y-2 xl:col-start-1" data-testid="journal-reminders">
            {reminders.map((r) => (
              <ReminderRow
                key={r.kind === "stale-problems" ? "stale" : `${r.kind}-${r.siteId}`}
                reminder={r}
                onShow={() => (r.kind === "stale-problems" ? patch({ kind: "open" }) : r.kind === "late-order" || r.kind === "service-due" || r.kind === "pre-cover-test" ? setCard(r.siteId) : openTestEntry(r.site))}
              />
            ))}
          </ul>
        )}

        {study.journal.length === 0 ? (
          <StatusPanel
            size="inline"
            icon={null}
            art={<EmptySketch paths={JOURNAL_GLYPH} className="relative mx-auto mb-3 h-20 w-28 text-primary-ink" />}
            title="Brak wpisów"
            description="Zapisz, co robisz na budowie — dziennik połączy to z tematami, które przerabiasz."
            actions={<div className="flex flex-wrap justify-center gap-2"><Button size="sm" className="coarse:h-11" onClick={() => openJournalSheet()}><Plus className="h-4 w-4" aria-hidden />Dodaj wpis</Button><Button size="sm" variant="outline" className="coarse:h-11" onClick={() => setNewSiteOpen(true)}>Nowa budowa</Button></div>}
            className="xl:col-start-1"
          />
        ) : (
          <>
            <div className="mb-4 space-y-2 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:mb-0 xl:sticky xl:top-24 xl:self-start xl:rounded-card xl:border xl:border-border/60 xl:bg-card xl:p-4 xl:shadow-elevation-1" role="search" aria-label="Filtry dziennika">
              <h4 className="hidden xl:block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtry</h4>
              <label className="relative block">
                <span className="sr-only">Szukaj w dzienniku</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  type="search"
                  value={filter.query}
                  onChange={(ev) => patch({ query: ev.target.value })}
                  placeholder="Szukaj: rura, Lipowa, szczelność…"
                  enterKeyHint="search"
                  className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm"
                />
              </label>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] xl:flex-wrap xl:overflow-visible" role="group" aria-label="Rodzaj wpisu">
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
              {(
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] xl:flex-wrap xl:overflow-visible" role="group" aria-label="Budowa">
                  {[null, ...sites, ...(hasUnsited ? [""] : [])].map((x) => {
                    const id = typeof x === "object" && x !== null ? x.id : x;
                    const s = typeof x === "object" && x !== null ? x.name : x;
                    const on = filter.site === id;
                    return (
                      <button
                        key={id ?? "all"}
                        type="button"
                        aria-pressed={on}
                        onClick={() => patch({ site: id })}
                        className={cn(
                          "pressable inline-flex max-w-56 shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs coarse:min-h-11 coarse:px-4 coarse:text-sm",
                          on ? "border-primary bg-primary/10 font-medium text-primary-ink" : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s && <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                        <span className="truncate">{s === null ? "Wszystkie budowy" : s || "Bez budowy"}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setNewSiteOpen(true)}
                    className="pressable inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-primary-ink hover:bg-primary/10 coarse:min-h-11 coarse:px-4 coarse:text-sm"
                  >
                    + Nowa budowa
                  </button>
                  {archivedCount > 0 && (
                    <button
                      type="button"
                      aria-pressed={showArchived}
                      onClick={() => setShowArchived((v) => !v)}
                      className={cn(
                        "pressable inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 py-1 text-xs coarse:min-h-11 coarse:px-4 coarse:text-sm",
                        showArchived ? "border-primary text-primary-ink" : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />Archiwum ({archivedCount})
                    </button>
                  )}
                </div>
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
              {filtered && (
                <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite" data-testid="journal-results">
                  <span className="font-mono tabular-nums">Pasuje: {entriesPl(view.shown)}</span>
                  {filter.site && (
                    <button type="button" onClick={() => setCard(filter.site)} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground coarse:min-h-11">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />Karta budowy
                    </button>
                  )}
                  <button type="button" onClick={() => setFilter(NO_FILTER)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground coarse:min-h-11">
                    <X className="h-3.5 w-3.5" aria-hidden />Wyczyść filtry
                  </button>
                </p>
              )}
            </div>

            {view.days.length === 0 ? (
              <StatusPanel
                size="inline"
                tone={filtered ? "no-results" : "empty"}
                title={filtered ? "Nic nie pasuje. Zmień słowa albo wyczyść filtry." : `Brak wpisów z ostatnich ${RECENT_DAYS} dni.`}
                className="xl:col-start-1"
              />
            ) : (
              <div className="space-y-5 xl:col-start-1">
                {view.days.map((d) => (
                  <section key={d.key} aria-label={d.label} data-journal-day={d.key}>
                    <h4 className="sticky top-(--app-header-h,0px) z-10 -mx-1 mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 bg-background/95 px-1 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm transition-[top] duration-300 ease-out motion-reduce:transition-none [html.header-hidden_&]:top-0">
                      <span className="min-w-0 truncate">{d.label}</span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        {hoursByDay.has(d.key) && (() => {
                          const h = hoursByDay.get(d.key)!;
                          const unsplit = h.work > 0 && h.sites.some((s) => s.minutes === null);
                          // Jak grupy budów pod nagłówkiem (od najnowszej); budowa z samymi godzinami — na końcu.
                          const order = (id: string) => { const i = d.sites.findIndex((g) => g.siteId === id); return i < 0 ? d.sites.length : i; };
                          return (
                            <button
                              type="button"
                              onClick={() => setHoursDay({ key: d.key, label: d.label })}
                              className={cn(
                                "-my-1 inline-flex items-center gap-1 rounded px-1 py-1 font-mono normal-case tracking-normal tabular-nums hover:bg-muted coarse:min-h-11",
                                unsplit ? "text-warning-ink" : "text-muted-foreground",
                              )}
                              aria-label={unsplit ? `${d.label}: podziel godziny między budowy` : `${d.label}: godziny na budowach`}
                              data-day-hours={d.key}
                            >
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {unsplit ? "podziel godziny" : [...h.sites].sort((x, y) => order(x.siteId) - order(y.siteId)).map((s) => formatHoursShort(s.minutes ?? 0)).join(" + ") + " h"}
                            </button>
                          );
                        })()}
                        <span className="font-mono normal-case tracking-normal tabular-nums">{entriesPl(d.count)}</span>
                      </span>
                    </h4>
                    <div className="space-y-3">
                      {d.sites.map((g) => (
                        <div key={g.siteId}>
                          {g.siteId ? (
                            <div className="mb-1 flex min-w-0 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCard(g.siteId)}
                                aria-label={`${g.site}: karta budowy`}
                                className="-mx-1 flex min-w-0 max-w-full items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-foreground/80 hover:bg-muted hover:text-foreground coarse:min-h-11"
                                data-journal-site={g.site}
                              >
                                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden />
                                <span className="truncate">{g.site}</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              </button>
                              {(() => {
                                const m = hoursByDay.get(d.key)?.sites.find((s) => s.siteId === g.siteId)?.minutes;
                                return typeof m === "number" && m > 0 && (
                                  <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground" data-site-hours title="Godziny na tej budowie">
                                    {formatHoursShort(m)} h
                                  </span>
                                );
                              })()}
                              {/* Postęp etapów obok, nie w przycisku — nazwa budowy zostaje czysta. */}
                              {stagesBySite.has(g.siteId) && (
                                <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground" data-site-progress title="Etapy budowy">
                                  etapy {stagesBySite.get(g.siteId)!.done}/{stagesBySite.get(g.siteId)!.total}
                                </span>
                              )}
                            </div>
                          ) : d.sites.length > 1 && (
                            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground/80" data-journal-site="">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-ink" aria-hidden />
                              <span className="truncate">Bez budowy</span>
                            </p>
                          )}
                          <ul>
                            {g.entries.map((e) => <JournalItem key={e.id} entry={e} onPractice={onPractice} onTopic={(t) => patch({ topic: t })} onZoom={(refs, index) => setZoom({ refs, index })} />)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {view.older > 0 && (
              <Button variant="outline" className="mt-4 w-full coarse:h-11 xl:col-start-1 xl:self-start" onClick={() => setShowOlder(true)}>
                Pokaż starsze ({entriesPl(view.older)})
              </Button>
            )}
          </>
        )}
      </section>
      <JournalEntrySheet onPractice={onPractice} />
      <NewSiteDialog open={newSiteOpen} onOpenChange={setNewSiteOpen} dir={dir} onCreated={(id) => setCard(id)} />
      <JournalReportDialog open={report} onOpenChange={setReport} journal={study.journal} sites={dir} initialSite={reportSite ?? filter.site} initialRequest={reportRequest} />
      <DayHoursDialog day={hoursDay?.key ?? null} label={hoursDay?.label ?? ""} onOpenChange={(o) => { if (!o) setHoursDay(null); }} />
      <SiteCardDialog
        siteId={card}
        onOpenChange={(o) => { if (!o) setCard(null); }}
        onShowEntries={(id) => { setCard(null); setFilter({ ...NO_FILTER, site: id }); }}
        onReport={(id) => { setCard(null); setReportSite(id); setReportRequest(null); setReport(true); }}
      />
      <Dialog open={zoom !== null} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent
          className="max-w-3xl p-3"
          data-testid="journal-photo-zoom"
          onKeyDown={(ev) => {
            if (!zoom || zoom.refs.length < 2) return;
            if (ev.key === "ArrowRight") { ev.preventDefault(); setZoom({ ...zoom, index: (zoom.index + 1) % zoom.refs.length }); }
            if (ev.key === "ArrowLeft") { ev.preventDefault(); setZoom({ ...zoom, index: (zoom.index - 1 + zoom.refs.length) % zoom.refs.length }); }
          }}
        >
          <DialogTitle className="sr-only">Zdjęcie z budowy</DialogTitle>
          {zoom && (
            <div className="relative">
              <NoteImage key={zoom.refs[zoom.index]} imageRef={zoom.refs[zoom.index]} alt={`Zdjęcie z budowy ${zoom.index + 1} z ${zoom.refs.length}`} loading="eager" className="max-h-[80dvh] w-full rounded-lg object-contain" />
              {zoom.refs.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoom({ ...zoom, index: (zoom.index - 1 + zoom.refs.length) % zoom.refs.length })}
                    aria-label="Poprzednie zdjęcie"
                    className="pressable absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom({ ...zoom, index: (zoom.index + 1) % zoom.refs.length })}
                    aria-label="Następne zdjęcie"
                    className="pressable absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                  <p className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2.5 py-0.5 font-mono text-xs tabular-nums text-white" aria-live="polite" data-testid="journal-photo-counter">
                    {zoom.index + 1}/{zoom.refs.length}
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Jeden wiersz przypomnienia: ⚠ w kolorze ostrzeżenia, treść i przycisk pokazujący wpisy, których dotyczy. */
/** Arkusz nowego wpisu z budową i tematem próby — dla przypomnienia „montaż bez protokołu próby”. */
function openTestEntry(siteName: string) {
  setSite(siteName);
  patchJournalDraft({ topic: "proba-wody" });
  openJournalSheet();
}

function ReminderRow({ reminder: r, onShow }: { reminder: StudyReminder; onShow: () => void }) {
  const text =
    r.kind === "stale-problems"
      ? `${r.count} ${pluralPl(r.count, ["problem", "problemy", "problemów"])} otwarte od ponad 3 dni`
      : r.kind === "late-order"
        ? `Budowa „${r.site}”: zamówione ponad 3 dni temu i nie dojechało — ${r.items.slice(0, 3).join(", ")}${r.items.length > 3 ? ` i ${r.items.length - 3} więcej` : ""}.`
        : r.kind === "service-due"
          ? `Serwis „${r.site}” na dziś: ${r.items.slice(0, 3).join(", ")}${r.items.length > 3 ? ` i ${r.items.length - 3} więcej` : ""}.`
          : r.kind === "pre-cover-test"
            ? `Budowa „${r.site}”: instalacja odhaczona, a protokołu próby nie ma. Zrób próbę przed zakryciem.`
            : `Budowa „${r.site}”: montaż bez protokołu próby. Zapisz próbę przed zakryciem.`;
  return (
    <li className="flex items-start gap-2.5 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm" data-reminder={r.kind}>
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">{text}</p>
      <button
        type="button"
        onClick={onShow}
        className="pressable shrink-0 self-center rounded-full border border-warning/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-warning/20 coarse:min-h-11 coarse:px-3.5 coarse:text-sm"
      >
        {r.kind === "stale-problems" ? "Pokaż otwarte" : r.kind === "late-order" || r.kind === "service-due" || r.kind === "pre-cover-test" ? "Karta budowy" : r.kind === "no-test" ? "Dodaj próbę" : "Pokaż wpisy budowy"}
      </button>
    </li>
  );
}

function JournalItem({ entry: e, onPractice, onTopic, onZoom }: { entry: JournalEntry; onPractice: (topicId: string) => void; onTopic: (topicId: string) => void; onZoom: (refs: string[], index: number) => void }) {
  const lists = useStudyLists();
  const total = lists.checklist.filter((c) => c.topic === e.topic).length;
  const resolved = e.kind === "problem" && e.resolved !== undefined;
  /** Pole „Jak rozwiązane?” otwarte — samo po oznaczeniu problemu jako rozwiązanego, jeśli brak opisu. */
  const [solving, setSolving] = useState(false);

  function toggleResolved() {
    haptic(resolved ? "tap" : "success");
    setProblemResolved(e.id, !resolved);
    setSolving(!resolved && !e.solution);
  }

  return (
    // Wpis jak linijka w zeszycie: godzina na marginesie, linia oddziela wpisy zamiast ramki.
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 border-b border-dashed border-border/70 py-3 first:pt-1 last:border-b-0" data-journal-entry={e.kind} data-resolved={resolved || undefined}>
      <time
        dateTime={new Date(e.at).toISOString()}
        className="border-r border-primary/30 pr-2 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground"
      >
        {new Date(e.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
      </time>
      <div className="flex min-w-0 items-start gap-2.5">
        {resolved ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <KindIcon kind={e.kind} />}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap wrap-break-word text-sm leading-snug">{e.text || (e.test ? "Próba szczelności" : e.fittings?.length ? "Kształtki" : e.checked.length ? "Sprawdzone punkty listy" : e.recordings?.length ? "Nagranie" : e.images.length ? "Zdjęcie" : "Wpis")}</p>
          {e.fittings && e.fittings.length > 0 && (
            <p className="mt-1 inline-flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="journal-fittings">
              <Package className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{fittingsLine(e.fittings)}
            </p>
          )}
          {e.test && (
            <p className={cn("mt-1 inline-flex items-start gap-1.5 text-xs font-medium", e.test.ok ? "text-success-ink" : "text-destructive-ink")} data-testid="journal-test">
              <Gauge className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />{testLine(e.test)}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{resolved ? "Problem rozwiązany" : KIND_LABEL[e.kind]}</span>
            {e.geo && (
              // „Tu jestem” — gdzie zapisano wpis; link do map, tylko w aplikacji (raport tego nie zawiera).
              <a href={mapsUrl(e.geo)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline" data-testid="journal-entry-geo">
                <MapPin className="h-3 w-3" aria-hidden />Mapa
              </a>
            )}
            {e.topic && (
              // Pigułka tematu filtruje dziennik po temacie — ćwiczenie jest pod jawnym „Ćwicz teraz”.
              <button
                type="button"
                onClick={() => onTopic(e.topic!)}
                className="pressable rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10 hover:text-primary-ink coarse:min-h-11 coarse:px-3 coarse:text-sm"
                title="Pokaż wpisy z tego tematu"
                aria-label={`Pokaż wpisy z tematu: ${topicTitle(e.topic)}`}
              >
                {topicTitle(e.topic)}
              </button>
            )}
            {e.checked.length > 0 && <span className="tabular-nums">punkty {e.checked.length}/{total}</span>}
          </div>
          {e.kind === "problem" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleResolved}
                className={cn(
                  "pressable inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3.5 coarse:text-sm",
                  resolved ? "border-border text-muted-foreground hover:text-foreground" : "border-warning/60 bg-warning/10 font-medium text-foreground hover:bg-warning/20",
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {resolved ? "Otwórz ponownie" : "Oznacz jako rozwiązany"}
              </button>
              {/* Otwarty problem z tematem: od razu runda pytań z tego tematu — teoria tam, gdzie praktyka zawiodła. */}
              {!resolved && e.topic && (
                <button
                  type="button"
                  onClick={() => onPractice(e.topic!)}
                  aria-label={`Ćwicz teraz: ${topicTitle(e.topic)}`}
                  className="pressable inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary-ink hover:bg-primary/10 coarse:min-h-11 coarse:px-3.5 coarse:text-sm"
                >
                  <Play className="h-3.5 w-3.5" aria-hidden />Ćwicz teraz
                </button>
              )}
            </div>
          )}
          {resolved && <SolutionLine entry={e} editing={solving} onEditing={setSolving} />}
          {e.recordings && e.recordings.length > 0 && (
            <ul className="mt-2 space-y-2" aria-label="Nagrania wpisu">
              {e.recordings.map((a) => (
                <li key={a.hash} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <Suspense fallback={null}><AudioPreview attachment={a} /></Suspense>
                </li>
              ))}
            </ul>
          )}
          {e.images.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Zdjęcia wpisu">
              {e.images.map((ref) => (
                <li key={ref}>
                  <button type="button" onClick={() => onZoom(e.images, e.images.indexOf(ref))} aria-label="Powiększ zdjęcie" className="block overflow-hidden rounded-lg">
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

/**
 * Jak problem rozwiązano — jedno-dwa zdania pod rozwiązanym problemem („wymieniona złączka, dokręcony
 * śrubunek”). Trafia do raportu i do „Moich rozwiązań” przy temacie na tablicy Nauki.
 */
function SolutionLine({ entry: e, editing, onEditing }: { entry: JournalEntry; editing: boolean; onEditing: (v: boolean) => void }) {
  const [text, setText] = useState(e.solution ?? "");
  useEffect(() => { if (editing) setText(e.solution ?? ""); }, [editing, e.solution]);

  if (editing) {
    return (
      <form
        className="mt-2 flex flex-wrap gap-2"
        aria-label="Jak rozwiązane"
        onSubmit={(ev) => { ev.preventDefault(); setProblemSolution(e.id, text); haptic("success"); onEditing(false); }}
      >
        <input
          autoFocus
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          maxLength={JOURNAL_SOLUTION_MAX}
          placeholder="Jak rozwiązane? np. wymieniona złączka"
          aria-label="Jak rozwiązane?"
          className="h-9 min-w-0 flex-1 basis-56 rounded-lg border border-input bg-background px-2.5 text-base outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
        />
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onEditing(false)} className="coarse:h-11">Pomiń</Button>
      </form>
    );
  }
  if (e.solution) {
    return (
      <p className="mt-1.5 flex items-start gap-1.5 text-xs text-foreground/80" data-testid="journal-solution">
        <Wrench className="mt-px h-3.5 w-3.5 shrink-0 text-success-ink" aria-hidden />
        <span className="min-w-0"><span className="font-medium">Rozwiązanie:</span> {e.solution}</span>
        <button type="button" onClick={() => onEditing(true)} className="shrink-0 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">Zmień</button>
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onEditing(true)}
      className="pressable mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11"
    >
      <Wrench className="h-3.5 w-3.5" aria-hidden />Jak rozwiązane?
    </button>
  );
}
