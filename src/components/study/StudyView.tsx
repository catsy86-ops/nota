import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { MODULES, TOPICS } from "@/lib/study/content";
import { STUDY_TOPIC_PARAM } from "@/lib/study/questionSearch";
import { columnOf, dueToday, useStudy } from "@/lib/study/store";
import { pluralPl } from "@/lib/plural";
import { ChartColumn, CircleQuestionMark, RotateCcw } from "lucide-react";
import { openGuide } from "@/lib/guides";
import { WorkGuide } from "@/components/guide/WorkGuide";
import { StudyStatsDialog } from "./StudyStats";
import { HeightsButton } from "./HeightsSheet";
import { CalculatorsButton } from "./CalculatorsSheet";
import { STUDY_DUE_PARAM } from "@/components/review/TodayStudyCard";
import { setJournalDraftTopic } from "@/lib/study/draft";
import { useStudyReady } from "@/lib/study/data";
import { CardSkeleton, ViewSkeleton } from "@/components/ViewSkeleton";
import { closeJournalSheet, JOURNAL_ENTRY_PARAM, JOURNAL_VOICE_PARAM, openJournalSheet, requestVoiceOnOpen, useJournalSheet } from "@/lib/study/entrySheet";
import { JOURNAL_REPORT_PARAM, parseReportParam, requestJournalReport, useJournalReportRequest } from "@/lib/study/reportLink";
import { readSiteParam } from "@/lib/study/siteLink";
import { CUSTOM_PREFILL_EVENT, type CustomPrefill } from "@/lib/study/customPrefill";
import { CustomQuestionsDialog } from "./CustomQuestionsDialog";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { trackUse } from "@/lib/study/usage";
import { measureSpan, startPerfProbe } from "@/lib/study/perf";
import { useLocation, useNavigate } from "react-router-dom";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { useHiddenViews, isViewShown } from "@/lib/hiddenViews";
import { loadPlansView, preloadView } from "@/lib/viewPreload";
import { PLAN_PARAM } from "@/lib/plans/planParam";
import { useDayClock } from "@/lib/dayClock";
import { MOBILE_QUERY } from "@/hooks/use-mobile";
import { PLANS_TAB_VALUE, readStudyTab, STUDY_TAB_PARAM, writeStudyTab } from "@/lib/study/tab";
import { QuizPanel, type QuizScope } from "./QuizPanel";
import { StudyBoard } from "./StudyBoard";
import { StudyChecklist } from "./StudyChecklist";
import { StudyJournal } from "./StudyJournal";

/**
 * Pasek opanowania (nowy plan 3.5): jeden odcinek na moduł zamiast 18 kwadracików.
 * Ciemna część to „Umiem”, jasna „W trakcie”. Tematy są na Tablicy, tu tylko postęp i pieczątka.
 */
const TAB = "shrink-0 flex-1 sm:flex-none coarse:min-h-11";

