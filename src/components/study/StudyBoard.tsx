import { ChevronLeft, ChevronRight, FilePlusCorner, NotebookPen, Play, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useDayClock } from "@/lib/dayClock";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MOBILE_QUERY } from "@/hooks/use-mobile";
import { yjsStore } from "@/lib/yjsStore";
import { topicToNote } from "@/lib/study/toNote";
import { LayoutGroup, m as motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MODULES, TOPICS, type StudyTopic } from "@/lib/study/content";
import { COLUMNS, columnOf, dueToday, moveTopic, practiceByTopic, useStudy, useStudyLists, type Column, type StudyState, type TopicPractice } from "@/lib/study/store";

const COLUMN_LABEL: Record<Column, string> = { todo: "Do nauki", doing: "W trakcie", done: "Umiem" };
const COLUMN_HINT: Record<Column, string> = {
  todo: "Jeszcze nieruszone",
  doing: "Znasz zarys, wracasz do detali",
  done: "Zaliczone w quizie lub liście",
};
const actionClass =
  "pressable inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground coarse:h-11 coarse:px-3 coarse:text-sm";
const moveClass =
  "grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30 coarse:h-11 coarse:w-11";
const moduleLabel = (id: StudyTopic["module"]) => MODULES.find((m) => m.id === id)?.label ?? id;

/**
 * Przeniesienie tematu. Na telefonie widać jedną kolumnę naraz, więc karta znika
 * z ekranu — dymek mówi, dokąd poszła.
 */
function moveTo(topic: StudyTopic, column: Column) {
  moveTopic(topic.id, column);
  if (window.matchMedia?.(MOBILE_QUERY).matches) toast(`„${topic.title}” → ${COLUMN_LABEL[column]}`);
}

