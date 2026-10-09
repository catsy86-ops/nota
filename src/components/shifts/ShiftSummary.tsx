import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { AlertTriangle, Settings2 } from "lucide-react";
import { pluralPl } from "@/lib/plural";
import { FTE_OPTIONS, formatDuration, formatHoursShort, formatMoney, type MonthSummary, type PeriodSummary, type SettlementMonths, type WorkSystem } from "@/lib/shifts";
import { PERIOD_LABELS } from "./labels";
import { cn } from "@/lib/utils";

interface ShiftSummaryProps {
  summary: MonthSummary;
  hourlyRate: number;
  workSystem: WorkSystem;
  settlementMonths: SettlementMonths;
  fte: number;
  onOpenSettings: () => void;
}

/** Miejscownik („w marcu”) — date-fns go nie zna. */
const IN_MONTH = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

const monthName = (year: number, month: number, pattern = "LLLL") => format(new Date(year, month, 1), pattern, { locale: pl });


/**
 * Podsumowanie miesiąca. Sercem jest pasek normy: wypełnia się do wymiaru
 * czasu pracy, a nadwyżka (nadgodziny) dosuwa się za nim w kolorze akcentu.
 */
export function ShiftSummary({ summary, hourlyRate, workSystem, settlementMonths, fte, onOpenSettings }: ShiftSummaryProps) {
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
        {/* Nadgodziny w kolorze marki w paski — róż był jedynym miejscem, gdzie akcent coś znaczył. */}
        {overtimeMinutes > 0 && <div className="h-full transition-[width] duration-500" style={{ width: `${(overtimeMinutes / scale) * 100}%`, backgroundImage: "repeating-linear-gradient(-45deg, hsl(var(--primary)) 0 4px, hsl(var(--primary) / 0.45) 4px 8px)" }} />}
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

      {/* Bieżące ustawienia w jednej linii — pola są w oknie „Ustawienia grafiku”. */}
      <button type="button" onClick={onOpenSettings} aria-label="Ustawienia grafiku"
        className="pressable w-full flex items-center gap-2 border-t border-border/50 pt-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
        <span className="flex-1 min-w-0 text-muted-foreground truncate">
          {[
            hourlyRate > 0 ? `${formatMoney(hourlyRate)}/h` : "bez stawki",
            workSystem === "basic" ? "system podstawowy" : "system równoważny",
            (FTE_OPTIONS.find(([v]) => v === fte)?.[1] ?? "pełny etat").toLowerCase(),
            `okres ${PERIOD_LABELS[settlementMonths].replace(/ \(.*\)/, "")}`,
          ].join(" · ")}
        </span>
        <span className="shrink-0 flex items-center gap-1.5 font-medium text-foreground">
          <Settings2 className="w-4 h-4" aria-hidden /> Zmień
        </span>
      </button>
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
      <dd className={cn("tabular-nums font-semibold", accent && "text-primary")}>{value}</dd>
      {hint && <dd className="text-2xs text-muted-foreground tabular-nums">{hint}</dd>}
    </div>
  );
}
