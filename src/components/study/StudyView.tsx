import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MODULES, TOPICS } from "@/lib/study/content";
import { columnOf, dueToday, useStudy } from "@/lib/study/store";
import { pluralPl } from "@/lib/plural";
import { RotateCcw } from "lucide-react";
import { setJournalDraftTopic } from "@/lib/study/draft";
import { useStudyReady } from "@/lib/study/data";
import { closeJournalSheet, JOURNAL_ENTRY_PARAM, openJournalSheet, useJournalSheet } from "@/lib/study/entrySheet";
import { useEffect, useState } from "react";
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
      <div className="flex gap-2.5" role="group" aria-label={`Opanowane tematy: ${done} z ${TOPICS.length}`}>
        {MODULES.map((m) => {
          const topics = TOPICS.filter((t) => t.module === m.id);
          if (topics.length === 0) return null;
          const modDone = topics.filter((t) => columnOf(study, t.id) === "done").length;
          return (
            <div key={m.id} className="min-w-0" style={{ flexGrow: topics.length, flexBasis: 0, minWidth: "4.5rem" }} data-mastery-module={m.id}>
              <div className="flex gap-0.5">
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
                      // Komórka cienka, cel dotyku wysoki — palec trafia bez celowania.
                      className="group -my-2 min-w-0 flex-1 py-2 focus-visible:outline-hidden"
                    >
                      <span
                        className={cn(
                          "block h-2.5 rounded-sm border transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                          col === "done" && "border-primary bg-primary",
                          col === "doing" && "border-primary/60 bg-primary/30",
                          col === "todo" && "border-border bg-transparent",
                          on && "ring-2 ring-foreground/70 ring-offset-1 ring-offset-background",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 flex items-baseline justify-between gap-1 text-2xs text-muted-foreground">
                <span className="truncate">{m.label}</span>
                <span className="shrink-0 font-mono tabular-nums">{modDone}/{topics.length}</span>
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
  const [tab, setTab] = useState("quiz");
  const [scope, setScope] = useState<QuizScope>({ kind: "all" });
  // `run` wymusza świeży start, także gdy ćwiczysz ten sam temat drugi raz.
  const [run, setRun] = useState(0);
  const practice = (topic: string) => { setScope({ kind: "topic", topic }); setRun((n) => n + 1); setTab("quiz"); };
  const changeScope = (s: QuizScope) => { setScope(s); setRun((n) => n + 1); };
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
    const rest = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (rest ? `?${rest}` : ""));
    openJournalSheet();
  }, []);
  // Wyjście z Nauki zamyka arkusz — inaczej otworzyłby się sam przy powrocie.
  useEffect(() => closeJournalSheet, []);

  return (
    <div className="space-y-6" data-testid="study-view">
      <header className="space-y-4">
        <div>
          <h2 className="font-display text-2xl">Instalacje wod-kan</h2>
          <p className="text-sm text-muted-foreground">Poradnik „Woda użytkowa” i listy kontrolne G-HEAT, KAN-therm UltraLine.</p>
        </div>
        <MasteryStrip />
        <DueTodayChip onClick={() => { changeScope({ kind: "due" }); setTab("quiz"); }} />
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full sm:w-auto">
          <TabsTrigger value="quiz" className="flex-1 sm:flex-none">Quiz</TabsTrigger>
          <TabsTrigger value="board" className="flex-1 sm:flex-none">Tablica</TabsTrigger>
          <TabsTrigger value="list" className="flex-1 sm:flex-none">Lista</TabsTrigger>
          <TabsTrigger value="journal" className="flex-1 sm:flex-none">Dziennik</TabsTrigger>
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
