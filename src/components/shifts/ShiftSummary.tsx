import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { TriangleAlert, CalendarRange, Settings2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastWithUndo } from "@/lib/undoToast";
import { pluralPl } from "@/lib/plural";
import { deleteBonus, FTE_OPTIONS, formatDuration, formatHoursShort, formatMoney, leaveBalance, saveBonus, useShifts, type MonthSummary, type PeriodSummary, type SettlementMonths, type ShiftBonus, type WorkSystem } from "@/lib/shifts";
import { PERIOD_LABELS } from "./labels";
import { CountUp } from "./CountUp";
import { LeaveMeter, YearSummaryDialog } from "./YearSummaryDialog";

/** Czas albo „—” dla zera — jak dotychczasowe kafelki „Nadgodziny” i „Do normy”. */
const durationOrDash = (min: number) => (Math.round(min) > 0 ? formatDuration(min) : "—");
import { cn } from "@/lib/utils";

interface ShiftSummaryProps {
  summary: MonthSummary;
  hourlyRate: number;
  workSystem: WorkSystem;
  settlementMonths: SettlementMonths;
  fte: number;
  /** „październik 2026” — nagłówek rachunku. */
  monthLabel: string;
  /** `YYYY-MM` — miesiąc, do którego dodaje się premie. */
  monthKey: string;
  onOpenSettings: () => void;
}

/** Miejscownik („w marcu”) — date-fns go nie zna. */
const IN_MONTH = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

const monthName = (year: number, month: number, pattern = "LLLL") => format(new Date(year, month, 1), pattern, { locale: pl });


/**
 * Podsumowanie miesiąca. Sercem jest pasek normy: wypełnia się do wymiaru
 * czasu pracy, a nadwyżka (nadgodziny) dosuwa się za nim w kolorze akcentu.
 */
