import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOPICS } from "@/lib/study/content";
import { buildRound, missedTopics, scoreRound, type RoundQuestion } from "@/lib/study/quiz";
import { columnOf, recordRound, useStudy } from "@/lib/study/store";

const ROUND_SIZE = 10;
const LETTERS = ["A", "B", "C", "D"];
const topicTitle = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id;

/** Runda quizu: pytania z tematów, których jeszcze nie umiesz, idą na początek. */
export function QuizPanel() {
  const study = useStudy();
  const [round, setRound] = useState<RoundQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: number; missed: string[]; demoted: string[] } | null>(null);

  const weak = useMemo(
    () => new Set(TOPICS.filter((t) => columnOf(study, t.id) !== "done").map((t) => t.id)),
    [study],
  );

  const start = useCallback(() => {
    const next = buildRound(ROUND_SIZE, weak);
    setRound(next);
    setAnswers(next.map(() => null));
    setIndex(0);
    setResult(null);
  }, [weak]);

  const current = round?.[index] ?? null;
  const picked = round ? answers[index] : null;

  const answer = useCallback((choice: number) => {
    if (!round || answers[index] !== null) return;
    setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)));
  }, [round, answers, index]);

  const next = useCallback(() => {
    if (!round) return;
    if (index < round.length - 1) { setIndex(index + 1); return; }
    const correct = scoreRound(round, answers);
    const missed = missedTopics(round, answers);
    const { demoted } = recordRound(correct, round.length, missed);
    setResult({ correct, missed, demoted });
    if (demoted.length) toast(`Wróciło do nauki: ${demoted.map(topicTitle).join(", ")}`);
  }, [round, index, answers]);

  // Klawiatura: A–D / 1–4 wybiera odpowiedź, Enter idzie dalej.
  useEffect(() => {
    if (!current || result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const i = "abcd".indexOf(k) >= 0 ? "abcd".indexOf(k) : "1234".indexOf(k);
      if (i >= 0 && i < current.options.length && k.length === 1) { e.preventDefault(); answer(i); }
      else if (e.key === "Enter" && picked !== null) { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, result, picked, answer, next]);

  if (result && round) {
    const percent = Math.round((result.correct / round.length) * 100);
    return (
      <section aria-label="Wynik rundy" className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5">
        <div className="flex items-end gap-4">
          <p className="font-display text-6xl leading-none tabular-nums text-primary">{result.correct}<span className="text-2xl text-muted-foreground">/{round.length}</span></p>
          <p className="pb-1 text-sm text-muted-foreground">
            {percent === 100 ? "Bezbłędnie." : percent >= 70 ? "Dobrze — zostało kilka tematów do powtórki." : "Warto wrócić do listy i tablicy."}
          </p>
        </div>
        {result.missed.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Do powtórki</h3>
            <ul className="space-y-1.5">
              {result.missed.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <X className="w-4 h-4 text-destructive shrink-0" aria-hidden />
                  {topicTitle(id)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Wszystkie tematy z tej rundy zaliczone.</p>
        )}
        <Button onClick={start}><RotateCcw className="w-4 h-4 mr-1.5" />Kolejna runda</Button>
      </section>
    );
  }

  if (!round || !current) {
    return (
      <section aria-label="Quiz" className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-4">
        <h2 className="font-display text-xl">Sprawdź, co umiesz</h2>
        <p className="text-sm text-muted-foreground max-w-prose">
          {ROUND_SIZE} pytań z poradnika i list kontrolnych. Najpierw wypadają tematy, których jeszcze nie masz w kolumnie „Umiem”.
          Błąd w temacie z kolumny „Umiem” cofa go do „W trakcie”.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={start}>Zacznij rundę</Button>
          {study.bestPercent !== null && (
            <p className="text-xs text-muted-foreground">Najlepszy wynik: {study.bestPercent}% · rund: {study.rounds}</p>
          )}
        </div>
      </section>
    );
  }

  const answered = picked !== null;
  return (
    <section aria-label="Quiz" className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-mono tabular-nums text-muted-foreground">Pytanie {index + 1} z {round.length}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground truncate">{topicTitle(current.topic)}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden" aria-hidden>
        <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((index + (answered ? 1 : 0)) / round.length) * 100}%` }} />
      </div>
      <h2 className="font-display text-lg sm:text-xl leading-snug">{current.question}</h2>
      <div role="group" aria-label="Odpowiedzi" className="grid gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = i === current.correct;
          const isPicked = i === picked;
          return (
            <button
              key={opt}
              type="button"
              disabled={answered}
              onClick={() => answer(i)}
              aria-pressed={isPicked}
              className={cn(
                "pressable flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                !answered && "border-border bg-background hover:border-primary/60 hover:bg-primary/5",
                answered && isCorrect && "border-emerald-500/60 bg-emerald-500/10",
                answered && isPicked && !isCorrect && "border-destructive/60 bg-destructive/10",
                answered && !isCorrect && !isPicked && "border-border bg-background opacity-60",
              )}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border font-mono text-2xs text-muted-foreground">
                {answered && isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-600" aria-label="Poprawna" /> : answered && isPicked ? <X className="w-3.5 h-3.5 text-destructive" aria-label="Błędna" /> : LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="space-y-3" aria-live="polite">
          <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-relaxed">
            <span className="font-medium">{picked === current.correct ? "Dobrze. " : "Nie tym razem. "}</span>
            {current.explanation}
          </p>
          <Button onClick={next}>
            {index < round.length - 1 ? "Dalej" : "Zobacz wynik"}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      )}
    </section>
  );
}
