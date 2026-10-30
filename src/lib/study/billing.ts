import { cell } from "@/lib/shifts/timesheet";

/**
 * Sposób rozliczenia budowy (H3.1, plan 2026-10-29): godziny (stawka w karcie, `SiteCard.rate`),
 * od punktu (stawka domyślna i stawki na typ punktu — decyzja H-4) i ryczałt (kwota za całość
 * i/lub za etapy). Sposoby można łączyć. Czyste dane; zapis w Yjs w `yBilling.ts`, akcje
 * w `billingStore.ts`. Pieniądze są w osobnej mapie, nie w karcie budowy (zasada 4 planu).
 */

export const BILLING_MODES = ["hours", "points", "lump"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];
export const MODE_LABEL: Readonly<Record<BillingMode, string>> = { hours: "Godziny", points: "Od punktu", lump: "Ryczałt" };

/** Budowa bez zapisanego sposobu: same godziny, jak przed H3.1. */
export const DEFAULT_MODES: readonly BillingMode[] = ["hours"];

/** Najwyższa kwota (zł) — ponad to to raczej literówka. */
export const AMOUNT_MAX = 10_000_000;

export interface SiteBilling {
  modes: BillingMode[];
  /** Stawka za punkt, gdy typ nie ma własnej (zł). */
  pointRate?: number;
  /** Stawki na typ punktu (`points.ts` → `POINT_TYPES[].id`). */
  typeRates: Record<string, number>;
  /** Ryczałt za całą budowę (zł). */
  lump?: number;
  /** Ryczałt za etap: id etapu (`stages.ts`) → kwota. */
  stageAmounts: Record<string, number>;
  /** Zaliczki i wypłaty (H3.2), od najstarszej. */
  payments: Payment[];
}

/** Kwota z dokumentu; `undefined` = brak albo śmieć. Zaokrąglona do groszy. */
export function cleanAmount(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= AMOUNT_MAX ? Math.round(v * 100) / 100 : undefined;
}

/** Sposoby w stałej kolejności, bez powtórzeń i nieznanych; `undefined` = nie zapisano. */
export function cleanModes(raw: unknown): BillingMode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return BILLING_MODES.filter((m) => raw.includes(m));
}

/**
 * Kwota wpisana w polu: „1 250,50” → 1250.5; pusty tekst → `null` (usuń); zły tekst → `undefined`.
 * Spacje (`\s` obejmuje też twarde z formatowania) i „zł” są pomijane.
 */
export function parseAmount(raw: string): number | null | undefined {
  const t = raw.replace(/\s/g, "").replace(/zł$/i, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return undefined;
  return cleanAmount(Number(t));
}

/** Stawka za punkt danego typu: własna typu albo domyślna; `undefined` = bez stawki. */
export const pointRateFor = (b: Pick<SiteBilling, "pointRate" | "typeRates">, typeId: string): number | undefined => b.typeRates[typeId] ?? b.pointRate;

/** „1 250,50 zł” / „8 000 zł”. */
export const money = (n: number) => `${n.toLocaleString("pl-PL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} zł`;

/** Kwota w polu do edycji: „1250,5”. */
export const amountInput = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));

/** Suma ryczałtów za etapy. */
export const stagesTotal = (b: Pick<SiteBilling, "stageAmounts">) => Object.values(b.stageAmounts).reduce((s, n) => s + n, 0);

/** Jedna linia w nagłówku panelu: „Godziny · Od punktu 150 zł · Ryczałt 8 000 zł”; `rate` = stawka godzinowa karty. */
export function billingSummary(b: SiteBilling, rate?: number): string {
  if (b.modes.length === 0) return "nie wybrano";
  return b.modes.map((m) => {
    if (m === "hours") return rate ? `${MODE_LABEL.hours} ${money(rate)}/h` : MODE_LABEL.hours;
    if (m === "points") return b.pointRate !== undefined ? `${MODE_LABEL.points} ${money(b.pointRate)}` : MODE_LABEL.points;
    const total = (b.lump ?? 0) + stagesTotal(b);
    return total > 0 ? `${MODE_LABEL.lump} ${money(Math.round(total * 100) / 100)}` : MODE_LABEL.lump;
  }).join(" · ");
}

// ── H3.2 Należności: naliczone, otrzymane, zostało do zapłaty ─────────────────────────────────

export const PAYMENT_NOTE_MAX = 80;
export const PAYMENTS_MAX = 100;

