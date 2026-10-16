import { pluralPl } from "@/lib/plural";
import { fittingsLine, sumFittings, type Fitting } from "./fittings";
import { testLine } from "./pressureTest";
import { dayType, isAbsence, type ShiftData } from "@/lib/shifts/model";
import { entryMinutesOn, formatDuration } from "@/lib/shifts/time";
import { entriesPl, KIND_LABEL } from "./journalView";
import { entrySiteId, type SiteCard } from "./sites";
import { siteOrder } from "./order";
import { stageProgress, type SiteStage } from "./stages";
import { openShortages, shortageLine, type Shortage } from "./shortages";
import type { JournalEntry } from "./yStudy";

/**
 * Raport z dziennika budowy: dzień albo zakres dni, jedna budowa albo wszystkie.
 * Czysta funkcja — ekran raportu, „Udostępnij”, „Do notatki” i wydruk biorą
 * ten sam wynik. Godziny pracy z Grafiku (dzień z wpisem w raporcie i zmianą).
 */

export interface ReportOptions {
  /** Id budowy (`entrySiteId`); `null` = wszystkie, `""` = wpisy bez budowy. */
  siteId: string | null;
  /** Karta wybranej budowy: nazwa, adres i inwestor w nagłówku raportu. */
  siteCard?: Pick<SiteCard, "name" | "address" | "investor" | "orderedAt" | "stages" | "shortages"> | null;
  /** Dni lokalne „2026-10-14”, oba włącznie. */
  from: string;
  to: string;
  shifts?: ShiftData | null;
  topicTitle?: (id: string) => string | null;
}

export interface ReportWork {
  /** „Budowa 07:00–17:00” albo „Urlop”. */
  label: string;
  /** Czas pracy z odchyleniem; 0 przy nieobecności. */
  minutes: number;
}

export interface ReportEntry {
  entry: JournalEntry;
  /** „08:15”. */
  time: string;
  /** „Problem otwarty”, „Problem rozwiązany 15.10”, „Zrobione”… */
  status: string;
  topic: string | null;
  /** Budowa wpisu — tylko w raporcie ze wszystkich budów. */
  site: string | null;
}

export interface ReportDay {
  key: string;
  label: string;
  work: ReportWork | null;
  entries: ReportEntry[];
}

