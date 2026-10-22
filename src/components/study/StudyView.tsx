import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MODULES, TOPICS } from "@/lib/study/content";
import { columnOf, dueToday, useStudy } from "@/lib/study/store";
import { pluralPl } from "@/lib/plural";
import { ChartColumn, RotateCcw } from "lucide-react";
import { StudyStatsDialog } from "./StudyStats";
import { HeightsButton } from "./HeightsSheet";
import { CalculatorsButton } from "./CalculatorsSheet";
import { STUDY_DUE_PARAM } from "@/components/review/TodayStudyCard";
import { setJournalDraftTopic } from "@/lib/study/draft";
import { useStudyReady } from "@/lib/study/data";
import { closeJournalSheet, JOURNAL_ENTRY_PARAM, JOURNAL_VOICE_PARAM, openJournalSheet, requestVoiceOnOpen, useJournalSheet } from "@/lib/study/entrySheet";
import { JOURNAL_REPORT_PARAM, parseReportParam, requestJournalReport, useJournalReportRequest } from "@/lib/study/reportLink";
import { useEffect, useState } from "react";
import { useDayClock } from "@/lib/dayClock";
import { MOBILE_QUERY } from "@/hooks/use-mobile";
import { readStudyTab, writeStudyTab } from "@/lib/study/tab";
import { QuizPanel, type QuizScope } from "./QuizPanel";
import { StudyBoard } from "./StudyBoard";
import { StudyChecklist } from "./StudyChecklist";
import { StudyJournal } from "./StudyJournal";

const COLUMN_STATE = { todo: "do nauki", doing: "w trakcie", done: "umiem" } as const;

/**
 * Pasek opanowania: odcinek na moduł, komórka na temat — pełna = „Umiem”, połowa = „W trakcie”.
 * Dotyk komórki podpisuje temat pod paskiem (na telefonie nie ma najechania).
 */
