import { ChevronLeft, ChevronRight, FilePlus2, NotebookPen, Play } from "lucide-react";
import { toast } from "sonner";
import { yjsStore } from "@/lib/yjsStore";
import { topicToNote } from "@/lib/study/toNote";
import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CHECKLIST, MODULES, QUESTIONS, TOPICS, type StudyTopic } from "@/lib/study/content";
import { COLUMNS, columnOf, moveTopic, practiceByTopic, useStudy, type Column, type StudyState, type TopicPractice } from "@/lib/study/store";

const COLUMN_LABEL: Record<Column, string> = { todo: "Do nauki", doing: "W trakcie", done: "Umiem" };
const COLUMN_HINT: Record<Column, string> = {
  todo: "Jeszcze nieruszone",
  doing: "Znasz zarys, wracasz do detali",
  done: "Zaliczone w quizie lub liście",
};
const moduleLabel = (id: StudyTopic["module"]) => MODULES.find((m) => m.id === id)?.label ?? id;

function TopicCard({ topic, column, study, practice, onPractice, onJournal }: { topic: StudyTopic; column: Column; study: StudyState; practice?: TopicPractice; onPractice: (topicId: string) => void; onJournal: (topicId: string) => void }) {
  const items = CHECKLIST.filter((c) => c.topic === topic.id);
  const checked = items.filter((c) => study.checked[c.id]).length;
  const critical = items.some((c) => c.critical);
  const questions = QUESTIONS.filter((q) => q.topic === topic.id).length;
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
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{moduleLabel(topic.module)}</p>
      <h4 className="mt-0.5 font-medium leading-snug">
        {topic.title}
        {critical && <span className="ml-1.5 text-primary-ink" title="Zawiera punkty krytyczne" aria-label="Zawiera punkty krytyczne">⚠</span>}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{topic.summary}</p>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="font-mono text-2xs text-muted-foreground tabular-nums">
          lista {checked}/{items.length} · pytań {questions}
          {practice && <> · budowa {practice.ok}×{practice.problem > 0 ? `, problemów ${practice.problem}` : ""}</>}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onJournal(topic.id)}
            aria-label={`${topic.title}: wpis z budowy`}
            title="Dodaj wpis z budowy do tego tematu"
            className="grid h-7 w-7 coarse:h-11 coarse:w-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <NotebookPen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPractice(topic.id)}
            aria-label={`${topic.title}: ćwicz pytania`}
            title="Ćwicz pytania z tego tematu"
            className="grid h-7 w-7 coarse:h-11 coarse:w-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const note = topicToNote(topic);
              yjsStore.upsertNote(note);
              toast.success(`Dodano notatkę „${note.title}”`);
            }}
            aria-label={`${topic.title}: zrób z tego notatkę`}
            title="Zrób notatkę z listą kontrolną"
            className="grid h-7 w-7 coarse:h-11 coarse:w-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={at === 0}
            onClick={() => moveTopic(topic.id, COLUMNS[at - 1])}
            aria-label={`${topic.title}: przenieś do „${COLUMN_LABEL[COLUMNS[Math.max(at - 1, 0)]]}”`}
            className="grid h-7 w-7 coarse:h-11 coarse:w-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={at === COLUMNS.length - 1}
            onClick={() => moveTopic(topic.id, COLUMNS[at + 1])}
            aria-label={`${topic.title}: przenieś do „${COLUMN_LABEL[COLUMNS[Math.min(at + 1, COLUMNS.length - 1)]]}”`}
            className="grid h-7 w-7 coarse:h-11 coarse:w-11 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.li>
  );
}

/** Tablica nauki: tematy wędrują „Do nauki” → „W trakcie” → „Umiem”. */
export function StudyBoard({ onPractice, onJournal }: { onPractice: (topicId: string) => void; onJournal: (topicId: string) => void }) {
  const study = useStudy();
  const practice = practiceByTopic(study.journal);
  return (
    <LayoutGroup>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const topics = TOPICS.filter((t) => columnOf(study, t.id) === col);
          return (
            <section key={col} aria-label={COLUMN_LABEL[col]} className="rounded-2xl bg-muted/40 p-3">
              <header className="px-1 pb-2.5">
                <h3 className="flex items-baseline gap-2 font-display text-base">
                  {COLUMN_LABEL[col]}
                  <span className="font-mono text-xs text-muted-foreground tabular-nums" data-testid={`count-${col}`}>{topics.length}</span>
                </h3>
                <p className="text-xs text-muted-foreground">{COLUMN_HINT[col]}</p>
              </header>
              <ul className="space-y-2.5 min-h-12">
                {topics.map((t) => <TopicCard key={t.id} topic={t} column={col} study={study} practice={practice.get(t.id)} onPractice={onPractice} onJournal={onJournal} />)}
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