/** Zaliczka albo wypłata od szefa/inwestora. */
export interface Payment {
  id: string;
  /** Dzień wpłaty „RRRR-MM-DD”. */
  day: string;
  amount: number;
  note?: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Wpłata z dokumentu; `null` = śmieć. */
export function cleanPayment(raw: unknown, id: string): Payment | null {
  const p = raw as Partial<Payment> | null;
  if (!p || typeof p !== "object" || typeof p.day !== "string" || !DAY_RE.test(p.day)) return null;
  const amount = cleanAmount(p.amount);
  if (amount === undefined) return null;
  const note = typeof p.note === "string" ? p.note.trim().replace(/\s+/g, " ").slice(0, PAYMENT_NOTE_MAX).trimEnd() : "";
  return { id, day: p.day, amount, ...(note ? { note } : {}) };
}

/** Wpłaty od najstarszej (przy tym samym dniu — po id, żeby kolejność była stała na obu telefonach). */
export const sortPayments = (list: Payment[]) => list.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));

export interface BillingLine {
  kind: "hours" | "points" | "lump" | "stage";
  /** „Godziny”, „Umywalka”, „Ryczałt za budowę”, nazwa etapu. */
  label: string;
  /** „42,5 h × 45 zł/h”, „3 × 150 zł”, „odhaczony 20.10.2026”. */
  detail: string;
  amount: number;
}

export interface BillingInput {
  billing: SiteBilling;
  /** Stawka godzinowa karty (`SiteCard.rate`). */
  rate?: number;
  /** Minuty na budowie do dziś (`siteMinutesInRange`) i dni z kilkoma budowami bez podziału. */
  minutes: number;
  unsplit: number;
  /** Punkty budowy: typ i czy po białym montażu. */
  points: readonly { type: string; done: boolean }[];
  /** Etapy karty (`siteStages`). */
  stages: readonly { id: string; name: string; done?: number }[];
  /** Nazwa typu punktu (`pointType(id).label`) — wstrzykiwana, żeby nie ciągnąć listy typów. */
  typeLabel: (id: string) => string;
}

