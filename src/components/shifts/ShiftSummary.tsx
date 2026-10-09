import { useEffect, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { pluralPl } from "@/lib/plural";
import { FTE_OPTIONS, SETTLEMENT_MONTHS, formatDuration, formatHoursShort, formatMoney, setFte, setHourlyRate, setOvertimeFrom, setSettlementMonths, setSettlementStart, setWorkSystem, type MonthSummary, type PeriodSummary, type SettlementMonths, type WorkSystem } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface ShiftSummaryProps {
  summary: MonthSummary;
  hourlyRate: number;
  workSystem: WorkSystem;
  settlementMonths: SettlementMonths;
  settlementStart: number;
  fte: number;
  overtimeFrom: number;
}

const PERIOD_LABELS: Record<SettlementMonths, string> = {
  1: "1 miesiąc", 2: "2 miesiące", 3: "3 miesiące (kwartał)", 4: "4 miesiące", 6: "6 miesięcy", 12: "12 miesięcy",
};

/** Miejscownik („w marcu”) — date-fns go nie zna. */
const IN_MONTH = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

const monthName = (year: number, month: number, pattern = "LLLL") => format(new Date(year, month, 1), pattern, { locale: pl });

const parseNum = (s: string) => parseFloat(s.replace(",", "."));

/**
 * Podsumowanie miesiąca. Sercem jest pasek normy: wypełnia się do wymiaru
 * czasu pracy, a nadwyżka (nadgodziny) dosuwa się za nim w kolorze akcentu.
 */
export function ShiftSummary({ summary, hourlyRate, workSystem, settlementMonths, settlementStart, fte, overtimeFrom }: ShiftSummaryProps) {
  const { minutes, normMinutes, overtimeMinutes, dailyOvertimeMinutes, overtime100Minutes } = summary;
  const scale = Math.max(normMinutes, minutes, 1);
  // Nadgodziny dobowe mogą być i poniżej normy miesiąca — pasek dzieli faktycznie przepracowane godziny.
  const extra = summary.extraTimeMinutes;
  const within = Math.max(0, minutes - overtimeMinutes - extra);

  return (
    <section aria-label="Podsumowanie miesiąca" className="rounded-3xl border border-border/60 bg-card/60 p-4 sm:p-5 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Przepracowane</p>
          <p className="font-display font-extrabold text-4xl tabular-nums leading-none mt-1">
            {formatHoursShort(minutes)}<span className="text-lg font-bold text-muted-foreground ml-1">h</span>
            <span className="text-base font-semibold text-muted-foreground ml-2">/ {formatHoursShort(normMinutes)} h normy</span>
          </p>
        </div>
        {summary.earnings > 0 && (
          <div className="text-right">
            <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Zarobek brutto</p>
            <p className="font-display font-bold text-xl text-primary tabular-nums">{formatMoney(summary.earnings)}</p>
          </div>
        )}
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex" role="img"
        aria-label={`${formatDuration(minutes)} z ${formatDuration(normMinutes)} normy${extra ? `, ${formatDuration(extra)} ponadwymiarowych` : ""}${overtimeMinutes ? `, ${formatDuration(overtimeMinutes)} nadgodzin` : ""}`}>
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(within / scale) * 100}%` }} />
        {extra > 0 && <div className="h-full bg-primary/40 transition-[width] duration-500" style={{ width: `${(extra / scale) * 100}%` }} />}
        {overtimeMinutes > 0 && <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(overtimeMinutes / scale) * 100}%` }} />}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Dni pracy" value={`${summary.daysWorked}`} />
        <Stat label="Nadgodziny" value={overtimeMinutes ? formatDuration(overtimeMinutes) : "—"} accent={overtimeMinutes > 0}
          hint={overtimeMinutes > 0 ? [
            dailyOvertimeMinutes > 0 ? `dobowe ${formatDuration(dailyOvertimeMinutes)}` : null,
            overtime100Minutes > 0 ? `z dodatkiem 100% ${formatDuration(overtime100Minutes)}` : null,
          ].filter(Boolean).join(" · ") || undefined : undefined} />
        <Stat label="W nocy" value={formatDuration(summary.nightMinutes)} />
        <Stat label="Do normy" value={minutes >= normMinutes ? "—" : formatDuration(normMinutes - minutes)} />
        {extra > 0 && (
          <Stat label="Ponadwymiarowe" value={formatDuration(extra)} hint="ponad etat, bez dodatku" />
        )}
      </dl>

      {summary.period && <PeriodProgress period={summary.period} />}

      {summary.shortRests.length > 0 && (
        <div role="note" className="flex gap-2.5 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden />
          <p>
            <span className="font-semibold">Za krótki odpoczynek</span>{" "}
            <span className="text-muted-foreground">(mniej niż 11 h przed zmianą): </span>
            {summary.shortRests.map((r) => {
              const [y, m, d] = r.dayKey.split("-").map(Number);
              return `${format(new Date(y, m - 1, d), "d MMMM", { locale: pl })} — ${formatDuration(r.restMinutes)}`;
            }).join(", ")}
          </p>
        </div>
      )}

      {summary.byType.length > 0 && (
        <ul className="space-y-1.5 border-t border-border/50 pt-3">
          {summary.byType.map(({ type, count, minutes: m }) => (
            <li key={type.id} className="flex items-center gap-2 text-sm">
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", type.kind === "absence" && "ring-2 ring-inset bg-transparent")}
                style={type.kind === "absence" ? { ["--tw-ring-color" as string]: type.color } : { backgroundColor: type.color }} />
              <span className="flex-1 truncate">{type.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {type.kind === "absence" ? `${count} ${pluralPl(count, ["dzień", "dni", "dni"])}` : `${count} ${pluralPl(count, ["zmiana", "zmiany", "zmian"])}`}
              </span>
              <span className="w-24 text-right tabular-nums font-medium">{formatDuration(m)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 border-t border-border/50 pt-3 text-sm">
        <NumberField label="Stawka za godzinę" unit="zł" min={0} value={hourlyRate} empty={0} onCommit={setHourlyRate} />
        <label className="flex items-center gap-2 sm:col-span-2">
          <span className="text-muted-foreground flex-1">System czasu pracy</span>
          <select value={workSystem} onChange={(e) => setWorkSystem(e.target.value as WorkSystem)}
            className={cn(FIELD, "w-auto pr-1 text-left")}>
            <option value="basic">Podstawowy — 8 h na dobę</option>
            <option value="equivalent">Równoważny — do 12 h wg grafiku</option>
          </select>
        </label>
        <label className="flex items-center gap-2 sm:col-span-2">
          <span className="text-muted-foreground flex-1">Wymiar etatu</span>
          <select value={FTE_OPTIONS.some(([v]) => v === fte) ? fte : 1} onChange={(e) => setFte(Number(e.target.value))}
            className={cn(FIELD, "w-auto pr-1 text-left")}>
            {FTE_OPTIONS.map(([v, label]) => <option key={label} value={v}>{label}</option>)}
          </select>
        </label>
        {fte < 1 && (
          <label className="flex items-center gap-2 sm:col-span-2">
            <span className="text-muted-foreground flex-1">Nadgodziny ponad</span>
            <select value={Math.max(fte, overtimeFrom)} onChange={(e) => setOvertimeFrom(Number(e.target.value))}
              className={cn(FIELD, "w-auto pr-1 text-left")}>
              {FTE_OPTIONS.filter(([v]) => v >= fte).map(([v, label]) => (
                <option key={label} value={v}>{v === 1 ? "pełny etat (ustawowo)" : `${label} etatu (z umowy)`}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 sm:col-span-2">
          <span className="text-muted-foreground flex-1">Okres rozliczeniowy</span>
          <select value={settlementMonths} onChange={(e) => setSettlementMonths(Number(e.target.value) as SettlementMonths)}
            className={cn(FIELD, "w-auto pr-1 text-left")}>
            {SETTLEMENT_MONTHS.map((m) => <option key={m} value={m}>{PERIOD_LABELS[m]}</option>)}
          </select>
        </label>
        {settlementMonths > 1 && (
          <label className="flex items-center gap-2 sm:col-span-2">
            <span className="text-muted-foreground flex-1">Okresy zaczynają się od</span>
            <select value={settlementStart} onChange={(e) => setSettlementStart(Number(e.target.value))}
              className={cn(FIELD, "w-auto pr-1 text-left")}>
              {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{monthName(2026, m)}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="text-2xs text-muted-foreground">
        Norma wg art. 130 Kodeksu pracy, proporcjonalna do etatu, pomniejszona o nieobecności w dni robocze. Przy niepełnym etacie nadgodziny liczą się ponad 8 h na dobę i ponad normę pełnego etatu albo granicę z umowy (art. 151 § 5 KP). Kolejne okresy rozliczeniowe liczone od wybranego miesiąca.
        Nadgodziny dobowe liczone w dobie pracowniczej (24 h od początku zmiany). Dodatek za nadgodziny wg art. 151¹ KP: 100% w nocy (22:00–6:00), w niedziele i święta oraz za przekroczenie normy, 50% za pozostałe. Odpoczynek dobowy 11 h (art. 132 KP).
      </p>
    </section>
  );
}

/**
 * Okres dłuższy niż miesiąc: ile z normy całego okresu już jest. Nadgodziny
 * ponad normę okresu wychodzą dopiero w jego ostatnim miesiącu — wcześniej
 * nadwyżkę może jeszcze wyrównać krótszy miesiąc.
 */
function PeriodProgress({ period }: { period: PeriodSummary }) {
  const last = period.startMonth + period.months - 1;
  const range = `${monthName(period.year, period.startMonth, "LLL")}–${monthName(period.year, last, "LLL yyyy")}`;
  const share = Math.min(1, period.minutes / Math.max(1, period.normMinutes));
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2.5 space-y-1.5 text-sm">
      <p className="flex justify-between gap-3 flex-wrap">
        <span className="text-muted-foreground">Okres {range}</span>
        <span className="tabular-nums font-semibold">
          {formatHoursShort(period.minutes)} / {formatHoursShort(period.normMinutes)} h
        </span>
      </p>
      <div className="h-1.5 rounded-full bg-background overflow-hidden" role="img"
        aria-label={`W okresie ${formatDuration(period.minutes)} z ${formatDuration(period.normMinutes)} normy`}>
        <div className="h-full bg-primary/70" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="text-2xs text-muted-foreground">
        {period.isLast
          ? "Ostatni miesiąc okresu — nadgodziny ponad normę całego okresu są w tym miesiącu."
          : `Nadgodziny ponad normę okresu policzymy w ${IN_MONTH[last % 12]}, w ostatnim miesiącu okresu.`}
      </p>
    </div>
  );
}

function Stat({ label, value, accent = false, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2">
      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums font-semibold", accent && "text-accent")}>{value}</dd>
      {hint && <dd className="text-2xs text-muted-foreground tabular-nums">{hint}</dd>}
    </div>
  );
}

const FIELD = "w-24 h-9 coarse:h-11 rounded-lg border border-input bg-background px-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface NumberFieldProps {
  label: string;
  unit: string;
  min: number;
  value: number;
  /** Wartość pokazywana jako puste pole (np. stawka 0 = „nie licz”). */
  empty?: number;
  onCommit: (n: number) => void;
}

/**
 * Pole liczby zapisywane na bieżąco, ale też odświeżane, gdy wartość zmieni
 * się z zewnątrz (inna karta, przywrócona kopia) — o ile użytkownik akurat w nim nie pisze.
 */
function NumberField({ label, unit, min, value, empty, onCommit }: NumberFieldProps) {
  const shown = (v: number) => (v === empty ? "" : String(v));
  const [text, setText] = useState(() => shown(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(value === empty ? "" : String(value)); }, [value, editing, empty]);
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground flex-1">{label}</span>
      <input type="number" inputMode="decimal" min={min} step={0.5} value={text} placeholder={String(empty ?? min)}
        onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
        onChange={(e) => { setText(e.target.value); onCommit(parseNum(e.target.value)); }}
        className={FIELD} />
      <span className="text-muted-foreground w-4">{unit}</span>
    </label>
  );
}
