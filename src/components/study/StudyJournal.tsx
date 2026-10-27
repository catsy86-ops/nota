import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Clock, ChevronRight, FileText, MapPin, Plus, Search, X } from "lucide-react";
import { studyReminders } from "@/lib/study/reminders";
import { useDayClock } from "@/lib/dayClock";
import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/StatusPanel";
import { EmptySketch } from "@/components/EmptyIllustration";
import { JOURNAL_GLYPH } from "@/lib/emptyGlyphs";
import { cn } from "@/lib/utils";
import { useLatestRef } from "@/hooks/useLatestRef";
import { TOPICS, topicTitle } from "@/lib/study/content";
import { openProblems, setSite, useSiteDirectory, useStudy, useStudyLists } from "@/lib/study/store";
import {
  contextSiteName, entriesPl, filterJournal, groupJournal, isFiltered, NO_FILTER, OLDER_STEP, problemsPl, RECENT_DAYS, splitRecent,
  type JournalFilter, type KindFilter,
} from "@/lib/study/journalView";
import { patchJournalDraft, useHasJournalDraft } from "@/lib/study/draft";
import { openJournalSheet } from "@/lib/study/entrySheet";
import { JournalEntrySheet } from "./JournalEntrySheet";
import { JournalItem } from "./JournalItem";
import { JournalReportDialog } from "./JournalReport";
import { SiteCardDialog } from "./SiteCardDialog";
import { PhotoGalleryDialog } from "./PhotoGallery";
import { ReminderRow } from "./ReminderRow";
import { readSiteParam, takeSiteParam } from "@/lib/study/siteLink";
import { NewSiteDialog } from "./NewSiteDialog";
import { DayHoursDialog } from "./DayHoursDialog";
import { EntryCheckCard } from "./EntryCheck";
import { useShifts } from "@/lib/shifts";
import { formatHoursShort } from "@/lib/shifts/time";
import { dayKeyOf, workOn } from "@/lib/study/report";
import { dayHours, type DayHours } from "@/lib/study/siteHours";
import { consumeJournalReportRequest, useJournalReportRequest, type JournalReportRequest } from "@/lib/study/reportLink";
import { stageName, stageProgress } from "@/lib/study/stages";
import { entrySiteId } from "@/lib/study/sites";

const DAY_MS = 24 * 60 * 60 * 1000;

const KIND_CHIPS: { value: KindFilter | null; label: string }[] = [
  { value: null, label: "Wszystkie" },
  { value: "ok", label: "Zrobione" },
  { value: "problem", label: "Problemy" },
  { value: "open", label: "Otwarte" },
  { value: "note", label: "Notatki" },
];

const selectClass =
  "h-9 w-full min-w-0 truncate rounded-control border border-input bg-background px-2 text-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 sm:w-auto sm:max-w-56";

/**
 * Dziennik z budowy: na górze to, co już zapisane, nowy wpis w arkuszu („+ Wpis”, „+” w dolnym
 * pasku, skrót z ekranu głównego). Problem cofa temat do powtórki, a „Zrobione” liczy się jako praktyka.
 * Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego; poprawka i usunięcie wpisu — w arkuszu.
 * Oś czasu: dzień → budowa, ostatnie 30 dni (starsze porcjami za „Pokaż starsze” albo po filtrze).
 * Pisanie w arkuszu nie przerysowuje osi: dziennik słucha tylko „czy jest szkic”, a wiersze są w `memo`.
 */
