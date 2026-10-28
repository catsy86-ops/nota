import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { pluralPl } from "@/lib/plural";
import { TOPICS } from "@/lib/study/content";
import { CUSTOM_ANSWER_MAX, CUSTOM_EXPLANATION_MAX, CUSTOM_TEXT_MAX, type CustomQuestion } from "@/lib/study/custom";
import { addCustomQuestion, updateCustomQuestion, useStudy } from "@/lib/study/store";
import { parseQuestionsMd } from "@/lib/study/questionsMd";
import type { CustomPrefill } from "@/lib/study/customPrefill";
import { TopicSelect } from "./CustomChecklistForm";
import { deleteCustom } from "@/lib/study/customActions";

/** Import z .md (P4.5): każde poprawne pytanie idzie przez `addCustomQuestion` (walidacja, limit); błędy z numerami wierszy. */
async function importQuestionsMd(file: File, topic: string) {
  const { questions, errors } = parseQuestionsMd(await file.text());
  let added = 0;
  for (const q of questions) {
    if (addCustomQuestion({ topic, question: q.question, correct: q.correct, wrong: q.wrong, explanation: q.explanation })) added += 1;
  }
  const skipped = errors.length + (questions.length - added);
  if (added > 0) toast.success(`Dodano ${added} ${pluralPl(added, ["pytanie", "pytania", "pytań"])}`);
  if (skipped > 0) {
    const first = errors.slice(0, 3).map((e) => `wiersz ${e.line}: ${e.message}`).join(" ");
    toast.error(`Pominięto ${skipped} ${pluralPl(skipped, ["wpis", "wpisy", "wpisów"])}.${first ? " " + first : ""}`);
  }
  if (added === 0 && skipped === 0) toast("W pliku nie ma pytań w formacie P: / A: / N:");
}

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
export function CustomQuestionsDialog({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (open: boolean) => void; /** Szkic z rozwiązanego problemu (§4.2); nowy obiekt = nowe wypełnienie. */ prefill?: CustomPrefill | null }) {
  const study = useStudy();
  const questions = study.custom.filter((e): e is CustomQuestion => e.kind === "question");
  const [draft, setDraft] = useState<Draft>(() => EMPTY(TOPICS[0].id));
  const importRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Edycja istniejącego pytania: formularz wypełniony, zapis podmienia treść pod tym samym id (§4 P6).
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEdit = (q: CustomQuestion) => {
    setEditingId(q.id);
    setError(null);
    setDraft({ topic: q.topic, question: q.question, correct: q.correct, wrong: [...q.wrong] as Draft["wrong"], explanation: q.explanation });
  };
  const cancelEdit = () => { setEditingId(null); setError(null); setDraft(EMPTY(TOPICS[0].id)); };

  // Szkic z problemu: pytanie i poprawna odpowiedź od razu, błędne do uzupełnienia.
  useEffect(() => {
    if (!prefill) return;
    setEditingId(null);
    setError(null);
    setDraft({ ...EMPTY(prefill.topic && TOPICS.some((t) => t.id === prefill.topic) ? prefill.topic : TOPICS[0].id), question: prefill.question, correct: prefill.correct });
  }, [prefill]);

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
    const input = {
      topic: draft.topic,
      question: draft.question.trim(),
      correct: draft.correct.trim(),
      wrong: draft.wrong.map((w) => w.trim()) as Draft["wrong"],
      explanation: draft.explanation.trim(),
    };
    if (editingId) {
      const updated = updateCustomQuestion(editingId, input);
      if (!updated) { setError("Nie udało się zapisać zmian."); return; }
      setEditingId(null);
      setDraft(EMPTY(draft.topic));
      setError(null);
      toast.success("Zapisano zmiany w pytaniu");
      return;
    }
    const saved = addCustomQuestion(input);
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
            <Button type="submit" className="coarse:h-11">{editingId ? "Zapisz zmiany" : "Dodaj pytanie"}</Button>
            {editingId && <Button type="button" variant="ghost" onClick={cancelEdit} className="coarse:h-11">Anuluj</Button>}
            <input ref={importRef} type="file" accept=".md,.txt,text/markdown,text/plain" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void importQuestionsMd(file, draft.topic); }} />
            <Button type="button" variant="outline" onClick={() => importRef.current?.click()} className="coarse:h-11">Importuj z pliku .md</Button>
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
                  <Button variant="ghost" size="sm" aria-label={`Edytuj pytanie: ${q.question}`} onClick={() => startEdit(q)} className="coarse:h-11">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
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