function MasteryStrip() {
  const study = useStudy();
  const [picked, setPicked] = useState<string | null>(null);
  const done = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  const doing = TOPICS.filter((t) => columnOf(study, t.id) === "doing").length;
  const pickedTopic = TOPICS.find((t) => t.id === picked) ?? null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <p className="font-mono text-4xl font-semibold leading-none tabular-nums text-primary-ink" data-testid="mastery-count">{done}</p>
        <p className="text-sm text-muted-foreground">z {TOPICS.length} tematów opanowanych{doing > 0 ? ` · ${doing} w trakcie` : ""}</p>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-3" role="group" aria-label={`Opanowane tematy: ${done} z ${TOPICS.length}`}>
        {MODULES.map((m) => {
          const topics = TOPICS.filter((t) => t.module === m.id);
          if (topics.length === 0) return null;
          const modDone = topics.filter((t) => columnOf(study, t.id) === "done").length;
          return (
            <div key={m.id} className="min-w-0 max-w-full" data-mastery-module={m.id}>
              <div className="flex flex-wrap gap-1">
                {topics.map((t) => {
                  const col = columnOf(study, t.id);
                  const on = picked === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      title={t.title}
                      aria-label={`${t.title}: ${COLUMN_STATE[col]}`}
                      aria-pressed={on}
                      onClick={() => setPicked(on ? null : t.id)}
                      // Kratka 20 px w polu 28 px (na dotyku 44 px) — palec trafia bez celowania.
                      className="group grid size-7 shrink-0 place-items-center focus-visible:outline-hidden coarse:size-11"
                    >
                      <span
                        className={cn(
                          "block size-5 rounded-[4px] border transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                          col === "done" && "border-primary bg-primary",
                          col === "doing" && "border-primary/60 bg-primary/30",
                          // Nieopanowane: obwódka ma być widoczna na papierze (≥ 3:1), bo sama krawędź niesie stan.
                          col === "todo" && "border-foreground/50 bg-transparent",
                          on && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-background",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
                <span className="truncate">{m.label}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {modDone === topics.length && (
                    // Pieczątka: moduł cały w „Umiem” — krzywo, jak stempel w zeszycie.
                    <span data-mastery-stamp className="-rotate-3 rounded-sm border-2 border-success-ink px-1.5 text-[0.65rem] font-semibold uppercase leading-4 tracking-widest text-success-ink">Umiem</span>
                  )}
                  <span className="font-mono tabular-nums">{modDone}/{topics.length}</span>
                </span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite" data-testid="mastery-picked">
        {pickedTopic ? (
          <><span className="font-medium text-foreground">{pickedTopic.title}</span> · {COLUMN_STATE[columnOf(study, pickedTopic.id)]}</>
        ) : (
          <>
            <span className="coarse:hidden">Kliknij komórkę, żeby zobaczyć temat.</span>
            <span className="hidden coarse:inline">Dotknij komórki, żeby zobaczyć temat.</span>
          </>
        )}
      </p>
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

/** Dział „Praca” (dawniej „Nauka”): quiz, tablica tematów i lista do nauki z materiałów G-HEAT. */
export default function StudyView() {
  // Do wczytania dokumentu nic — pusta Nauka mignęłaby zerami i pustym dziennikiem.
  return useStudyReady() ? <StudyScreen /> : null;
}

function StudyScreen() {
  // Zapamiętana zakładka; bez zapisu telefon zaczyna od Dziennika (`lib/study/tab.ts`).
  const [tab, setTabState] = useState<string>(() => readStudyTab(window.matchMedia?.(MOBILE_QUERY).matches ?? false));
  const setTab = (t: string) => { setTabState(t); writeStudyTab(t); };
  const [scope, setScope] = useState<QuizScope>({ kind: "all" });
  const [statsOpen, setStatsOpen] = useState(false);
  const study = useStudy();
  const masteredCount = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  // `run` wymusza świeży start, także gdy ćwiczysz ten sam temat drugi raz.
  const [run, setRun] = useState(0);
  const practice = (topic: string) => { setScope({ kind: "topic", topic }); setRun((n) => n + 1); setTab("quiz"); };
  const changeScope = (s: QuizScope) => { setScope(s); setRun((n) => n + 1); };
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
  // Wyjście z Nauki zamyka arkusz — inaczej otworzyłby się sam przy powrocie.
  useEffect(() => closeJournalSheet, []);

  return (
    <div className="space-y-6" data-testid="study-view">
      {/* Na Dzienniku nauka schodzi do jednego wiersza — na budowie liczy się „+ Wpis” i lista, nie pasek opanowania. */}
      {tab === "journal" ? (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2" data-study-header="compact">
          <h2 className="font-display text-lg">Instalacje wod-kan</h2>
          <button
            type="button"
            onClick={() => setTab("board")}
            className="pressable inline-flex items-baseline rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11 coarse:items-center"
            aria-label={`Opanowane tematy: ${masteredCount} z ${TOPICS.length} — otwórz tablicę`}
          >
            <span className="font-mono font-semibold tabular-nums text-primary-ink" data-testid="mastery-count">{masteredCount}</span>
            <span className="font-mono tabular-nums">/{TOPICS.length}</span>
          </button>
          <DueTodayChip onClick={() => { changeScope({ kind: "due" }); setTab("quiz"); }} />
          <HeightsButton variant="icon" className="ml-auto" />
          <CalculatorsButton variant="icon" />
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            aria-label="Statystyki"
            title="Statystyki"
            className="pressable inline-grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground coarse:size-11"
          >
            <ChartColumn className="h-4 w-4" aria-hidden />
          </button>
          <StudyStatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
        </header>
      ) : (
        <header className="space-y-4" data-study-header="full">
          <div>
            <h2 className="font-display text-2xl">Instalacje wod-kan</h2>
            <p className="text-sm text-muted-foreground">Poradnik „Woda użytkowa” i listy kontrolne G-HEAT, KAN-therm UltraLine.</p>
          </div>
          <MasteryStrip />
          <div className="flex flex-wrap items-center gap-2">
            <DueTodayChip onClick={() => { changeScope({ kind: "due" }); setTab("quiz"); }} />
            <button
              type="button"
              onClick={() => setStatsOpen(true)}
              className="pressable inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground coarse:min-h-11"
            >
              <ChartColumn className="h-4 w-4" aria-hidden />Statystyki
            </button>
            <HeightsButton />
            <CalculatorsButton />
          </div>
          <StudyStatsDialog open={statsOpen} onOpenChange={setStatsOpen} />
        </header>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full sm:w-auto">
          <TabsTrigger value="quiz" className="min-w-0 flex-1 whitespace-normal text-center leading-tight sm:flex-none sm:whitespace-nowrap coarse:min-h-11">Quiz</TabsTrigger>
          <TabsTrigger value="board" className="min-w-0 flex-1 whitespace-normal text-center leading-tight sm:flex-none sm:whitespace-nowrap coarse:min-h-11">Tablica</TabsTrigger>
          <TabsTrigger value="list" className="min-w-0 flex-1 whitespace-normal text-center leading-tight sm:flex-none sm:whitespace-nowrap coarse:min-h-11">Lista kontrolna</TabsTrigger>
          <TabsTrigger value="journal" className="min-w-0 flex-1 whitespace-normal text-center leading-tight sm:flex-none sm:whitespace-nowrap coarse:min-h-11">Dziennik</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
