import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { pluralPl } from "@/lib/plural";
import { TOPICS } from "@/lib/study/content";
import { CUSTOM_ANSWER_MAX, CUSTOM_EXPLANATION_MAX, CUSTOM_TEXT_MAX, type CustomQuestion } from "@/lib/study/custom";
import { addCustomQuestion, useStudy } from "@/lib/study/store";
import { TopicSelect } from "./CustomChecklistForm";
import { deleteCustom } from "@/lib/study/customActions";

type Draft = { topic: string; question: string; correct: string; wrong: [string, string, string]; explanation: string };
const EMPTY = (topic: string): Draft => ({ topic, question: "", correct: "", wrong: ["", "", ""], explanation: "" });

/** Walidacja po stronie formularza: komunikat przy polu, zanim zapis w ogóle pójdzie. */
function draftError(d: Draft): string | null {
  if (!d.question.trim()) return "Wpisz treść pytania.";
  if (!d.correct.trim()) return "Wpisz poprawną odpowiedź.";
  if (d.wrong.some((w) => !w.trim())) return "Wypełnij wszystkie trzy błędne odpowiedzi.";
  const all = [d.correct, ...d.wrong].map((x) => x.trim());
  if (new Set(all).size !== 4) return "Odpowiedzi muszą być różne.";
  if (d.question.trim().length > CUSTOM_TEXT_MAX) return `Pytanie ma najwyżej ${CUSTOM_TEXT_MAX} znaków.`;
  if (all.some((x) => x.length > CUSTOM_ANSWER_MAX)) return `Odpowiedź ma najwyżej ${CUSTOM_ANSWER_MAX} znaków.`;
  if (d.explanation.trim().length > CUSTOM_EXPLANATION_MAX) return `Wyjaśnienie ma najwyżej ${CUSTOM_EXPLANATION_MAX} znaków.`;
  return null;
}

/**
 * Własne pytania do quizu (N5). Formularz jak w quizie: poprawna odpowiedź i trzy
 * błędne, quiz sam miesza kolejność. Pytanie dostaje powtórki SM-2 jak materiał.
 */
export function CustomQuestionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const study = useStudy();
  const questions = study.custom.filter((e): e is CustomQuestion => e.kind === "question");
  const [draft, setDraft] = useState<Draft>(() => EMPTY(TOPICS[0].id));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (error) setError(null);
  };
  const setWrong = (i: number, value: string) => {
    setDraft((d) => ({ ...d, wrong: d.wrong.map((w, j) => (j === i ? value : w)) as Draft["wrong"] }));
    if (error) setError(null);
  };

  function save() {
    const problem = draftError(draft);
    if (problem) { setError(problem); return; }
    const saved = addCustomQuestion({
      topic: draft.topic,
      question: draft.question.trim(),
      correct: draft.correct.trim(),
      wrong: draft.wrong.map((w) => w.trim()) as Draft["wrong"],
      explanation: draft.explanation.trim(),
    });
    if (!saved) { setError("Nie udało się zapisać. Może są już 200 własnych wpisów."); return; }
    setDraft(EMPTY(draft.topic));
    setError(null);
    toast.success("Dodano pytanie do quizu");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="custom-questions">
        <div className="pr-8">
          <DialogTitle className="font-display text-lg">Moje pytania</DialogTitle>
          <DialogDescription className="text-xs">
            Pytania z czterema odpowiedziami. Quiz miesza kolejność, a pytanie wraca do powtórki jak każde inne.
          </DialogDescription>
        </div>

        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="cq-topic">Temat</Label>
            <TopicSelect id="cq-topic" value={draft.topic} onChange={(t) => set("topic", t)} ariaLabel="Temat pytania" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cq-question">Pytanie</Label>
            <Input id="cq-question" value={draft.question} maxLength={CUSTOM_TEXT_MAX} onChange={(e) => set("question", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cq-correct">Poprawna odpowiedź</Label>
            <Input id="cq-correct" value={draft.correct} maxLength={CUSTOM_ANSWER_MAX} onChange={(e) => set("correct", e.target.value)} />
          </div>
          {draft.wrong.map((w, i) => (
            <div key={i} className="space-y-1.5">
              <Label htmlFor={`cq-wrong-${i}`}>Błędna odpowiedź {i + 1}</Label>
              <Input id={`cq-wrong-${i}`} value={w} maxLength={CUSTOM_ANSWER_MAX} onChange={(e) => setWrong(i, e.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="cq-explanation">Wyjaśnienie <span className="font-normal text-muted-foreground">(opcjonalne)</span></Label>
            <Input id="cq-explanation" value={draft.explanation} maxLength={CUSTOM_EXPLANATION_MAX} onChange={(e) => set("explanation", e.target.value)} />
          </div>
          {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" className="coarse:h-11">Dodaj pytanie</Button>
          </div>
        </form>

        <section aria-label="Moje pytania" className="space-y-2 border-t border-border pt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {questions.length === 0 ? "Jeszcze nic nie dodano" : pluralPl(questions.length, ["pytanie", "pytania", "pytań"])}
          </h3>
          {questions.length > 0 && (
            <ul className="space-y-2">
              {questions.map((q) => (
                <li key={q.id} className="flex items-start gap-2 text-sm">
                  <span className="min-w-0 flex-1">
                    {q.question}
                    <span className="block text-xs text-muted-foreground">{TOPICS.find((t) => t.id === q.topic)?.title ?? q.topic}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Usuń pytanie: ${q.question}`}
                    onClick={() => deleteCustom(q, q.question)}
                    className="coarse:h-11"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
