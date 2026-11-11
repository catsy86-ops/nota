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
  /** B3.1: odczyty ciśnienia w trakcie próby (`at` = sekundy od startu, `bar`); brak = nie rejestrowano. */
  readings?: Array<{ at: number; bar: number }>;
  /** B3.1: początek trwającej próby (ms). Zapisany w protokole, więc minutnik przeżywa zamknięcie okna i przeładowanie. */
  startedAt?: number;
}

export const READINGS_MAX = 60;

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
    ...(readings?.length ? { readings: readings.slice(0, READINGS_MAX) } : {}),
    ...(typeof t.startedAt === "number" && Number.isFinite(t.startedAt) && t.startedAt > 0 ? { startedAt: t.startedAt } : {}),
  };
}

// ── B3.1 Minutnik: stan próby liczony z `startedAt`, nie z licznika w komponencie ─────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;

export const isRunning = (t: PressureTest): boolean => t.startedAt !== undefined;

/** Sekundy od startu (0 przed startem i przy zegarze cofniętym). */
export const elapsedSec = (t: PressureTest, now: number): number => (t.startedAt === undefined ? 0 : Math.max(0, Math.floor((now - t.startedAt) / 1000)));

/** Sekundy do końca zaplanowanego czasu; 0 po czasie. */
export const remainingSec = (t: PressureTest, now: number): number => (t.minutes === null ? 0 : Math.max(0, Math.round(t.minutes * 60) - elapsedSec(t, now)));

/** Moment końca zaplanowanej próby (ms) albo `null`, gdy próba nie trwa. */
export const runEndsAt = (t: PressureTest): number | null => (t.startedAt === undefined || t.minutes === null ? null : t.startedAt + Math.round(t.minutes * 60) * 1000);

/** Start próby: ciśnienie początkowe i zaplanowany czas; pierwszy odczyt to ciśnienie początkowe. */
export function startRun(t: PressureTest, bar: number, minutes: number, now: number): PressureTest {
  return { ...t, bar, minutes, drop: null, startedAt: now, readings: [{ at: 0, bar }] };
}

/** Odczyt w trakcie próby; ten sam moment (sekunda) nadpisuje poprzedni, ostatnie `READINGS_MAX`. */
export function addReading(t: PressureTest, bar: number, now: number): PressureTest {
  const at = elapsedSec(t, now);
  const rest = (t.readings ?? []).filter((r) => r.at !== at);
  return { ...t, readings: [...rest, { at, bar }].sort((a, b) => a.at - b.at).slice(-READINGS_MAX) };
}

/**
 * Koniec próby: ciśnienie końcowe dopisane jako odczyt, spadek = początkowe − końcowe (nie mniej niż 0), czas
 * faktyczny w minutach, wynik „szczelna” przy braku spadku. Wynik można poprawić w polach protokołu.
 */
export function finishRun(t: PressureTest, endBar: number, now: number): PressureTest {
  const withEnd = addReading(t, endBar, now);
  const start = withEnd.readings?.[0]?.bar ?? t.bar;
  const drop = start === null || start === undefined ? null : Math.max(0, round2(start - endBar));
  const min = elapsedSec(t, now) / 60;
  const { startedAt: _gone, ...rest } = withEnd;
  return { ...rest, drop, minutes: min >= 1 ? Math.round(min) : Math.max(0.1, round2(min)), ok: drop === null ? t.ok : drop <= 0 };
}

/** Przerwanie próby: zostaje protokół bez odczytów i bez startu. */
export function cancelRun(t: PressureTest): PressureTest {
  const { startedAt: _s, readings: _r, ...rest } = t;
  return rest;
}

const fmt = (n: number) => String(round2(n)).replace(".", ",");
const minLabel = (sec: number) => fmt(sec / 60);

/** „0 min 6 bar → 15 min 5,9 bar → 30 min 5,9 bar” — odczyty do listy, raportu i protokołu; pusty = brak odczytów. */
export function readingsLine(t: PressureTest): string {
  const r = t.readings ?? [];
  return r.length < 2 ? "" : r.map((x) => `${minLabel(x.at)} min ${fmt(x.bar)} bar`).join(" → ");
}

/** „12:05” / „1:02:03” do wyświetlenia licznika. */
export function clockLabel(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
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
