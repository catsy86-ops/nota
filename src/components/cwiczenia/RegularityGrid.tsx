import { useId, useMemo } from "react";
import { CalendarCheck } from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { localDayKey } from "@/lib/dayDone";
import { regularityCounts, regularityLevel, regularityWeeks, REGULARITY_WEEKS, type RegularityDay } from "@/lib/fitnessRegularity";
import { parseLogKey } from "@/lib/supplements/model";
import { useSupplementsTaken } from "@/lib/supplements/store";
import { useMeals } from "@/lib/diet/store";
import { useTrainingEntries } from "@/lib/training/store";
import { pluralPl } from "@/lib/plural";

const CELL = 14;
const GAP = 3;
const STEP = CELL + GAP;
const DAY_NAMES = ["pn", "wt", "śr", "cz", "pt", "so", "nd"];
const DAY_FORMS: [string, string, string] = ["dzień", "dni", "dni"];
/** Nasycenie komórki: 0–3 rzeczy zrobione danego dnia (z akcentu stylu). */
const FILL = ["var(--muted)", "color-mix(in srgb, var(--primary) 30%, var(--muted))", "color-mix(in srgb, var(--primary) 60%, var(--muted))", "var(--primary)"];

const shortDate = (key: string) => `${Number(key.slice(8, 10))}.${key.slice(5, 7)}`;
function cellTitle(d: RegularityDay, i: number): string {
  const what = [d.training && "trening", d.supplements && "odżywki", d.diet && "dieta"].filter(Boolean).join(", ");
  return `${DAY_NAMES[i]} ${shortDate(d.day)}: ${what || "nic"}`;
}

/**
 * C3.1 Kalendarz regularności 12 tygodni (trening, odżywki, dieta wpisana). Kolumna = tydzień, wiersz = dzień;
 * nasycenie = ile z trzech rzeczy danego dnia, kropka = trening. Czytnik dostaje zdanie z liczbami, komórki mają `<title>`.
 */
export function RegularityGrid() {
  const entries = useTrainingEntries();
  const taken = useSupplementsTaken();
  const meals = useMeals();
  const today = localDayKey();
  const labelId = useId();
  const weeks = useMemo(() => regularityWeeks(today, {
    training: new Set(entries.map((e) => e.day)),
    supplements: new Set([...taken].map((k) => parseLogKey(k)?.day).filter((d): d is string => !!d)),
    diet: new Set(meals.map((m) => m.day)),
  }), [today, entries, taken, meals]);
  const counts = regularityCounts(weeks);
  if (counts.training + counts.supplements + counts.diet === 0) return null;
  const summary = `Ostatnie ${REGULARITY_WEEKS} tygodni: trening ${counts.training} ${pluralPl(counts.training, DAY_FORMS)}, odżywki ${counts.supplements} ${pluralPl(counts.supplements, DAY_FORMS)}, dieta wpisana ${counts.diet} ${pluralPl(counts.diet, DAY_FORMS)}.`;
  const labelW = 20;

  return (
    <SectionCard icon={CalendarCheck} title="Regularność" bodyClassName="space-y-3">
      <p id={labelId} className="ui-hint" data-testid="regularity-summary">{summary}</p>
      <svg role="img" aria-labelledby={labelId} width={labelW + REGULARITY_WEEKS * STEP} height={7 * STEP} viewBox={`0 0 ${labelW + REGULARITY_WEEKS * STEP} ${7 * STEP}`} className="max-w-full" data-testid="regularity-grid">
        {DAY_NAMES.map((n, i) => (i % 2 === 0 ? <text key={n} x={0} y={i * STEP + CELL - 3} fontSize="9" fill="var(--muted-foreground)">{n}</text> : null))}
        {weeks.map((week, w) => week.map((d, i) => d.future ? null : (
          <g key={d.day} data-day={d.day} data-level={regularityLevel(d)}>
            <title>{cellTitle(d, i)}</title>
            <rect x={labelW + w * STEP} y={i * STEP} width={CELL} height={CELL} rx={3} fill={FILL[regularityLevel(d)]} stroke={d.day === today ? "var(--foreground)" : "none"} strokeWidth={1.5} />
            {d.training && <circle cx={labelW + w * STEP + CELL / 2} cy={i * STEP + CELL / 2} r={2.2} fill="var(--background)" />}
          </g>
        )))}
      </svg>
      <div className="ui-meta flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden>
        <span className="flex items-center gap-1">mniej {FILL.map((f, i) => <span key={i} className="inline-block size-3 rounded-[3px]" style={{ background: f }} />)} więcej (trening, odżywki, dieta)</span>
        <span className="flex items-center gap-1"><span className="relative inline-block size-3 rounded-[3px] bg-primary"><span className="absolute inset-[3.5px] rounded-full bg-background" /></span> trening</span>
      </div>
    </SectionCard>
  );
}
