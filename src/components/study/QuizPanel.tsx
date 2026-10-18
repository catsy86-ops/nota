import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TOPICS } from "@/lib/study/content";
import { buildRound, missedTopics, scoreRound, type RoundQuestion } from "@/lib/study/quiz";
import { activeStreak, columnOf, dueToday, recordRound, useStudy, useStudyLists } from "@/lib/study/store";
import { CustomQuestionsDialog } from "./CustomQuestionsDialog";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";

const ROUND_SIZE = 10;
const LETTERS = ["A", "B", "C", "D"];
const topicTitle = (id: string) => TOPICS.find((t) => t.id === id)?.title ?? id;
const streakLabel = (n: number) => `${n} ${n === 1 ? "dzień" : "dni"}`;

/** Z czego składa się runda: wszystko, jeden temat, pytania, które ostatnio poszły źle, albo powtórki na dziś. */
export type QuizScope = { kind: "all" } | { kind: "topic"; topic: string } | { kind: "missed" } | { kind: "due" };

/** „jutro”, „za 3 dni”, „24.10” — kiedy wypada najbliższa powtórka. */
function nextReviewLabel(due: string, today: string): string {
  if (due === addDaysToKey(today, 1)) return "jutro";
  for (let n = 2; n <= 6; n++) if (due === addDaysToKey(today, n)) return `za ${n} dni`;
  const [, m, d] = due.split("-");
  return `${Number(d)}.${m}`;
}