export function StudyJournal({ onPractice }: { onPractice: (topicId: string) => void }) {
  const study = useStudy();
  const hasDraft = useHasJournalDraft();
  const lists = useStudyLists();
  /** Punkty listy kontrolnej na temat — „punkty 3/7” przy wpisie. */
  const pointsByTopic = useMemo(() => {
    const out = new Map<string, number>();
    for (const c of lists.checklist) out.set(c.topic, (out.get(c.topic) ?? 0) + 1);
    return out;
  }, [lists]);
  /** Powiększone zdjęcia wpisu i bieżące — galeria przewija wszystkie zdjęcia jednego wpisu. */
  const [zoom, setZoom] = useState<{ refs: string[]; index: number } | null>(null);
  const [filter, setFilter] = useState<JournalFilter>(NO_FILTER);
  /** Ile starszych niż 30 dni wpisów pokazać — „Pokaż starsze” dokłada `OLDER_STEP`. */
  const [olderShown, setOlderShown] = useState(0);
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
  // Stabilne callbacki dla wierszy w `memo` — `onPractice` z widoku bywa nowy przy każdym renderze.
  const practiceRef = useLatestRef(onPractice);
  const practice = useCallback((topicId: string) => practiceRef.current(topicId), [practiceRef]);
  const showTopic = useCallback((topic: string) => setFilter((f) => ({ ...f, topic })), []);
  const zoomPhoto = useCallback((refs: string[], index: number) => setZoom({ refs, index }), []);
  /** Nowy wpis na tej budowie (`""` = bez budowy): z filtra dziennika albo z „+ Wpis tutaj” w karcie. */
  function openEntryAt(siteName: string | null) {
    if (siteName !== null) setSite(siteName);
    openJournalSheet();
  }
  const filtered = isFiltered(filter);

  const dir = useSiteDirectory();
  const dirById = useMemo(() => new Map(dir.map((x) => [x.id, x] as const)), [dir]);
  // Link `/praca?budowa=<id>` (z Dziś albo z push): karta otwiera się od razu. Parametr zdejmujemy dopiero,
  // gdy budowa jest znana — katalog mógłby być pusty przy pierwszym renderze.
  useEffect(() => {
    const id = readSiteParam();
    if (id === null || !dirById.has(id)) return;
    takeSiteParam();
    setCard(id);
  }, [dirById]);
  // „+ Wpis” przy filtrze budowy zaczyna wpis na tej budowie; „Dokończ wpis” zostawia budowę szkicu.
  const newEntry = () => openEntryAt(hasDraft ? null : contextSiteName(filter.site, dir));
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

    if (filtered) return { days: groupJournal(matches), shown: matches.length, older: 0 };
    const { recent, older } = splitRecent(matches, Date.now(), olderShown);
    return { days: groupJournal(recent), shown: recent.length, older };
  }, [study.journal, filter, filtered, olderShown]);

  // Podział godzin każdego dnia (H2, `siteHours.ts`): zegar w nagłówku otwiera okno zawsze (1.5 planu
  // Praca 2026-10-24); godziny przy budowach i „a + b h” tylko przy kilku budowach albo wpisanych godzinach.
  const hoursByDay = useMemo(() => {
    const out = new Map<string, { split: DayHours; detailed: boolean }>();
    for (const d of view.days) {
      const work = workOn(shifts, d.key)?.minutes ?? 0;
      const split = dayHours(study.journal, study.sites, work, d.key, dayKeyOf);
      out.set(d.key, { split, detailed: split.sites.length > 1 || split.sites.some((s) => s.set) });
    }
    return out;
  }, [view.days, shifts, study.journal, study.sites]);

  const week = useMemo(() => {
    void dayTick;
    const since = Date.now() - 7 * DAY_MS;
    const recent = study.journal.filter((e) => e.at >= since);
    return { all: recent.length, problems: recent.filter((e) => e.kind === "problem").length };
  }, [study.journal, dayTick]);
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
          </div>
          <div className="flex shrink-0 gap-2">
            {study.journal.length > 0 && (
              <Button variant="outline" onClick={() => { setReportSite(null); setReportRequest(null); setReport(true); }} className="max-sm:w-9 max-sm:px-0 coarse:h-11 max-sm:coarse:w-11" title="Raport dnia albo okresu dla budowy">
                <FileText className="h-4 w-4 sm:mr-1" aria-hidden /><span className="max-sm:sr-only">Raport</span>
              </Button>
            )}
            <Button onClick={newEntry} className="coarse:h-11">
              <Plus className="mr-1 h-4 w-4" aria-hidden />{hasDraft ? "Dokończ wpis" : "Wpis"}
            </Button>
          </div>
        </header>

        <EntryCheckCard onNewEntry={openEntryAt} />

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
                  className="h-9 w-full rounded-control border border-input bg-background pl-8 pr-3 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm"
                />
              </label>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] xl:flex-wrap xl:overflow-visible" role="group" aria-label="Rodzaj wpisu">
                {KIND_CHIPS.map((c) => {
                  const on = filter.kind === c.value;
                  // Jedno sterowanie „Otwarte” z licznikiem zamiast dawnej pigułki nad listą (3.7).
                  const label = c.value === "open" && open > 0 ? `Otwarte (${open})` : c.label;
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
                      {label}
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
                    <h4 className="sticky top-(--app-header-h,0px) z-raised -mx-1 mb-2 flex items-baseline justify-between gap-2 border-b border-border/60 bg-background/95 px-1 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm transition-[top] duration-300 ease-out motion-reduce:transition-none [html.header-hidden_&]:top-0">
                      <span className="min-w-0 truncate">{d.label}</span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        {hoursByDay.has(d.key) && (() => {
                          const { split: h, detailed } = hoursByDay.get(d.key)!;
                          const unsplit = h.work > 0 && h.sites.some((s) => s.minutes === null);
                          const sum = h.sites.reduce((t, s) => t + (s.minutes ?? 0), 0);
                          // Jak grupy budów pod nagłówkiem (od najnowszej); budowa z samymi godzinami — na końcu.
                          const order = (id: string) => { const i = d.sites.findIndex((g) => g.siteId === id); return i < 0 ? d.sites.length : i; };
                          return (
                            <button
                              type="button"
                              onClick={() => setHoursDay({ key: d.key, label: d.label })}
                              className={cn(
                                "-my-1 inline-flex items-center justify-center gap-1 rounded px-1 py-1 font-mono normal-case tracking-normal tabular-nums hover:bg-muted coarse:min-h-11 coarse:min-w-11",
                                unsplit ? "text-warning-ink" : "text-muted-foreground",
                              )}
                              aria-label={unsplit ? `${d.label}: podziel godziny między budowy` : `${d.label}: godziny na budowach`}
                              data-day-hours={d.key}
                            >
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {unsplit
                                ? "podziel godziny"
                                : detailed
                                  ? [...h.sites].sort((x, y) => order(x.siteId) - order(y.siteId)).map((s) => formatHoursShort(s.minutes ?? 0)).join(" + ") + " h"
                                  : sum > 0 && `${formatHoursShort(sum)} h`}
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
                                const hd = hoursByDay.get(d.key);
                                const m = hd?.detailed ? hd.split.sites.find((s) => s.siteId === g.siteId)?.minutes : undefined;
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
                            {g.entries.map((e) => <JournalItem key={e.id} entry={e} total={(e.topic && pointsByTopic.get(e.topic)) || 0} stage={e.stage ? stageName(dirById.get(g.siteId), e.stage) : null} onPractice={practice} onTopic={showTopic} onZoom={zoomPhoto} />)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {view.older > 0 && (
              <Button variant="outline" className="mt-4 w-full coarse:h-11 xl:col-start-1 xl:self-start" onClick={() => setOlderShown((n) => n + OLDER_STEP)}>
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
        onNewEntry={(id) => { setCard(null); openEntryAt(contextSiteName(id, dir)); }}
      />
      <PhotoGalleryDialog zoom={zoom} onIndex={(index) => setZoom((z) => (z ? { ...z, index } : z))} onClose={() => setZoom(null)} />
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
