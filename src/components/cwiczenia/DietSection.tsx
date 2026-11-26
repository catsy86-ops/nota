import { useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/section-card";
import { Salad, Star, Trash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { byMealOrder, favoriteId, mealKey, proteinRangeFor, rangeAverage, DIET_KCAL_MAX, DIET_PROTEIN_MAX, DIET_TEXT_MAX, recentMeals, repeatDayInputs, summarizeDay, summarizeRange, type DaySummary, type DietGoals, type Meal, type MealFavorite, type MealTemplate } from "@/lib/diet/model";
import { addMeal, pinMeal, removeMeal, repinMeal, restoreMeal, setDietGoals, unpinMeal, useDietGoals, useMealFavorites, useMeals } from "@/lib/diet/store";
import { useWeights } from "@/lib/weight/store";
import { cn } from "@/lib/utils";
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
  const favorites = useMealFavorites();
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);
  // C4.1: przypięte nie powtarzają się w „ostatnich”.
  const recent = useMemo(() => recentMeals(meals, 5, new Set(favorites.map((f) => mealKey(f.text)))), [meals, favorites]);
  const yesterday = addDaysToKey(today, -1);
  const yesterdayCount = useMemo(() => meals.filter((m) => m.day === yesterday).length, [meals, yesterday]);

  return (
    <SectionCard icon={Salad} title="Dieta" bodyClassName="space-y-4">

      <TodaySummary summary={summary} goals={goals} />

      {todays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dziś bez posiłków. Dodaj pierwszy poniżej.</p>
      ) : (
        <ul className="divide-y divide-border/50" data-testid="diet-today">
          {todays.map((m) => <MealRow key={m.id} meal={m} pinned={favoriteIds.has(favoriteId(m.text))} />)}
        </ul>
      )}

      <AddMealForm favorites={favorites} recent={recent} yesterdayCount={yesterdayCount} onRepeatYesterday={() => repeatYesterday(meals, yesterday, today)} />
      <GoalsForm goals={goals} />
      <WeekList days={week} today={today} goals={goals} />
    </SectionCard>
  );
}

function TodaySummary({ summary, goals }: { summary: DaySummary; goals: DietGoals }) {
  const unknownKcal = summary.meals - summary.kcalKnown;
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="diet-summary">
      <Stat label="Kalorie" value={`${summary.kcal} kcal`} goal={goals.kcal ? `z ${goals.kcal} kcal` : undefined} ratio={goals.kcal ? summary.kcal / goals.kcal : undefined} note={unknownKcal > 0 ? `${unknownKcal} ${pluralPl(unknownKcal, MEAL_FORMS)} bez kalorii` : undefined} />
      <Stat label="Białko" value={`${summary.protein} g`} goal={goals.protein ? `z ${goals.protein} g` : undefined} ratio={goals.protein ? summary.protein / goals.protein : undefined} note={summary.meals - summary.proteinKnown > 0 ? `${summary.meals - summary.proteinKnown} ${pluralPl(summary.meals - summary.proteinKnown, MEAL_FORMS)} bez białka` : undefined} />
    </div>
  );
}