export function ShiftSummary({ summary, hourlyRate, workSystem, settlementMonths, fte, monthLabel, monthKey, onOpenSettings }: ShiftSummaryProps) {
  const { minutes, normMinutes, overtimeMinutes, dailyOvertimeMinutes, overtime100Minutes } = summary;
  const scale = Math.max(normMinutes, minutes, 1);
  // Nadgodziny dobowe mogą być i poniżej normy miesiąca — pasek dzieli faktycznie przepracowane godziny.
  const extra = summary.extraTimeMinutes;
  const within = Math.max(0, minutes - overtimeMinutes - extra);
  const data = useShifts();
  const [yearOpen, setYearOpen] = useState(false);
  // Rok oglądanego miesiąca z jego etykiety („październik 2026”); bez niej — bieżący.
  const year = Number(/\b(\d{4})\b/.exec(monthLabel)?.[1]) || new Date().getFullYear();
  const balance = useMemo(() => leaveBalance(data, year, new Date()), [data, year]);

  return (
    <section aria-label="Podsumowanie miesiąca" className="rounded-3xl border border-border/60 bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Przepracowane</p>
          <p className="font-display font-extrabold text-4xl tabular-nums leading-none mt-1">
            <CountUp value={minutes} format={formatHoursShort} /><span className="text-lg font-bold text-muted-foreground ml-1">h</span>
            <span className="text-base font-semibold text-muted-foreground ml-2">/ <CountUp value={normMinutes} format={formatHoursShort} /> h normy</span>
          </p>
        </div>
        <button type="button" onClick={() => setYearOpen(true)} aria-label="Podsumowanie roku"
          className="pressable shrink-0 flex items-center gap-1.5 h-9 coarse:h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarRange className="w-4 h-4" aria-hidden /> Rok
        </button>
      </div>

      <div className="h-2.5 rounded-full bg-muted overflow-hidden flex" role="img"
        aria-label={`${formatDuration(minutes)} z ${formatDuration(normMinutes)} normy${extra ? `, ${formatDuration(extra)} ponadwymiarowych` : ""}${overtimeMinutes ? `, ${formatDuration(overtimeMinutes)} nadgodzin` : ""}`}>
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(within / scale) * 100}%` }} />
        {extra > 0 && <div className="h-full bg-primary/40 transition-[width] duration-500" style={{ width: `${(extra / scale) * 100}%` }} />}
        {/* Nadgodziny w kolorze marki w paski — róż był jedynym miejscem, gdzie akcent coś znaczył. */}
        {overtimeMinutes > 0 && <div className="h-full transition-[width] duration-500" style={{ width: `${(overtimeMinutes / scale) * 100}%`, backgroundImage: "repeating-linear-gradient(-45deg, hsl(var(--primary)) 0 4px, hsl(var(--primary) / 0.45) 4px 8px)" }} />}
      </div>

      {/* Kolumny wg szerokości kontenera (`@container` w ShiftsView): w panelu bocznym na xl dwie, nie cztery. */}
      <dl className="grid grid-cols-2 @lg:grid-cols-4 gap-3 text-sm">
        <Stat label="Dni pracy" value={<CountUp value={summary.daysWorked} format={(n) => String(Math.round(n))} />} />
        <Stat label="Nadgodziny" value={<CountUp value={overtimeMinutes} format={durationOrDash} />} accent={overtimeMinutes > 0}
          hint={overtimeMinutes > 0 ? [
            dailyOvertimeMinutes > 0 ? `dobowe ${formatDuration(dailyOvertimeMinutes)}` : null,
            overtime100Minutes > 0 ? `z dodatkiem 100% ${formatDuration(overtime100Minutes)}` : null,
          ].filter(Boolean).join(" · ") || undefined : undefined} />
        <Stat label="W nocy" value={<CountUp value={summary.nightMinutes} format={formatDuration} />} />
        <Stat label="Do normy" value={<CountUp value={Math.max(0, normMinutes - minutes)} format={durationOrDash} />} />
        {extra > 0 && (
          <Stat label="Ponadwymiarowe" value={<CountUp value={extra} format={formatDuration} />} hint="ponad etat, bez dodatku" />
        )}
      </dl>

      {summary.period && <PeriodProgress period={summary.period} />}

      <LeaveMeter balance={balance} />

      {summary.shortRests.length > 0 && (
        <div role="note" className="flex gap-2.5 rounded-card bg-destructive/10 px-3 py-2.5 text-sm">
          <TriangleAlert className="w-4 h-4 text-destructive-ink shrink-0 mt-0.5" aria-hidden />
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

      {summary.byType.length > 0 && <Receipt summary={summary} hourlyRate={hourlyRate} monthLabel={monthLabel} />}
      <BonusPanel monthKey={monthKey} bonuses={summary.bonuses} />


      {/* Bieżące ustawienia w jednej linii — pola są w oknie „Ustawienia grafiku”. */}
      <button type="button" onClick={onOpenSettings} aria-label="Ustawienia grafiku"
        className="pressable w-full flex items-center gap-2 border-t border-border/50 pt-3 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
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

      <YearSummaryDialog open={yearOpen} onOpenChange={setYearOpen} data={data} initialYear={year} />
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
    <div className="rounded-card bg-muted/50 px-3 py-2.5 space-y-1.5 text-sm">
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

function Stat({ label, value, accent = false, hint }: { label: string; value: ReactNode; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded-card bg-muted/50 px-3 py-2">
      <dt className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums font-semibold", accent && "text-primary-ink")}>{value}</dd>
      {hint && <dd className="text-2xs text-muted-foreground tabular-nums">{hint}</dd>}
    </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Rozliczenie miesiąca jako rachunek z baru („Zrobione przy piwie”): pozycje
 * z kropkami prowadzącymi do kwot, cyfry o stałej szerokości, dodatek za
 * nadgodziny osobną pozycją i „Razem brutto” pod podwójną kreską. Kwoty tylko,
 * gdy jest stawka — bez niej rachunek liczy same godziny.
 */
function Receipt({ summary, hourlyRate, monthLabel }: { summary: MonthSummary; hourlyRate: number; monthLabel: string }) {
  const paid = summary.earnings > 0;
  const lines = summary.byType.map(({ type, count, minutes }) => {
    const absence = type.kind === "absence";
    return {
      key: type.id, type, absence,
      qty: absence ? `${count} ${pluralPl(count, ["dzień", "dni", "dni"])}` : `${count} ${pluralPl(count, ["zmiana", "zmiany", "zmian"])}`,
      minutes,
      // Nieobecność nie jest pracą w tym rachunku — jej wynagrodzenie liczy kadra.
      amount: absence ? null : round2((minutes / 60) * (type.rate ?? hourlyRate)),
    };
  });
  const base = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  // Reszta zarobku to dodatek za nadgodziny (50/100%) — w podstawie każda godzina już jest.
  // Premie w rachunku są osobnymi liniami, więc odejmujemy je przed wyliczeniem dodatku.
  const premium = round2(summary.earnings - summary.bonusTotal - base);

  return (
    <div className="receipt font-mono text-xs sm:text-[0.8125rem] tabular-nums">
      <p className="flex justify-between gap-2 pb-2 text-2xs uppercase tracking-[0.2em] text-muted-foreground">
        <span>Rachunek</span><span>{monthLabel}</span>
      </p>
      <ul className="space-y-1.5">
        {lines.map((l) => (
          <ReceiptLine key={l.key} label={
            <span className="flex items-center gap-1.5 min-w-0">
              <span aria-hidden className={cn("w-2 h-2 rounded-full shrink-0", l.absence && "ring-[1.5px] ring-inset bg-transparent")}
                style={l.absence ? { ["--tw-ring-color" as string]: l.type.color } : { backgroundColor: l.type.color }} />
              <span className="truncate font-body font-medium">{l.type.name}</span>
              <span className="text-muted-foreground shrink-0">{l.qty}</span>
            </span>
          } hours={formatDuration(l.minutes)} amount={paid ? (l.amount === null ? "—" : formatMoney(l.amount)) : undefined} />
        ))}
        {paid && premium > 0 && (
          <ReceiptLine label={<span className="font-body font-medium">Dodatek za nadgodziny</span>}
            hours={formatDuration(summary.overtimeMinutes)} amount={formatMoney(premium)} />
        )}
        {paid && summary.bonuses.map((b) => (
          <ReceiptLine key={b.id} label={<span className="font-body font-medium truncate">Premia: {b.name}</span>} hours="" amount={formatMoney(b.amount)} />
        ))}
      </ul>
      {paid && (
        <p className="mt-3 pt-2 border-t-[3px] border-double border-foreground/40 flex items-baseline justify-between gap-3">
          <span className="font-body text-2xs font-semibold uppercase tracking-[0.2em]">Razem brutto</span>
          <span className="font-display font-extrabold text-xl sm:text-2xl text-primary-ink tabular-nums"><CountUp value={summary.earnings} format={formatMoney} /></span>
        </p>
      )}
    </div>
  );
}

function ReceiptLine({ label, hours, amount }: { label: ReactNode; hours: string; amount?: string }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="min-w-0 shrink">{label}</span>
      <span aria-hidden className="flex-1 min-w-4 translate-y-[-0.2em] border-b border-dotted border-muted-foreground/50" />
      <span className="shrink-0">{hours}</span>
      {amount !== undefined && <span className="shrink-0 w-26 text-right font-semibold">{amount}</span>}
    </li>
  );
}

/** Premie w rachunku tego miesiąca: lista z usuwaniem (z „Cofnij”) i dodawanie. Kwoty brutto w zł. */
function BonusPanel({ monthKey, bonuses }: { monthKey: string; bonuses: ShiftBonus[] }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const value = Number(amount.trim().replace(",", "."));
  const valid = name.trim().length > 0 && amount.trim() !== "" && Number.isFinite(value) && value > 0;

  const add = () => {
    if (!valid) return;
    if (!saveBonus({ id: `b-${crypto.randomUUID()}`, month: monthKey, name, amount: value })) return;
    setName("");
    setAmount("");
  };

  const remove = (b: ShiftBonus) => {
    const prev = deleteBonus(b.id);
    if (prev) toastWithUndo("Usunięto premię", () => saveBonus(prev), { description: prev.name });
  };

  return (
    <section aria-labelledby="bonus-title" className="rounded-card border border-border/60 bg-card p-4 space-y-3">
      <h3 id="bonus-title" className="text-sm font-medium">Premie w tym miesiącu</h3>
      {bonuses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak premii. Dodane kwoty doliczają się do zarobku brutto.</p>
      ) : (
        <ul className="divide-y divide-border/50" data-testid="bonus-list">
          {bonuses.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{b.name}</span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{formatMoney(b.amount)}</span>
              <Button variant="ghost" size="sm" className="coarse:h-11" aria-label={`Usuń premię: ${b.name}`} onClick={() => remove(b)}>
                <Trash className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input aria-label="Nazwa premii" placeholder="np. premia kwartalna" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <Input aria-label="Kwota premii (zł)" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
        <Button type="submit" size="sm" disabled={!valid} className="coarse:h-11">Dodaj premię</Button>
      </form>
    </section>
  );
}