/** Runda quizu: pytania z tematów, których jeszcze nie umiesz, idą na początek. */
export function QuizPanel({ scope = { kind: "all" }, onScopeChange }: { scope?: QuizScope; onScopeChange?: (s: QuizScope) => void }) {
  const study = useStudy();
  const lists = useStudyLists();
  const [ownOpen, setOwnOpen] = useState(false);
  const [round, setRound] = useState<RoundQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<{ correct: number; missed: string[]; demoted: string[]; streak: number; streakGrew: boolean } | null>(null);

  const weak = useMemo(
    () => new Set(TOPICS.filter((t) => columnOf(study, t.id) !== "done").map((t) => t.id)),
    [study],
  );

  const due = useMemo(() => dueToday(study), [study]);
  // Najbliższy termin, gdy na dziś nic nie ma — żeby było wiadomo, kiedy wrócić.
  const nextDue = useMemo(() => {
    const today = localDayKey();
    const later = Object.values(study.review).map((c) => c.due).filter((d) => d > today).sort()[0];
    return later ? nextReviewLabel(later, today) : null;
  }, [study.review]);

  const start = useCallback((s: QuizScope = scope) => {
    // Powtórki: najbardziej zaległe pierwsze, reszta czeka na następną rundę.
    const dueIds = new Set(due.slice(0, ROUND_SIZE));
    const all = lists.questions;
    const pool = s.kind === "topic" ? all.filter((q) => q.topic === s.topic)
      : s.kind === "missed" ? all.filter((q) => study.missed[q.id])
      : s.kind === "due" ? all.filter((q) => dueIds.has(q.id))
      : all;
    if (pool.length === 0) {
      toast(s.kind === "due" ? "Na dziś nie ma powtórek." : "Nie ma pytań do powtórki. Rozwiąż najpierw rundę.");
      onScopeChange?.({ kind: "all" });
      return;
    }
    const next = buildRound(Math.min(ROUND_SIZE, pool.length), weak, Math.random, pool);
    setRound(next);
    setAnswers(next.map(() => null));
    setIndex(0);
    setResult(null);
  }, [weak, scope, study.missed, due, onScopeChange, lists]);

  // Zakres ustawiony spoza panelu (przycisk „Ćwicz” na tablicy) od razu startuje rundę.
  useEffect(() => {
    if (scope.kind !== "all") start(scope);
    // Tylko przy zmianie zakresu — nie przy każdej zmianie postępu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.kind === "topic" ? scope.topic : scope.kind]);

  const current = round?.[index] ?? null;
  const picked = round ? answers[index] : null;

  const answer = useCallback((choice: number) => {
    if (!round || answers[index] !== null) return;
    haptic(choice === round[index].correct ? "success" : "warn");
    setAnswers((prev) => prev.map((a, i) => (i === index ? choice : a)));
  }, [round, answers, index]);

  const next = useCallback(() => {
    if (!round) return;
    if (index < round.length - 1) { setIndex(index + 1); return; }
    const correct = scoreRound(round, answers);
    const missed = missedTopics(round, answers);
    const { demoted, streak, streakGrew } = recordRound(correct, round.length, missed, round.map((q, i) => ({ id: q.id, ok: answers[i] === q.correct })));
    setResult({ correct, missed, demoted, streak, streakGrew });
    if (streakGrew && streak > 1) haptic("success");
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
          <p className="font-mono text-6xl font-semibold leading-none tabular-nums text-primary-ink">{result.correct}<span className="text-2xl text-muted-foreground">/{round.length}</span></p>
          <p className="pb-1 text-sm text-muted-foreground">
            {percent === 100 ? "Bezbłędnie." : percent >= 70 ? "Dobrze — zostało kilka tematów do powtórki." : "Warto wrócić do listy i tablicy."}
          </p>
        </div>
        {result.streak > 1 && (
          <p className="text-sm">
            <span className="font-medium tabular-nums">{result.streakGrew ? `${result.streak}. dzień z rzędu` : `Seria: ${streakLabel(result.streak)}`}</span>
            <span className="text-muted-foreground">{result.streakGrew ? " — seria trwa." : " — dzisiejsza runda już się liczy."}</span>
          </p>
        )}
        {result.missed.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Do powtórki</h3>
            <ul className="space-y-1.5">
              {result.missed.map((id) => (
                <li key={id} className="flex items-center gap-2 text-sm">
                  <X className="w-4 h-4 text-destructive-ink shrink-0" aria-hidden />
                  {topicTitle(id)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Wszystkie tematy z tej rundy zaliczone.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => start(scope)}><RotateCcw className="w-4 h-4 mr-1.5" />Jeszcze raz</Button>
          {scope.kind !== "all" && <Button variant="outline" onClick={() => { onScopeChange?.({ kind: "all" }); setRound(null); setResult(null); }}>Wróć do wszystkich</Button>}
          {scope.kind !== "due" && due.length > 0 && (
            <Button variant="outline" onClick={() => onScopeChange?.({ kind: "due" })}>Na dziś: {due.length}</Button>
          )}
          {scope.kind === "all" && Object.keys(study.missed).length > 0 && (
            <Button variant="outline" onClick={() => onScopeChange?.({ kind: "missed" })}>Powtórka błędów ({Object.keys(study.missed).length})</Button>
          )}
        </div>
        {scope.kind === "due" && due.length === 0 && (
          <p className="text-sm text-muted-foreground">Powtórki na dziś zrobione.{nextDue && <> Następne: {nextDue}.</>}</p>
        )}
      </section>
    );
  }

  if (!round || !current) {
    return (
      <section aria-label="Quiz" className="rounded-2xl border border-border bg-card p-5 sm:p-7 space-y-4">
        <h2 className="font-display text-xl">Sprawdź, co umiesz</h2>
        <p className="text-sm text-muted-foreground max-w-prose">
          {ROUND_SIZE} pytań z poradnika, list kontrolnych i Twoich własnych. Najpierw wypadają tematy, których jeszcze nie masz w kolumnie „Umiem”.
          Błąd w temacie z kolumny „Umiem” cofa go do „W trakcie”. Każde pytanie wraca do powtórki: po dobrej odpowiedzi
          coraz rzadziej, po błędzie — następnego dnia.
        </p>
        {due.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3" data-testid="due-today">
            <p className="text-sm"><span className="font-semibold tabular-nums">Na dziś: {due.length}</span> <span className="text-muted-foreground">{pluralPl(due.length, ["pytanie", "pytania", "pytań"])} do powtórki</span></p>
            <Button size="sm" onClick={() => onScopeChange?.({ kind: "due" })}>Powtórz</Button>
          </div>
        ) : nextDue ? (
          <p className="text-xs text-muted-foreground" data-testid="due-today">Na dziś nic do powtórki. Następne: {nextDue}.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={due.length > 0 ? "outline" : "default"} onClick={() => start({ kind: "all" })}>Zacznij rundę</Button>
          {Object.keys(study.missed).length > 0 && (
            <Button variant="outline" onClick={() => onScopeChange?.({ kind: "missed" })}>
              Powtórka błędów ({Object.keys(study.missed).length})
            </Button>
          )}
          <Button variant="ghost" onClick={() => setOwnOpen(true)} data-testid="open-custom-questions">
            Moje pytania{study.custom.some((e) => e.kind === "question") && <span className="ml-1 font-mono tabular-nums text-muted-foreground">({study.custom.filter((e) => e.kind === "question").length})</span>}
          </Button>
          <CustomQuestionsDialog open={ownOpen} onOpenChange={setOwnOpen} />
          {study.bestPercent !== null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Najlepszy wynik: {study.bestPercent}% · rund: {study.rounds}
              {activeStreak(study) > 1 && <> · seria: {streakLabel(activeStreak(study))}</>}
            </p>
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
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground truncate">
          {scope.kind === "missed" ? "Powtórka błędów · " : scope.kind === "due" ? "Na dziś · " : ""}{topicTitle(current.topic)}
        </span>
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
                "pressable flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors coarse:min-h-14 coarse:items-center coarse:text-base",
                !answered && "border-border bg-background hover:border-primary/60 hover:bg-primary/5",
                answered && isCorrect && "border-success-ink/60 bg-success/10",
                answered && isPicked && !isCorrect && "border-destructive/60 bg-destructive/10",
                answered && !isCorrect && !isPicked && "border-border bg-background opacity-60",
              )}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-border font-mono text-2xs text-muted-foreground">
                {answered && isCorrect ? <Check className="w-3.5 h-3.5 text-success-ink" aria-label="Poprawna" /> : answered && isPicked ? <X className="w-3.5 h-3.5 text-destructive-ink" aria-label="Błędna" /> : LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-relaxed" aria-live="polite">
          <span className="font-medium">{picked === current.correct ? "Dobrze. " : "Nie tym razem. "}</span>
          {current.explanation}
        </p>
      )}
      {/* Telefon: „Dalej” przyklejony nad dolnym paskiem — bez przewijania pod objaśnienie po każdej odpowiedzi.
          Bezpośrednio w sekcji: `sticky` działa tylko w obrębie rodzica, a sekcja sięga pod dolny pasek. */}
      {answered && (
        <div data-sticky-action className="phone:sticky phone:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] phone:z-10 phone:-mx-5 phone:bg-card/95 phone:px-5 phone:py-2 phone:backdrop-blur-sm">
          <Button onClick={next} className="phone:h-12 phone:w-full phone:text-base">
            {index < round.length - 1 ? "Dalej" : "Zobacz wynik"}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      )}
    </section>
  );
}
