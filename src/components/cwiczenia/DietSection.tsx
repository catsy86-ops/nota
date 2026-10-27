import { useMemo, useState } from "react";
import { Salad, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { byMealOrder, DIET_KCAL_MAX, DIET_PROTEIN_MAX, DIET_TEXT_MAX, summarizeDay, summarizeRange, type DaySummary, type DietGoals, type Meal } from "@/lib/diet/model";
import { addMeal, removeMeal, restoreMeal, setDietGoals, useDietGoals, useMeals } from "@/lib/diet/store";
import { pluralPl } from "@/lib/plural";

const MEAL_FORMS: [string, string, string] = ["posiłek", "posiłki", "posiłków"];
import { toastWithUndo } from "@/lib/undoToast";

/** Sekcja „Dieta” w dziale Ćwiczenia: dziś (posiłki, sumy, cele), dodawanie i tydzień wstecz. */
export function DietSection() {
  const meals = useMeals();
  const goals = useDietGoals();
  const today = localDayKey();
  const todays = useMemo(() => meals.filter((m) => m.day === today).sort(byMealOrder), [meals, today]);
  const summary = summarizeDay(meals, today);
  const week = useMemo(() => summarizeRange(meals, today, 7, addDaysToKey), [meals, today]);

  return (
    <section aria-labelledby="diet-title" className="rounded-card border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="diet-title" className="section-label gap-2">
          <Salad className="h-3.5 w-3.5" aria-hidden />
          Dieta
        </h2>
      </div>

      <TodaySummary summary={summary} goals={goals} />

      {todays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dziś bez posiłków. Dodaj pierwszy poniżej.</p>
      ) : (
        <ul className="divide-y divide-border/50" data-testid="diet-today">
          {todays.map((m) => <MealRow key={m.id} meal={m} />)}
        </ul>
      )}

      <AddMealForm />
      <GoalsForm goals={goals} />
      <WeekList days={week} today={today} />
    </section>
  );
}

function TodaySummary({ summary, goals }: { summary: DaySummary; goals: DietGoals }) {
  const unknownKcal = summary.meals - summary.kcalKnown;
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="diet-summary">
      <Stat label="Kalorie" value={`${summary.kcal} kcal`} goal={goals.kcal ? `z ${goals.kcal} kcal` : undefined} note={unknownKcal > 0 ? `${unknownKcal} ${pluralPl(unknownKcal, MEAL_FORMS)} bez kalorii` : undefined} />
      <Stat label="Białko" value={`${summary.protein} g`} goal={goals.protein ? `z ${goals.protein} g` : undefined} note={summary.meals - summary.proteinKnown > 0 ? `${summary.meals - summary.proteinKnown} ${pluralPl(summary.meals - summary.proteinKnown, MEAL_FORMS)} bez białka` : undefined} />
    </div>
  );
}