export interface JournalReport {
  title: string;
  /** „14 października 2026” albo „7–14 października 2026”. */
  period: string;
  /** Nazwa budowy; `null` = wszystkie, `""` = bez budowy. */
  site: string | null;
  address: string;
  investor: string;
  days: ReportDay[];
  count: number;
  workMinutes: number;
  /** Problemy z raportu, które wciąż są otwarte. */
  open: ReportEntry[];
  /** Zdjęcia wszystkich wpisów, od najstarszego. */
  images: string[];
  /** Suma kształtek z wpisów raportu, od największej liczby. */
  fittings: Fitting[];
  /**
   * Kształtki do zamówienia na tej budowie: zużyte od ostatniego zamówienia (`order.ts`), niezależnie
   * od okresu raportu. Puste dla raportu wszystkich budów i wpisów bez budowy.
   */
  toOrder: Fitting[];
  /**
   * Etapy budowy z karty (`stages.ts`) — tylko raport jednej budowy, której karta ma własną listę
   * (ktoś ją odhaczał). `null` = bez sekcji etapów.
   */
  stages: SiteStage[] | null;
  /** Braki materiału, które jeszcze nie dojechały (brakuje, zamówione) — tylko raport jednej budowy. */
  shortages: Shortage[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const dayKeyOf = (at: number) => keyOf(new Date(at));

/** Dzień `key` przesunięty o `n` dni. */
export const shiftKey = (key: string, n: number) => {
  const d = dateOf(key);
  return keyOf(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

const MONTH_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

/** „14 października 2026”, „7–14 października 2026”, „28 września – 3 października 2026”. */
export function periodLabel(from: string, to: string): string {
  const a = dateOf(from);
  const b = dateOf(to);
  const full = (d: Date) => `${d.getDate()} ${MONTH_GEN[d.getMonth()]} ${d.getFullYear()}`;
  if (from === to) return full(a);
  if (a.getFullYear() !== b.getFullYear()) return `${full(a)} – ${full(b)}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${MONTH_GEN[a.getMonth()]} – ${full(b)}`;
  return `${a.getDate()}–${full(b)}`;
}

const dayTitle = (key: string) => {
  const d = dateOf(key);
  return `${d.toLocaleDateString("pl-PL", { weekday: "long" })}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}`;
};

const shortDate = (at: number) => {
  const d = new Date(at);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

/** Zmiana z Grafiku w dniu `key`; `null`, gdy dzień bez wpisu w Grafiku. */
export function workOn(shifts: ShiftData | null | undefined, key: string): ReportWork | null {
  const entry = shifts?.days[key];
  const base = entry && shifts.types.find((t) => t.id === entry.type);
  if (!base) return null;
  const t = dayType(base, entry);
  if (isAbsence(t)) return { label: t.name, minutes: 0 };
  return { label: `${t.name} ${t.start}–${t.end}`, minutes: entryMinutesOn(t, entry, key) };
}

export function buildJournalReport(journal: readonly JournalEntry[], opts: ReportOptions): JournalReport {
  const from = opts.from <= opts.to ? opts.from : opts.to;
  const to = opts.from <= opts.to ? opts.to : opts.from;
  const title = (id: string | null) => (id ? opts.topicTitle?.(id) ?? null : null);
  const picked = journal
    .filter((e) => {
      const k = dayKeyOf(e.at);
      return k >= from && k <= to && (opts.siteId === null || entrySiteId(e) === opts.siteId);
    })
    .sort((a, b) => a.at - b.at);

  const days: ReportDay[] = [];
  const open: ReportEntry[] = [];
  for (const e of picked) {
    const key = dayKeyOf(e.at);
    let day = days[days.length - 1];
    if (!day || day.key !== key) days.push((day = { key, label: dayTitle(key), work: workOn(opts.shifts, key), entries: [] }));
    const d = new Date(e.at);
    const isOpen = e.kind === "problem" && e.resolved === undefined;
    const item: ReportEntry = {
      entry: e,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      status: e.kind !== "problem" ? KIND_LABEL[e.kind] : isOpen ? "Problem otwarty" : `Problem rozwiązany ${shortDate(e.resolved!)}`,
      topic: title(e.topic),
      site: opts.siteId === null ? e.site.trim() || "bez budowy" : null,
    };
    day.entries.push(item);
    if (isOpen) open.push(item);
  }

  const period = periodLabel(from, to);
  const site = opts.siteId === null ? null : opts.siteId === "" ? "" : opts.siteCard?.name ?? picked[picked.length - 1]?.site.trim() ?? "";
  return {
    title: `Raport${site ? `: ${site}` : site === "" ? ": bez budowy" : ""} — ${period}`,
    period,
    site,
    address: (opts.siteId && opts.siteCard?.address) || "",
    investor: (opts.siteId && opts.siteCard?.investor) || "",
    days,
    count: picked.length,
    workMinutes: days.reduce((s, d) => s + (d.work?.minutes ?? 0), 0),
    open,
    images: picked.flatMap((e) => e.images),
    fittings: sumFittings(picked.map((e) => e.fittings)),
    toOrder: opts.siteId ? siteOrder(journal, opts.siteId, opts.siteCard?.orderedAt).items : [],
    stages: opts.siteId && opts.siteCard?.stages ? opts.siteCard.stages.map((s) => ({ ...s })) : null,
    shortages: opts.siteId ? openShortages(opts.siteCard?.shortages ?? []) : [],
  };
}

const photosPl = (n: number) => `${n} ${pluralPl(n, ["zdjęcie", "zdjęcia", "zdjęć"])}`;

/** Jednowierszowy opis wpisu bez godziny: „Problem otwarty: Żółta rura przecieka · temat · 2 zdjęcia”. */
function entryLine(r: ReportEntry): string {
  const text = r.entry.text.trim() || "Sprawdzone punkty listy";
  const extra = [r.site, r.topic && `temat: ${r.topic}`, r.entry.images.length > 0 && photosPl(r.entry.images.length)].filter(Boolean);
  // Kolejne linie tekstu wcięte — zostają w tym samym punkcie listy.
  const test = r.entry.test ? `\n  ${testLine(r.entry.test)}` : "";
  const fit = r.entry.fittings?.length ? `\n  Kształtki: ${fittingsLine(r.entry.fittings)}` : "";
  return `${r.status}: ${text.replace(/\n+/g, "\n  ")}${extra.length ? ` (${extra.join(", ")})` : ""}${test}${fit}`;
}

/** Podsumowanie raportu w jednej linii: „5 wpisów · godziny pracy: 18 h · otwarte problemy: 1”. */
export function reportSummary(r: JournalReport): string {
  const parts = [entriesPl(r.count)];
  if (r.stages && r.stages.length > 0) {
    const p = stageProgress(r.stages);
    parts.push(`postęp: ${p.done}/${p.total} ${pluralPl(p.total, ["etap", "etapy", "etapów"])}`);
  }
  if (r.workMinutes > 0) parts.push(`godziny pracy: ${formatDuration(r.workMinutes)}`);
  if (r.shortages.length > 0) parts.push(`braki materiału: ${r.shortages.length}`);
  if (r.open.length > 0) parts.push(`otwarte problemy: ${r.open.length}`);
  return parts.join(" · ");
}

/** Treść raportu bez tytułu (markdown) — do notatki; `reportText` dokłada tytuł. */
export function reportBody(r: JournalReport): string {
  const lines: string[] = [];
  if (r.address) lines.push(`Adres: ${r.address}`);
  if (r.investor) lines.push(`Inwestor: ${r.investor}`);
  lines.push(reportSummary(r));
  if (r.count === 0) return lines.join("\n");
  for (const d of r.days) {
    lines.push("", `## ${d.label}`);
    if (d.work) lines.push(d.work.minutes > 0 ? `Praca: ${d.work.label}, ${formatDuration(d.work.minutes)}` : `Grafik: ${d.work.label}`);
    for (const e of d.entries) lines.push(`- ${e.time} ${entryLine(e)}`);
  }
  if (r.fittings.length > 0) {
    lines.push("", "## Kształtki (suma)");
    for (const f of r.fittings) lines.push(`- ${f.name}: ${f.qty} szt.`);
  }
  if (r.stages && r.stages.length > 0) {
    const p = stageProgress(r.stages);
    lines.push("", `## Etapy (${p.done}/${p.total})`);
    for (const s of r.stages) lines.push(s.done !== undefined ? `- [x] ${s.name} (${shortDate(s.done)})` : `- [ ] ${s.name}`);
  }
  if (r.shortages.length > 0) {
    lines.push("", "## Braki materiału");
    for (const s of r.shortages) lines.push(`- ${shortageLine(s)}`);
  }
  if (r.toOrder.length > 0) {
    lines.push("", "## Do zamówienia");
    for (const f of r.toOrder) lines.push(`- ${f.name}: ${f.qty} szt.`);
  }
  if (r.open.length > 0) {
    lines.push("", "## Otwarte problemy");
    for (const e of r.open) lines.push(`- ${shortDate(e.entry.at)} ${e.entry.text.trim().split("\n")[0] || "bez opisu"}`);
  }
  return lines.join("\n");
}

/** Cały raport jako tekst do udostępnienia i schowka. */
export const reportText = (r: JournalReport) => `# ${r.title}\n\n${reportBody(r)}\n`;

/**
 * Raport do WhatsApp: komunikator nie zna nagłówków markdown — tytuł i dni
 * pogrubione (`*…*`), listy „- ” zostają (WhatsApp je rozumie).
 */
export function reportWhatsApp(r: JournalReport): string {
  const body = reportBody(r)
    .replace(/^## (.+)$/gm, "*$1*")
    // Pola listy zadań markdown WhatsApp pokazuje dosłownie — znaczki czyta każdy.
    .replace(/^- \[x\] /gm, "✅ ")
    .replace(/^- \[ \] /gm, "⬜ ");
  return `*${r.title}*\n\n${body}`;
}
