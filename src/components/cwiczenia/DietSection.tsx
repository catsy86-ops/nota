import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { Salad, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { byMealOrder, DIET_KCAL_MAX, DIET_PROTEIN_MAX, DIET_TEXT_MAX, recentMeals, repeatDayInputs, summarizeDay, summarizeRange, type DaySummary, type DietGoals, type Meal, type MealTemplate } from "@/lib/diet/model";
import { addMeal, removeMeal, restoreMeal, setDietGoals, useDietGoals, useMeals } from "@/lib/diet/store";
import { pluralPl } from "@/lib/plural";

const MEAL_FORMS: [string, string, string] = ["posiłek", "posiłki", "posiłków"];
import { toastWithUndo } from "@/lib/undoToast";
import { toast } from "sonner";

/** Sekcja „Dieta” w dziale Ćwiczenia: dziś (posiłki, sumy, cele), dodawanie i tydzień wstecz. */
export function DietSection() {
  const meals = useMeals();
  const goals = useDietGoals();
  const today = localDayKey();
  const todays = useMemo(() => meals.filter((m) => m.day === today).sort(byMealOrder), [meals, today]);
  const summary = summarizeDay(meals, today);
  const week = useMemo(() => summarizeRange(meals, today, 7, addDaysToKey), [meals, today]);
  const recent = useMemo(() => recentMeals(meals), [meals]);
  const yesterday = addDaysToKey(today, -1);
  const yesterdayCount = useMemo(() => meals.filter((m) => m.day === yesterday).length, [meals, yesterday]);

  return (
    <SectionCard icon={Salad} title="Dieta" bodyClassName="space-y-4">

      <TodaySummary summary={summary} goals={goals} />

      {todays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dziś bez posiłków. Dodaj pierwszy poniżej.</p>
      ) : (
        <ul className="divide-y divide-border/50" data-testid="diet-today">
          {todays.map((m) => <MealRow key={m.id} meal={m} />)}
        </ul>
      )}

      <AddMealForm recent={recent} yesterdayCount={yesterdayCount} onRepeatYesterday={() => repeatYesterday(meals, yesterday, today)} />
      <GoalsForm goals={goals} />
      <WeekList days={week} today={today} />
    </SectionCard>
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
      <p className="ui-hint">{label}</p>
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
        {details && <p className="ui-hint">{details}</p>}
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

/** „Powtórz wczoraj” (2.4): wczorajsze posiłki jako nowe wpisy na dziś; „Cofnij” usuwa wszystkie dodane. */
function repeatYesterday(meals: readonly Meal[], yesterday: string, today: string) {
  const added = repeatDayInputs(meals, yesterday, today).map((input) => addMeal(input)).filter((m): m is Meal => m !== null);
  if (added.length === 0) {
    toast.error("Nie udało się skopiować wczorajszych posiłków", { description: "Lista posiłków może być pełna. Usuń stare wpisy i spróbuj ponownie." });
    return;
  }
  toastWithUndo(`Skopiowano ${added.length} ${pluralPl(added.length, MEAL_FORMS)} z wczoraj`, () => { for (const m of added) removeMeal(m.id); });
}

/** Liczba z pola: pusta = brak wartości; poza zakresem lub nie-liczba = `null` (pole pokazuje błąd). */
function parseAmountField(text: string, max: number, decimals = 0): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function AddMealForm({ recent, yesterdayCount, onRepeatYesterday }: { recent: MealTemplate[]; yesterdayCount: number; onRepeatYesterday: () => void }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState(nowHHMM);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const kcalValue = parseAmountField(kcal, DIET_KCAL_MAX);
  const proteinValue = parseAmountField(protein, DIET_PROTEIN_MAX, 1);
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

  // Pigułka ostatniego posiłku wypełnia formularz; zapis i godzina zostają w rękach użytkownika.
  const fill = (m: MealTemplate) => {
    setText(m.text);
    setKcal(m.kcal !== undefined ? String(m.kcal) : "");
    setProtein(m.protein !== undefined ? String(m.protein) : "");
  };

  return (
    <form className="space-y-3 border-t border-dashed border-border pt-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ui-hint font-medium">Dodaj posiłek</p>
        {yesterdayCount > 0 && (
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={onRepeatYesterday}>
            Powtórz wczoraj · {yesterdayCount} {pluralPl(yesterdayCount, MEAL_FORMS)}
          </Button>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input aria-label="Co zjedzono" placeholder="np. Owsianka z bananem" maxLength={DIET_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
        <Input type="time" aria-label="Godzina posiłku" value={time} onChange={(e) => setTime(e.target.value)} className="w-auto coarse:h-11" />
      </div>
      {recent.length > 0 && (
        <div role="group" aria-label="Ostatnie posiłki" className="flex flex-wrap gap-1.5" data-testid="diet-recent">
          {recent.map((m) => (
            <button key={m.text} type="button" onClick={() => fill(m)}
              className="pressable max-w-[16rem] truncate rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11">
              {m.text}{m.kcal !== undefined && <span className="text-muted-foreground"> · {m.kcal} kcal</span>}
            </button>
          ))}
        </div>
      )}
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
  const proteinValue = parseAmountField(protein, DIET_PROTEIN_MAX, 1);
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
      <p className="ui-hint font-medium">Cele dzienne (puste = bez celu)</p>
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
      <p className="ui-hint font-medium">Ostatnie 7 dni</p>
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