function Stat({ label, value, goal, note }: { label: string; value: string; goal?: string; note?: string }) {
  return (
    <div className="rounded-field border border-border/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value} {goal && <span className="text-xs text-muted-foreground">{goal}</span>}</p>
      {note && <p className="text-2xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const details = [meal.kcal !== undefined ? `${meal.kcal} kcal` : null, meal.protein !== undefined ? `${meal.protein} g białka` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{meal.time ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{meal.text}</p>
        {details && <p className="text-xs text-muted-foreground">{details}</p>}
      </div>
      <Button variant="ghost" size="sm" className="coarse:h-11" aria-label={`Usuń posiłek: ${meal.text}`} onClick={() => deleteWithUndo(meal)}>
        <Trash className="h-4 w-4" aria-hidden />
      </Button>
    </li>
  );
}

/** Usunięcie z „Cofnij”: posiłek wraca z tym samym id i godziną. */
function deleteWithUndo(meal: Meal) {
  const prev = removeMeal(meal.id);
  if (!prev) return;
  toastWithUndo("Usunięto posiłek", () => restoreMeal(prev), { description: prev.text });
}

/** Liczba z pola: pusta = brak wartości; poza zakresem lub nie-liczba = `null` (pole pokazuje błąd). */
function parseAmountField(text: string, max: number): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AddMealForm() {
  const [text, setText] = useState("");
  const [time, setTime] = useState(nowHHMM);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const kcalValue = parseAmountField(kcal, DIET_KCAL_MAX);
  const proteinValue = parseAmountField(protein, DIET_PROTEIN_MAX);
  const valid = text.trim().length > 0 && kcalValue !== null && proteinValue !== null;

  const save = () => {
    if (!valid) return;
    const meal = addMeal({ text, time: time || undefined, kcal: kcalValue ?? undefined, protein: proteinValue ?? undefined });
    if (!meal) return;
    setText("");
    setKcal("");
    setProtein("");
    setTime(nowHHMM());
  };

  return (
    <form className="space-y-3 border-t border-dashed border-border pt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <p className="text-xs font-medium text-muted-foreground">Dodaj posiłek</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input aria-label="Co zjedzono" placeholder="np. Owsianka z bananem" maxLength={DIET_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
        <Input type="time" aria-label="Godzina posiłku" value={time} onChange={(e) => setTime(e.target.value)} className="w-auto coarse:h-11" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input inputMode="numeric" aria-label="Kalorie (kcal)" aria-invalid={kcalValue === null} placeholder="kcal, np. 450" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        <Input inputMode="decimal" aria-label="Białko (g)" aria-invalid={proteinValue === null} placeholder="białko w g, np. 30" value={protein} onChange={(e) => setProtein(e.target.value)} />
      </div>
      <Button type="submit" size="sm" disabled={!valid} className="coarse:h-11">Dodaj posiłek</Button>
    </form>
  );
}

function GoalsForm({ goals }: { goals: DietGoals }) {
  const [kcal, setKcal] = useState(goals.kcal ? String(goals.kcal) : "");
  const [protein, setProtein] = useState(goals.protein ? String(goals.protein) : "");
  const kcalValue = parseAmountField(kcal, DIET_KCAL_MAX);
  const proteinValue = parseAmountField(protein, DIET_PROTEIN_MAX);
  const valid = kcalValue !== null && proteinValue !== null;

  return (
    <form
      className="space-y-3 border-t border-dashed border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setDietGoals({ kcal: kcalValue ?? undefined, protein: proteinValue ?? undefined });
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">Cele dzienne (puste = bez celu)</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input inputMode="numeric" aria-label="Cel kalorii (kcal)" aria-invalid={kcalValue === null} placeholder="np. 2400" value={kcal} onChange={(e) => setKcal(e.target.value)} />
        <Input inputMode="decimal" aria-label="Cel białka (g)" aria-invalid={proteinValue === null} placeholder="np. 150" value={protein} onChange={(e) => setProtein(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={!valid} className="coarse:h-11">Zapisz cele</Button>
    </form>
  );
}

function WeekList({ days, today }: { days: DaySummary[]; today: string }) {
  const hasAny = days.some((d) => d.meals > 0);
  if (!hasAny) return null;
  return (
    <div className="border-t border-dashed border-border pt-4">
      <p className="text-xs font-medium text-muted-foreground">Ostatnie 7 dni</p>
      <ul className="mt-2 space-y-1 text-sm" data-testid="diet-week">
        {[...days].reverse().map((d) => (
          <li key={d.day} className="flex justify-between gap-3">
            <span className={d.day === today ? "font-medium" : "text-muted-foreground"}>{shortDay(d.day)}</span>
            <span className="font-mono tabular-nums">{d.meals > 0 ? `${d.kcal} kcal · ${d.protein} g białka` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** `YYYY-MM-DD` → `DD.MM`, bez zależności od strefy (to tylko napis). */
function shortDay(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}.${m}`;
}
