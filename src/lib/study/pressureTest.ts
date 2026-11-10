/**
 * Protokół próby szczelności jako opcjonalne pole wpisu z budowy (decyzja 2026-10-15:
 * pole, nie osobny rodzaj — starsza wersja aplikacji odrzuca nieznane rodzaje wpisów,
 * a nieznane pole tylko pomija). Woda/powietrze: ciśnienie, czas, spadek na manometrze;
 * kanalizacja: próba na zalanie (czas i wynik).
 */
export type TestMedium = "air" | "water" | "sewer";
export const TEST_MEDIA: TestMedium[] = ["air", "water", "sewer"];
export const TEST_MEDIUM_LABEL: Record<TestMedium, string> = { air: "Powietrze", water: "Woda", sewer: "Zalanie" };

export interface PressureTest {
  medium: TestMedium;
  /** Ciśnienie próbne [bar]; `null` przy kanalizacji albo nie wpisane. */
  bar: number | null;
  /** Czas próby [min]. */
  minutes: number | null;
  /** Spadek ciśnienia na manometrze [bar]; `null` przy kanalizacji albo nie wpisany. */
  drop: number | null;
  /** Wynik: szczelna. */
  ok: boolean;
  /** B3.1: odczyty ciśnienia w trakcie próby (czas i ciśnienie); brak = nie rejestrowano. */
  readings?: Array<{ at: number; bar: number }>;
}

/** Tematy, przy których arkusz wpisu od razu proponuje protokół. */
export const TEST_TOPICS: ReadonlySet<string> = new Set(["proba-wody", "proba-kan"]);

/** Protokół startowy dla tematu: kanalizacja — zalanie; woda — próba robocza powietrzem 6 bar. */
export function defaultTest(topic: string): PressureTest {
  return topic === "proba-kan"
    ? { medium: "sewer", bar: null, minutes: null, drop: null, ok: true }
    : { medium: "air", bar: 6, minutes: null, drop: null, ok: true };
}

const num = (v: unknown, max: number): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.round(v * 100) / 100) : null;

/** Dowolne wejście (peer, kopia, szkic) → protokół albo `null`. */
export function cleanTest(raw: unknown): PressureTest | null {
  const t = raw as Partial<PressureTest> | null;
  if (!t || typeof t !== "object" || !TEST_MEDIA.includes(t.medium as TestMedium) || typeof t.ok !== "boolean") return null;
  const sewer = t.medium === "sewer";
  const readings = Array.isArray(t.readings)
    ? t.readings.flatMap((r) => {
        const at = typeof r?.at === "number" && Number.isFinite(r.at) ? Math.max(0, Math.round(r.at)) : null;
        const bar = sewer ? null : num(r?.bar, 100);
        return at !== null && bar !== null ? [{ at, bar }] : [];
      })
    : undefined;
  return {
    medium: t.medium as TestMedium,
    bar: sewer ? null : num(t.bar, 100),
    minutes: num(t.minutes, 10_000),
    drop: sewer ? null : num(t.drop, 100),
    ok: t.ok,
    ...(readings?.length ? { readings } : {}),
  };
}

const pl = (n: number) => String(n).replace(".", ",");

/** „Próba szczelności (powietrze, 6 bar, 30 min, spadek 0 bar): szczelna” — do listy, raportu i notatki. */
export function testLine(t: PressureTest): string {
  const parts = [t.medium === "sewer" ? "kanalizacja" : t.medium === "air" ? "powietrze" : "woda"];
  if (t.bar !== null) parts.push(`${pl(t.bar)} bar`);
  if (t.minutes !== null) parts.push(`${pl(t.minutes)} min`);
  if (t.drop !== null) parts.push(`spadek ${pl(t.drop)} bar`);
  const name = t.medium === "sewer" ? "Próba na zalanie" : "Próba szczelności";
  return `${name} (${parts.join(", ")}): ${t.ok ? "szczelna" : "nieszczelna"}`;
}