function TopicCard({ topic, column, study, practice, due, onPractice, onJournal }: { topic: StudyTopic; column: Column; study: StudyState; practice?: TopicPractice; due: number; onPractice: (topicId: string) => void; onJournal: (topicId: string) => void }) {
  const lists = useStudyLists();
  const items = lists.checklist.filter((c) => c.topic === topic.id);
  const checked = items.filter((c) => study.checked[c.id]).length;
  const critical = items.some((c) => c.critical);
  const questions = lists.questions.filter((q) => q.topic === topic.id).length;
  const at = COLUMNS.indexOf(column);

  return (
    <motion.li
      layout
      layoutId={`topic-${topic.id}`}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cn(
        "rounded-xl border bg-card p-3 text-sm shadow-sm",
        column === "done" ? "border-primary/40" : "border-border",
      )}
      data-topic={topic.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{moduleLabel(topic.module)}</p>
          <h4 className="mt-0.5 font-medium leading-snug">
            {topic.title}
            {critical && <span className="ml-1.5 inline-flex align-[-2px]" role="img" title="Zawiera punkty krytyczne" aria-label="Zawiera punkty krytyczne"><TriangleAlert className="h-3.5 w-3.5 text-warning-ink" aria-hidden /></span>}
          </h4>
        </div>
        {/* Strzałki przy tytule: przesunięcie tematu to decyzja o nim, nie akcja z listy. */}
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => moveTo(topic, COLUMNS[at - 1])}
            aria-label={`${topic.title}: przenieś do „${COLUMN_LABEL[COLUMNS[Math.max(at - 1, 0)]]}”`}
            title={at > 0 ? `Do „${COLUMN_LABEL[COLUMNS[at - 1]]}”` : undefined}
            className={moveClass}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={at === COLUMNS.length - 1}
            onClick={() => moveTo(topic, COLUMNS[at + 1])}
            aria-label={`${topic.title}: przenieś do „${COLUMN_LABEL[COLUMNS[Math.min(at + 1, COLUMNS.length - 1)]]}”`}
            title={at < COLUMNS.length - 1 ? `Do „${COLUMN_LABEL[COLUMNS[at + 1]]}”` : undefined}
            className={moveClass}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{topic.summary}</p>
      <p className="mt-2 font-mono text-2xs text-muted-foreground tabular-nums">
        lista {checked}/{items.length} · pytań {questions}
        {practice && <> · budowa {practice.ok}×{practice.problem > 0 ? `, problemów ${practice.problem}` : ""}</>}
      </p>
      {/* Ostatni problem z budowy przy temacie — otwarty wyróżniony; ćwiczenie jest obok. */}
      {practice?.lastProblem && (
        <p
          className={cn(
            "mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs leading-snug",
            practice.lastProblem.resolved === undefined ? "bg-warning/10 text-foreground" : "bg-muted/60 text-muted-foreground",
          )}
          data-topic-problem={practice.lastProblem.resolved === undefined ? "open" : "resolved"}
        >
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-warning-ink" aria-hidden />
          <span className="min-w-0">
            <span className="font-medium">{practice.lastProblem.resolved === undefined ? "Problem na budowie" : "Rozwiązany problem"}</span>
            {" "}({new Date(practice.lastProblem.at).toLocaleDateString("pl-PL", { day: "numeric", month: "numeric" })}): {practice.lastProblem.text.trim().split("\n")[0] || "bez opisu"}
          </span>
        </p>
      )}
      {/* Jak naprawiałeś to wcześniej — z rozwiązanych problemów tego tematu. */}
      {practice && practice.solutions.length > 0 && (
        <details className="mt-2 text-xs" data-topic-solutions>
          <summary className="cursor-pointer select-none font-medium text-success-ink coarse:py-2">
            Moje rozwiązania ({practice.solutions.length})
          </summary>
          <ul className="mt-1 space-y-1.5">
            {practice.solutions.map((s) => (
              <li key={s.id} className="leading-snug">
                <span className="text-muted-foreground">
                  {new Date(s.at).toLocaleDateString("pl-PL", { day: "numeric", month: "numeric" })} · {s.text.trim().split("\n")[0] || "bez opisu"}
                </span>
                <span className="block text-foreground">→ {s.solution}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-2">
        {/* Podpisy przy ikonach: na budowie nikt nie zgaduje, co robi ołówek. */}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onJournal(topic.id)}
            aria-label={`${topic.title}: wpis z budowy`}
            className={actionClass}
          >
            <NotebookPen className="h-3.5 w-3.5 shrink-0" aria-hidden />Wpis
          </button>
          <button
            type="button"
            onClick={() => onPractice(topic.id)}
            aria-label={`${topic.title}: ćwicz pytania${due > 0 ? `, ${due} na dziś` : ""}`}
            className={cn(actionClass, due > 0 && "border-primary/40 text-primary-ink")}
          >
            <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />Ćwicz
            {due > 0 && <span className="ml-0.5 stamp-tag text-2xs text-primary-ink tabular-nums" data-testid="topic-due">{due} na dziś</span>}
          </button>
          <button
            type="button"
            onClick={() => {
              const note = topicToNote(topic);
              yjsStore.upsertNote(note);
              toast.success(`Dodano notatkę „${note.title}”`);
            }}
            aria-label={`${topic.title}: do notatki`}
            title="Notatka z listą kontrolną tematu"
            className={actionClass}
          >
            <FilePlusCorner className="h-3.5 w-3.5 shrink-0" aria-hidden />Do notatki
          </button>
        </div>
      </div>
    </motion.li>
  );
}

/** Tablica nauki: tematy wędrują „Do nauki” → „W trakcie” → „Umiem”. */
export function StudyBoard({ onPractice, onJournal }: { onPractice: (topicId: string) => void; onJournal: (topicId: string) => void }) {
  const study = useStudy();
  const lists = useStudyLists();
  const practice = practiceByTopic(study.journal);
  // Pytania do powtórki dziś, policzone per temat (N3); przeliczane po północy.
  useDayClock();
  const dueByTopic = new Map<string, number>();
  for (const id of dueToday(study)) {
    const topic = lists.questions.find((q) => q.id === id)?.topic;
    if (topic) dueByTopic.set(topic, (dueByTopic.get(topic) ?? 0) + 1);
  }
  const counts = Object.fromEntries(COLUMNS.map((c) => [c, TOPICS.filter((t) => columnOf(study, t.id) === c).length])) as Record<Column, number>;
  // Telefon: jedna kolumna naraz (trzy pod sobą to długie przewijanie); start od „W trakcie”, jeśli coś tam jest.
  const [phoneCol, setPhoneCol] = useState<Column>(() => (counts.doing > 0 ? "doing" : "todo"));
  return (
    <LayoutGroup>
      <ToggleGroup
        aria-label="Kolumna tablicy"
        value={phoneCol}
        onValueChange={(v) => setPhoneCol(v as Column)}
        className="mb-3 md:hidden"
      >
        {COLUMNS.map((c) => (
          <ToggleGroupItem key={c} value={c} className="coarse:h-11">
            {COLUMN_LABEL[c]} <span className="ml-1 font-mono text-xs tabular-nums opacity-70">{counts[c]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const topics = TOPICS.filter((t) => columnOf(study, t.id) === col);
          return (
            <section key={col} aria-label={COLUMN_LABEL[col]} className={cn("rounded-card bg-muted/40 p-3", col !== phoneCol && "max-md:hidden")}>
              <header className="px-1 pb-2.5">
                <h3 className="flex items-baseline gap-2 font-display text-base">
                  {COLUMN_LABEL[col]}
                  <span className="font-mono text-xs text-muted-foreground tabular-nums" data-testid={`count-${col}`}>{topics.length}</span>
                </h3>
                <p className="text-xs text-muted-foreground">{COLUMN_HINT[col]}</p>
              </header>
              <ul className="space-y-2.5 min-h-12">
                {topics.map((t) => <TopicCard key={t.id} topic={t} column={col} study={study} practice={practice.get(t.id)} due={dueByTopic.get(t.id) ?? 0} onPractice={onPractice} onJournal={onJournal} />)}
                {topics.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Brak tematów. Przenieś tu temat strzałką.</li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