export interface BillingStatement {
  lines: BillingLine[];
  accrued: number;
  paid: number;
  /** Naliczone − otrzymane; ujemne = nadpłata. */
  due: number;
  payments: Payment[];
  /** Czego brakuje do pełnego wyliczenia, np. „Brak stawki godzinowej”. */
  warnings: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const hoursNum = (min: number) => round2(min / 60).toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const dmy = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Zestawienie należności budowy (H3.2): godziny × stawka, gotowe punkty × stawka typu (lub domyślna),
 * ryczałt za całość (umówiona kwota, liczona od razu — zaliczki odejmują się od niej) i odhaczone
 * etapy × kwota etapu. Liczą się tylko włączone sposoby; wpłaty — zawsze.
 */
export function billingStatement(input: BillingInput): BillingStatement {
  const { billing: b, rate, minutes, unsplit, points, stages, typeLabel } = input;
  const on = (m: BillingMode) => b.modes.includes(m);
  const lines: BillingLine[] = [];
  const warnings: string[] = [];

  if (on("hours")) {
    if (!rate) { if (minutes > 0) warnings.push(`Brak stawki godzinowej — ${hoursNum(minutes)} h bez kwoty`); }
    else if (minutes > 0) lines.push({ kind: "hours", label: MODE_LABEL.hours, detail: `${hoursNum(minutes)} h × ${money(rate)}/h`, amount: round2((minutes / 60) * rate) });
    if (unsplit > 0) warnings.push(`Dni z kilkoma budowami bez podziału godzin: ${unsplit}`);
  }

  if (on("points")) {
    const byType = new Map<string, number>();
    for (const p of points) if (p.done) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
    let noRate = 0;
    for (const [type, count] of byType) {
      const r = pointRateFor(b, type);
      if (r === undefined) { noRate += count; continue; }
      lines.push({ kind: "points", label: typeLabel(type), detail: `${count} × ${money(r)}`, amount: round2(count * r) });
    }
    if (noRate > 0) warnings.push(`Gotowe punkty bez stawki: ${noRate}`);
    const pending = points.length - points.filter((p) => p.done).length;
    if (pending > 0) warnings.push(`Punkty przed białym montażem (jeszcze nie liczone): ${pending}`);
  }

  if (on("lump")) {
    if (b.lump !== undefined) lines.push({ kind: "lump", label: "Ryczałt za budowę", detail: "umówiona kwota", amount: b.lump });
    for (const s of stages) {
      const amount = b.stageAmounts[s.id];
      if (amount !== undefined && s.done !== undefined) lines.push({ kind: "stage", label: s.name, detail: `etap odhaczony ${dmy(s.done)}`, amount });
    }
  }

  const payments = sortPayments([...b.payments]);
  const accrued = round2(lines.reduce((s, l) => s + l.amount, 0));
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  return { lines, accrued, paid, due: round2(accrued - paid), payments, warnings };
}

const dayDmy = (key: string) => key.split("-").reverse().join(".");

/** Tekst do WhatsAppa: nagłówek, pozycje, wpłaty i „Zostało do zapłaty”. */
export function billingText(siteName: string, st: BillingStatement, today: string): string {
  const out = [`*Rozliczenie — ${siteName}*`, `stan na ${dayDmy(today)}`, ""];
  if (st.lines.length === 0) out.push("Nic jeszcze nie naliczone.");
  for (const l of st.lines) out.push(`• ${l.label}: ${l.detail} = ${money(l.amount)}`);
  out.push(`Naliczone razem: *${money(st.accrued)}*`);
  if (st.payments.length > 0) {
    out.push("", "Otrzymane:");
    for (const p of st.payments) out.push(`• ${dayDmy(p.day)}: ${money(p.amount)}${p.note ? ` (${p.note})` : ""}`);
    out.push(`Otrzymane razem: ${money(st.paid)}`);
  }
  out.push("", st.due >= 0 ? `*Zostało do zapłaty: ${money(st.due)}*` : `*Nadpłata: ${money(-st.due)}*`);
  return out.join("\n");
}

const csvNum = (n: number) => String(n).replace(".", ",");

/** CSV (separator `;`, BOM, przecinek dziesiętny — jak `siteMonthCsv`): pozycje, wpłaty, suma. */
export function billingCsv(st: BillingStatement): string {
  const rows: string[][] = [["Rodzaj", "Pozycja", "Szczegóły", "Kwota (zł)"]];
  for (const l of st.lines) rows.push(["Naliczone", l.label, l.detail, csvNum(l.amount)]);
  for (const p of st.payments) rows.push(["Otrzymane", p.day, p.note ?? "", csvNum(p.amount)]);
  rows.push([]);
  rows.push(["Razem", "Naliczone", "", csvNum(st.accrued)]);
  rows.push(["Razem", "Otrzymane", "", csvNum(st.paid)]);
  rows.push(["Razem", st.due >= 0 ? "Zostało do zapłaty" : "Nadpłata", "", csvNum(Math.abs(st.due))]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

// ── H3.3 Miesiąc razem: zarobek z budów poza godzinami ─────────────────────────────────────────

export interface MonthSiteEarnings {
  /** Punkty po białym montażu w miesiącu, ze stawką. */
  points: { count: number; amount: number };
  /** Gotowe w miesiącu punkty bez żadnej stawki (nie liczone). */
  pointsNoRate: number;
  /** Etapy odhaczone w miesiącu, z kwotą etapu. */
  stages: { count: number; amount: number };
  /** Ryczałt za całość, gdy budowa skończyła się w tym miesiącu (ostatni etap odhaczony); inaczej 0. */
  lump: number;
  total: number;
}

/**
 * Zarobek budowy w miesiącu `[from, to)` (ms) bez godzin — godziny liczy Grafik, więc tu ich nie ma
 * (H3.3: nic dwa razy). Punkt liczy się w miesiącu białego montażu, etap — w miesiącu odhaczenia,
 * ryczałt za całość — w miesiącu odhaczenia ostatniego etapu. Tylko włączone sposoby.
 */
export function monthSiteEarnings(
  input: { billing: SiteBilling; points: readonly { type: string; doneAt?: number }[]; stages: readonly { id: string; done?: number }[] },
  from: number, to: number,
): MonthSiteEarnings {
  const { billing: b, points, stages } = input;
  const inMonth = (t: number | undefined) => t !== undefined && t >= from && t < to;
  const out: MonthSiteEarnings = { points: { count: 0, amount: 0 }, pointsNoRate: 0, stages: { count: 0, amount: 0 }, lump: 0, total: 0 };
  if (b.modes.includes("points")) {
    for (const p of points) {
      if (!inMonth(p.doneAt)) continue;
      const r = pointRateFor(b, p.type);
      if (r === undefined) { out.pointsNoRate++; continue; }
      out.points.count++;
      out.points.amount = round2(out.points.amount + r);
    }
  }
  if (b.modes.includes("lump")) {
    for (const s of stages) {
      const amount = b.stageAmounts[s.id];
      if (amount !== undefined && inMonth(s.done)) { out.stages.count++; out.stages.amount = round2(out.stages.amount + amount); }
    }
    const finished = stages.length > 0 && stages.every((s) => s.done !== undefined);
    if (b.lump !== undefined && finished && inMonth(Math.max(...stages.map((s) => s.done!)))) out.lump = b.lump;
  }
  out.total = round2(out.points.amount + out.stages.amount + out.lump);
  return out;
}