/** Pasek postępu (4.2): ozdoba przy liczbach, które i tak są w tekście; wypełnienie do 100% celu. */
function Bar({ ratio, className }: { ratio: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <div aria-hidden className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-[320ms] ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, value, goal, note, ratio }: { label: string; value: string; goal?: string; note?: string; ratio?: number }) {
  return (
    <div className="rounded-field border border-border/60 px-3 py-2">
      <p className="ui-hint">{label}</p>
      <p className="font-mono text-lg tabular-nums">{value} {goal && <span className="text-xs text-muted-foreground">{goal}</span>}</p>
      {ratio !== undefined && <Bar ratio={ratio} className="mt-1" />}
      {note && <p className="text-2xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function MealRow({ meal, pinned }: { meal: Meal; pinned: boolean }) {
  const details = [meal.kcal !== undefined ? `${meal.kcal} kcal` : null, meal.protein !== undefined ? `${meal.protein} g białka` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{meal.time ?? "—"}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{meal.text}</p>
        {details && <p className="ui-hint">{details}</p>}
      </div>
      <Button variant="ghost" size="sm" className="coarse:h-11" aria-pressed={pinned} aria-label={`Ulubiony: ${meal.text}`} onClick={() => togglePin(meal, pinned)}>
        <Star className={cn("size-4", pinned && "fill-primary text-primary")} aria-hidden />
      </Button>
      <Button variant="ghost" size="sm" className="coarse:h-11" aria-label={`Usuń posiłek: ${meal.text}`} onClick={() => deleteWithUndo(meal)}>
        <Trash className="size-4" aria-hidden />
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

/** C4.1 Gwiazdka przy posiłku: przypina opis z wartościami albo odpina (z „Cofnij”). */
function togglePin(meal: Meal, pinned: boolean) {
  if (pinned) { unpinWithUndo(favoriteId(meal.text)); return; }
  const t: MealTemplate = { text: meal.text, ...(meal.kcal !== undefined ? { kcal: meal.kcal } : {}), ...(meal.protein !== undefined ? { protein: meal.protein } : {}) };
  if (!pinMeal(t)) toast.error("Nie udało się przypiąć", { description: "Ulubionych jest już 12. Odepnij któryś (×) i spróbuj ponownie." });
}

function unpinWithUndo(id: string) {
  const prev = unpinMeal(id);
  if (prev) toastWithUndo("Odpięto z ulubionych", () => repinMeal(prev), { description: prev.text });
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

function AddMealForm({ favorites, recent, yesterdayCount, onRepeatYesterday }: { favorites: MealFavorite[]; recent: MealTemplate[]; yesterdayCount: number; onRepeatYesterday: () => void }) {
  const [text, setText] = useState("");
  const [time, setTime] = useState(nowHHMM);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  /** Dzień zapisu: dziś albo wczoraj (zapomniany posiłek). */
  const [forYesterday, setForYesterday] = useState(false);
  const kcalValue = parseAmountField(kcal, DIET_KCAL_MAX);
  const proteinValue = parseAmountField(protein, DIET_PROTEIN_MAX, 1);
  const valid = text.trim().length > 0 && kcalValue !== null && proteinValue !== null;

  const save = () => {
    if (!valid) return;
    const day = forYesterday ? addDaysToKey(localDayKey(), -1) : undefined;
    const meal = addMeal({ text, day, time: time || undefined, kcal: kcalValue ?? undefined, protein: proteinValue ?? undefined });
    if (!meal) return;
    if (forYesterday) toast.success("Dodano posiłek do wczoraj");
    setForYesterday(false);
    setText("");
    setKcal("");
    setProtein("");
    setTime(nowHHMM());
  };

  // C4.1: ulubiony zapisuje się od razu — z godziną i dniem z formularza; „Cofnij” usuwa wpis.
  const logFavorite = (f: MealFavorite) => {
    const day = forYesterday ? addDaysToKey(localDayKey(), -1) : undefined;
    const meal = addMeal({ text: f.text, day, time: time || undefined, kcal: f.kcal, protein: f.protein });
    if (!meal) { toast.error("Nie udało się dodać posiłku", { description: "Lista posiłków może być pełna. Usuń stare wpisy i spróbuj ponownie." }); return; }
    setForYesterday(false);
    setTime(nowHHMM());
    toastWithUndo(forYesterday ? "Dodano posiłek do wczoraj" : "Dodano posiłek", () => removeMeal(meal.id), { description: meal.text });
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
      <div role="group" aria-label="Dzień posiłku" className="flex gap-1.5">
        {([false, true] as const).map((y) => (
          <button key={String(y)} type="button" aria-pressed={forYesterday === y} onClick={() => setForYesterday(y)}
            className={cn("pressable rounded-full border px-3 py-1 text-xs outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11",
              forYesterday === y ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
            {y ? "Wczoraj" : "Dziś"}
          </button>
        ))}
      </div>
      {favorites.length > 0 && (
        <div role="group" aria-label="Ulubione posiłki — stuknięcie zapisuje" className="flex flex-wrap gap-1.5" data-testid="diet-favorites">
          {favorites.map((f) => (
            <span key={f.id} className="inline-flex max-w-72 items-stretch overflow-hidden rounded-full border border-primary/50 bg-primary/10 text-xs">
              <button type="button" onClick={() => logFavorite(f)} aria-label={`Zapisz ${f.text}`}
                className="pressable flex min-w-0 items-center gap-1 py-1 pl-2.5 pr-1.5 text-foreground hover:bg-primary/15 outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring coarse:min-h-11">
                <Star className="size-3 shrink-0 fill-primary text-primary" aria-hidden />
                <span className="truncate">{f.text}</span>
                {f.kcal !== undefined && <span className="shrink-0 text-muted-foreground">· {f.kcal} kcal</span>}
              </button>
              <button type="button" onClick={() => unpinWithUndo(f.id)} aria-label={`Odepnij: ${f.text}`}
                className="pressable border-l border-primary/30 px-1.5 text-muted-foreground hover:bg-primary/15 hover:text-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring coarse:min-h-11 coarse:min-w-9">
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div role="group" aria-label="Ostatnie posiłki" className="flex flex-wrap gap-1.5" data-testid="diet-recent">
          {recent.map((m) => (
            <button key={m.text} type="button" onClick={() => fill(m)}
              className="pressable max-w-64 truncate rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11">
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
  // C4.3: zakres białka z ostatniego ważenia (zakładka „Waga”).
  const weights = useWeights();
  const lastKg = useMemo(() => [...weights].sort((a, b) => a.day.localeCompare(b.day)).at(-1)?.kg, [weights]);
  const range = lastKg !== undefined ? proteinRangeFor(lastKg) : null;

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
      {range && (
        <p className="ui-hint flex flex-wrap items-center gap-2" data-testid="protein-from-weight">
          <span>Przy masie {String(lastKg).replace(".", ",")} kg: {range.min}–{range.max} g białka dziennie (1,6–2,2 g na kg).</span>
          {goals.protein !== range.mid && (
            <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => { setProtein(String(range.mid)); setDietGoals({ kcal: goals.kcal, protein: range.mid }); toast.success(`Cel białka: ${range.mid} g`); }}>
              Przyjmij {range.mid} g
            </Button>
          )}
        </p>
      )}
      <Button type="submit" variant="outline" size="sm" disabled={!valid} className="coarse:h-11">Zapisz cele</Button>
    </form>
  );
}

function WeekList({ days, today, goals }: { days: DaySummary[]; today: string; goals: DietGoals }) {
  const hasAny = days.some((d) => d.meals > 0);
  if (!hasAny) return null;
  // Słupki względem celu kalorii; bez celu — względem najwyższego dnia tygodnia.
  const scale = goals.kcal ?? Math.max(1, ...days.map((d) => d.kcal));
  // C4.4: jedno zdanie nad listą — średnia z dni z wpisami wobec celu.
  const average = rangeAverage(days);
  return (
    <div className="border-t border-dashed border-border pt-4">
      <p className="ui-hint font-medium">Ostatnie 7 dni</p>
      {average && (
        <p className="mt-1 text-sm" data-testid="diet-average">
          Średnio{average.kcal !== null && <> <span className="font-mono tabular-nums">{average.kcal} kcal</span>{goals.kcal ? <>, cel {goals.kcal}</> : null}</>}
          {average.kcal !== null && average.protein !== null && " ·"}
          {average.protein !== null && <> <span className="font-mono tabular-nums">{average.protein} g</span> białka{goals.protein ? <>, cel {goals.protein} g</> : null}</>}
          <span className="text-muted-foreground"> — z {average.days} {pluralPl(average.days, ["dnia", "dni", "dni"])} z wpisami</span>
        </p>
      )}
      <ul className="mt-2 space-y-1 text-sm" data-testid="diet-week">
        {[...days].reverse().map((d) => (
          <li key={d.day} className="space-y-0.5">
            <div className="flex justify-between gap-3">
              <span className={d.day === today ? "font-medium" : "text-muted-foreground"}>{shortDay(d.day)}</span>
              <span className="font-mono tabular-nums">{d.meals > 0 ? `${d.kcal} kcal · ${d.protein} g białka` : "—"}</span>
            </div>
            <Bar ratio={d.kcal / scale} className={d.day === today ? "" : "opacity-60"} />
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