function MasteryStrip() {
  const study = useStudy();
  const done = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  const doing = TOPICS.filter((t) => columnOf(study, t.id) === "doing").length;
  return (
    <div className="space-y-3">
      <Stat label="Opanowane tematy" size="lg" tone="primary" value={<span data-testid="mastery-count">{done}</span>}
        suffix={`z ${TOPICS.length}`} hint={doing > 0 ? `${doing} w trakcie` : undefined} />
      <div className="space-y-2" role="group" aria-label={`Opanowane tematy: ${done} z ${TOPICS.length}`}>
        {MODULES.map((m) => {
          const topics = TOPICS.filter((t) => t.module === m.id);
          if (topics.length === 0) return null;
          const modDone = topics.filter((t) => columnOf(study, t.id) === "done").length;
          const modDoing = topics.filter((t) => columnOf(study, t.id) === "doing").length;
          return (
            <div key={m.id} className="flex items-center gap-3" data-mastery-module={m.id}>
              <span className="w-28 shrink-0 truncate text-sm sm:w-36">{m.label}</span>
              <div
                role="img"
                aria-label={`${m.label}: ${modDone} z ${topics.length} w „Umiem”${modDoing > 0 ? `, ${modDoing} w trakcie` : ""}`}
                className="flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <span className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(modDone / topics.length) * 100}%` }} />
                <span className="h-full bg-primary/35 transition-[width] duration-500" style={{ width: `${(modDoing / topics.length) * 100}%` }} />
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {modDone === topics.length && (
                  // Pieczątka: moduł cały w „Umiem” — krzywo, jak stempel w zeszycie.
                  <span data-mastery-stamp className="-rotate-3 rounded-sm border-2 border-success-ink px-1.5 text-2xs font-semibold uppercase leading-4 tracking-widest text-success-ink">Umiem</span>
                )}
                <span className="w-12 text-right font-mono text-sm tabular-nums">{modDone}/{topics.length}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** „Na dziś: N” pod paskiem opanowania — skrót do rundy powtórek z każdej zakładki. */
function DueTodayChip({ onClick }: { onClick: () => void }) {
  const study = useStudy();
  // Po północy liczba „na dziś” ma się przeliczyć sama, bez przeładowania.
  useDayClock();
  const n = dueToday(study).length;
  if (n === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="due-chip"
      className="pressable inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary-ink coarse:min-h-11"
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">Na dziś: {n}</span>
      <span className="font-normal text-muted-foreground">{pluralPl(n, ["powtórka", "powtórki", "powtórek"])}</span>
    </button>
  );
}

/** Szkielet na czas wczytywania Yjs: dwie karty o wysokości prawdziwych, bez migotania przy pierwszym renderze. */
function StudySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Wczytywanie Pracy" data-testid="study-skeleton">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

// Plany (Analizator planów) poza precache (D2) — zakładka ładuje je dopiero przy wejściu.
const PlansView = lazy(loadPlansView);

const TOOL_PILL = "pressable inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11";

/** Rząd narzędzi Pracy (nowy plan 3.5): każdy przycisk ma ikonę i podpis, na wąskim ekranie zawija się. */
function StudyTools({ onStats, className }: { onStats: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <button type="button" onClick={onStats} className={TOOL_PILL}>
        <ChartColumn className="h-4 w-4" aria-hidden />Statystyki
      </button>
      <HeightsButton />
      <CalculatorsButton />
      <button type="button" onClick={() => openGuide("work")} aria-label="Przewodnik po Pracy" className={TOOL_PILL}>
        <CircleQuestionMark className="h-4 w-4" aria-hidden />Przewodnik
      </button>
    </div>
  );
}

/** Dział „Praca” (dawniej „Nauka”): quiz, tablica tematów, lista do nauki z materiałów G-HEAT, dziennik i Plany. */
export default function StudyView() {
  // Do wczytania dokumentu szkielet o kształcie widoku, a nie pusty ekran — pusta Nauka mignęłaby zerami (§8 D3).
  return useStudyReady() ? <StudyScreen /> : <StudySkeleton />;
}

function StudyScreen() {
  // Zapamiętana zakładka; bez zapisu telefon zaczyna od Dziennika (`lib/study/tab.ts`).
  const hiddenViews = useHiddenViews();
  const plansShown = isViewShown(hiddenViews, "plans");
  const [storedTab, setTabState] = useState<string>(() => readStudyTab(window.matchMedia?.(MOBILE_QUERY).matches ?? false));
  // Ukryte Plany (Ustawienia → widoki) chowają zakładkę; zapamiętana zakładka „plans” wraca wtedy do Quizu.
  const tab = storedTab === "plans" && !plansShown ? "quiz" : storedTab;
  const location = useLocation();
  const navigate = useNavigate();
  const setTab = (t: string) => { setTabState(t); writeStudyTab(t); };
  // Wyjście z Planów zdejmuje otwartą analizę z adresu — inaczej „wstecz” i odświeżenie wracałyby do edytora.
  // Tylko przy przejściu z „plans” na inną zakładkę: link `?analiza=` przy wejściu ma najpierw otworzyć Plany.
  const prevTab = useRef(tab);
  useEffect(() => { startPerfProbe(); }, []);
  useEffect(() => { const done = measureSpan(`zakladka-${tab}`); trackUse(`zakladka-${tab}`); done(); }, [tab]);
  useEffect(() => {
    const left = prevTab.current === "plans" && tab !== "plans";
    prevTab.current = tab;
    const params = new URLSearchParams(location.search);
    if (!left || !params.has(PLAN_PARAM)) return;
    params.delete(PLAN_PARAM);
    const rest = params.toString();
    navigate({ pathname: location.pathname, search: rest ? `?${rest}` : "" }, { replace: true });
  }, [tab, location.pathname, location.search, navigate]);
  // Plany z adresu: `?zakladka=plany` (go("plans"), paleta, `g r`), stary `/plany` albo link do analizy `?analiza=`.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromOldPath = location.pathname.replace(/\/+$/, "") === "/plany";
    const wantsPlans = fromOldPath || params.get(STUDY_TAB_PARAM) === PLANS_TAB_VALUE || params.has(PLAN_PARAM);
    if (!wantsPlans || !plansShown) return;
    setTabState("plans");
    writeStudyTab("plans");
    if (!fromOldPath && !params.has(STUDY_TAB_PARAM)) return;
    params.delete(STUDY_TAB_PARAM);
    const rest = params.toString();
    navigate({ pathname: "/praca", search: rest ? `?${rest}` : "" }, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.state, plansShown, navigate]);
  const [scope, setScope] = useState<QuizScope>({ kind: "all" });
  const [statsOpen, setStatsOpen] = useState(false);
  const study = useStudy();
  const masteredCount = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  // `run` wymusza świeży start, także gdy ćwiczysz ten sam temat drugi raz.
  const [run, setRun] = useState(0);
  // Problem zamieniony w pytanie (§4.2): jeden dialog dla całego ekranu, otwierany zdarzeniem.
  const [prefill, setPrefill] = useState<CustomPrefill | null>(null);
  const [ownOpen, setOwnOpen] = useState(false);
  useEffect(() => {
    const onPrefill = (e: Event) => { setPrefill((e as CustomEvent<CustomPrefill>).detail); setOwnOpen(true); };
    window.addEventListener(CUSTOM_PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(CUSTOM_PREFILL_EVENT, onPrefill);
  }, []);
  const practice = (topic: string) => { setScope({ kind: "topic", topic }); setRun((n) => n + 1); setTab("quiz"); };
  const changeScope = (s: QuizScope) => { setScope(s); setRun((n) => n + 1); };
  // P4.2: wynik szukania pytań w palecie (`/praca?temat=<id>`) — quiz z tego tematu.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topic = params.get(STUDY_TOPIC_PARAM);
    if (!topic) return;
    params.delete(STUDY_TOPIC_PARAM);
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    if (TOPICS.some((t) => t.id === topic)) practice(topic);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // „Powtórz” z karty na stronie „Dziś” (`/praca?powtorka=1`): od razu quiz „Na dziś”.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(STUDY_DUE_PARAM)) return;
    params.delete(STUDY_DUE_PARAM);
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    setScope({ kind: "due" });
    setRun((n) => n + 1);
    setTab("quiz");
  }, []);
  // Z karty tematu „Wpis z budowy” otwiera dziennik z już wybranym tematem.
  // Zmienia tylko temat szkicu — niezapisany tekst i zdjęcia zostają.
  const openJournal = (topic: string) => { setJournalDraftTopic(topic); openJournalSheet(true); };

  // Arkusz wpisu otwierany z zewnątrz („+” w dolnym pasku, skrót z ekranu głównego) pokazuje też listę wpisów pod spodem.
  const sheet = useJournalSheet();
  useEffect(() => { if (sheet.open) setTab("journal"); }, [sheet.open]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(JOURNAL_ENTRY_PARAM)) return;
    params.delete(JOURNAL_ENTRY_PARAM);
    if (params.get(JOURNAL_VOICE_PARAM) === "1") requestVoiceOnOpen();
    params.delete(JOURNAL_VOICE_PARAM);
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    openJournalSheet();
  }, []);
  // Raport dnia z przypomnienia (dymek albo powiadomienie `?raport=dzis`): Dziennik otworzy okno raportu.
  const reportRequested = useJournalReportRequest();
  useEffect(() => { if (reportRequested) setTab("journal"); }, [reportRequested]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(JOURNAL_REPORT_PARAM)) return;
    const req = parseReportParam(params.get(JOURNAL_REPORT_PARAM) ?? "");
    params.delete(JOURNAL_REPORT_PARAM);
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    requestJournalReport(req);
  }, []);
  // Link do karty budowy (`?budowa=`) ma otworzyć Dziennik, bo tam leży karta.
  useEffect(() => { if (readSiteParam() !== null) setTab("journal"); }, []);
  // Wyjście z Nauki zamyka arkusz — inaczej otworzyłby się sam przy powrocie.
  useEffect(() => closeJournalSheet, []);

  // Aktywna zakładka zawsze w polu widzenia przewijanego paska (np. Plany po wejściu z linku).
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tabsRef.current?.querySelector<HTMLElement>('[data-state="active"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tab]);

  return (
    <div className="space-y-6" data-testid="study-view">
      <WorkGuide />
      <CustomQuestionsDialog open={ownOpen} onOpenChange={setOwnOpen} prefill={prefill} />
      {/* Na Dzienniku nauka schodzi do jednego wiersza — na budowie liczy się „+ Wpis” i lista, nie pasek opanowania.
          Bez własnego tytułu: „Praca” jest w główce kartki, „Dziennik” w zakładce (plan wyglądu, Faza 1). */}
      {/* Plany nie mają nic wspólnego z nauką: bez paska opanowania nad nimi, edytor planu dostaje całą wysokość. */}
      {tab === "plans" ? null : tab === "journal" ? (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2" data-study-header="compact">
          <button
            type="button"
            onClick={() => setTab("board")}
            className="pressable inline-flex items-baseline rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11 coarse:items-center"
            aria-label={`Opanowane tematy: ${masteredCount} z ${TOPICS.length} — otwórz tablicę`}
          >
            <span className="font-mono font-semibold tabular-nums text-primary-ink" data-testid="mastery-count">{masteredCount}</span>
            <span className="font-mono tabular-nums">/{TOPICS.length}</span>
            <span className="ml-1 text-xs">tematów</span>
          </button>
          <DueTodayChip onClick={() => { changeScope({ kind: "due" }); setTab("quiz"); }} />
          <StudyTools onStats={() => setStatsOpen(true)} className="ml-auto" />
          <StudyStatsDialog open={statsOpen} onOpenChange={setStatsOpen} onPractice={() => { setStatsOpen(false); changeScope({ kind: "all" }); setTab("quiz"); }} />
        </header>
      ) : (
        <header className="space-y-4" data-study-header="full">
          {/* Bez h2 „Nauka” (plan UI 2026-11-06, 3.1): pod h1 „Praca” od razu zakładki, trzeci poziom tytułu był szumem. */}
          <p className="ui-hint">Poradnik „Woda użytkowa” i listy kontrolne G-HEAT, KAN-therm UltraLine.</p>
          <MasteryStrip />
          <div className="flex flex-wrap items-center gap-2">
            <DueTodayChip onClick={() => { changeScope({ kind: "due" }); setTab("quiz"); }} />
            <StudyTools onStats={() => setStatsOpen(true)} />
          </div>
          <StudyStatsDialog open={statsOpen} onOpenChange={setStatsOpen} onPractice={() => { setStatsOpen(false); changeScope({ kind: "all" }); setTab("quiz"); }} />
        </header>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        {/* Na wąskim ekranie (albo przy dużym tekście) zakładki przewijają się w bok zamiast łamać się w dwie linie. */}
        <TabsList ref={tabsRef} className="h-auto w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-auto">
          <TabsTrigger value="quiz" className={TAB}>Quiz</TabsTrigger>
          <TabsTrigger value="board" className={TAB}>Tablica</TabsTrigger>
          <TabsTrigger value="list" className={TAB} aria-label="Lista kontrolna"><span className="sm:hidden">Lista</span><span className="max-sm:hidden">Lista kontrolna</span></TabsTrigger>
          <TabsTrigger value="journal" className={TAB}>Dziennik</TabsTrigger>
          {plansShown && (
            <TabsTrigger value="plans" onPointerDown={() => preloadView("plans")} onFocus={() => preloadView("plans")} className={TAB}>Plany</TabsTrigger>
          )}
        </TabsList>
        {/* forceMount: runda w toku nie ginie po zajrzeniu do tablicy lub listy. */}
        <TabsContent value="quiz" forceMount className="mt-4 data-[state=inactive]:hidden">
          <QuizPanel key={run} scope={scope} onScopeChange={changeScope} />
        </TabsContent>
        <TabsContent value="board" className="mt-4"><StudyBoard onPractice={practice} onJournal={openJournal} /></TabsContent>
        <TabsContent value="list" className="mt-4"><StudyChecklist /></TabsContent>
        <TabsContent value="journal" className="mt-4">
          <StudyJournal onPractice={practice} />
        </TabsContent>
        {plansShown && (
          <TabsContent value="plans" className="mt-4">
            <ViewErrorBoundary name="Plany">
              <Suspense fallback={<ViewSkeleton view="plans" />}>
                <PlansView />
              </Suspense>
            </ViewErrorBoundary>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
