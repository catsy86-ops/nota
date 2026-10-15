import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TOPICS } from "@/lib/study/content";
import { columnOf, useStudy } from "@/lib/study/store";
import { setJournalDraftTopic } from "@/lib/study/draft";
import { useStudyReady } from "@/lib/study/data";
import { closeJournalSheet, JOURNAL_ENTRY_PARAM, openJournalSheet, useJournalSheet } from "@/lib/study/entrySheet";
import { useEffect, useState } from "react";
import { QuizPanel, type QuizScope } from "./QuizPanel";
import { StudyBoard } from "./StudyBoard";
import { StudyChecklist } from "./StudyChecklist";
import { StudyJournal } from "./StudyJournal";

/** Pasek opanowania: jedna komórka na temat — pełna = „Umiem”, połowa = „W trakcie”. */
function MasteryStrip() {
  const study = useStudy();
  const done = TOPICS.filter((t) => columnOf(study, t.id) === "done").length;
  const doing = TOPICS.filter((t) => columnOf(study, t.id) === "doing").length;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-3">
        <p className="font-display text-4xl leading-none tabular-nums text-primary-ink" data-testid="mastery-count">{done}</p>
        <p className="text-sm text-muted-foreground">z {TOPICS.length} tematów opanowanych{doing > 0 ? ` · ${doing} w trakcie` : ""}</p>
      </div>
      <div className="flex gap-1" role="img" aria-label={`Opanowane tematy: ${done} z ${TOPICS.length}`}>
        {TOPICS.map((t) => {
          const col = columnOf(study, t.id);
          return (
            <span
              key={t.id}
              title={t.title}
              className={cn(
                "h-2.5 flex-1 rounded-sm border transition-colors duration-300",
                col === "done" && "border-primary bg-primary",
                col === "doing" && "border-primary/60 bg-primary/30",
                col === "todo" && "border-border bg-transparent",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Dział „Nauka”: quiz, tablica tematów i lista do nauki z materiałów G-HEAT. */
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
          <h2 className="font-display text-2xl">Nauka: instalacje wod-kan</h2>
          <p className="text-sm text-muted-foreground">Poradnik „Woda użytkowa” i listy kontrolne G-HEAT, KAN-therm UltraLine.</p>
        </div>
        <MasteryStrip />
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full sm:w-auto">
          <TabsTrigger value="quiz" className="flex-1 sm:flex-none">Quiz</TabsTrigger>
          <TabsTrigger value="board" className="flex-1 sm:flex-none">Tablica</TabsTrigger>
          <TabsTrigger value="list" className="flex-1 sm:flex-none">Lista do nauki</TabsTrigger>
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
