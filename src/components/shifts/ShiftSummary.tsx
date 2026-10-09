import { pluralPl } from "@/lib/plural";
import { formatDuration, formatHoursShort, formatMoney, setHourlyRate, setOvertimeMultiplier, type MonthSummary } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface ShiftSummaryProps {
  summary: MonthSummary;
  hourlyRate: number;
  overtimeMultiplier: number;
}

const parseNum = (s: string) => parseFloat(s.replace(",", "."));

/**
 * Podsumowanie miesiąca. Sercem jest pasek normy: wypełnia się do wymiaru
 * czasu pracy, a nadwyżka (nadgodziny) dosuwa się za nim w kolorze akcentu.
 */
export function ShiftSummary({ summary, hourlyRate, overtimeMultiplier }: ShiftSummaryProps) {
  const { minutes, normMinutes, overtimeMinutes } = summary;
  const scale = Math.max(normMinutes, minutes, 1);
  const within = Math.min(minutes, normMinutes);

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
        aria-label={`${formatDuration(minutes)} z ${formatDuration(normMinutes)} normy${overtimeMinutes ? `, ${formatDuration(overtimeMinutes)} nadgodzin` : ""}`}>
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(within / scale) * 100}%` }} />
        {overtimeMinutes > 0 && <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${(overtimeMinutes / scale) * 100}%` }} />}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Dni pracy" value={`${summary.daysWorked}`} />
        <Stat label="Nadgodziny" value={overtimeMinutes ? formatDuration(overtimeMinutes) : "—"} accent={overtimeMinutes > 0} />
        <Stat label="W nocy" value={formatDuration(summary.nightMinutes)} />
        <Stat label="Do normy" value={minutes >= normMinutes ? "—" : formatDuration(normMinutes - minutes)} />
      </dl>

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
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground flex-1">Stawka za godzinę</span>
          <input type="number" inputMode="decimal" min={0} step={0.5} defaultValue={hourlyRate || ""} placeholder="0"
            onChange={(e) => setHourlyRate(parseNum(e.target.value))}
            className="w-24 h-9 coarse:h-11 rounded-lg border border-input bg-background px-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground w-4">zł</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground flex-1">Mnożnik nadgodzin</span>
          <input type="number" inputMode="decimal" min={1} step={0.5} defaultValue={overtimeMultiplier}
            onChange={(e) => setOvertimeMultiplier(parseNum(e.target.value))}
            className="w-24 h-9 coarse:h-11 rounded-lg border border-input bg-background px-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground w-4">×</span>
        </label>
      </div>
      <p className="text-2xs text-muted-foreground">
        Norma wg art. 130 Kodeksu pracy dla pełnego etatu, pomniejszona o nieobecności. Pora nocna 22:00–6:00.
      </p>
    </section>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-muted/50 px-3 py-2">
      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums font-semibold", accent && "text-accent")}>{value}</dd>
    </div>
  );
}
