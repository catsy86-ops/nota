import { useMemo, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { m as motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMotionPref } from "@/hooks/useMotionPref";
import { tween } from "@/lib/motion";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { formatHoursShort, formatMoney, leaveBalance, yearSummary, type LeaveBalance, type ShiftData } from "@/lib/shifts";

interface YearSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ShiftData;
  /** Rok, od którego okno startuje (rok oglądanego miesiąca). */
  initialYear: number;
}

const DAYS: [string, string, string] = ["dzień", "dni", "dni"];

/** Liczba dni albo „—” dla zera — rzędy tabeli czytają się szybciej bez zer. */
const orDash = (n: number, fmt: (n: number) => string = String) => (Math.round(n * 100) > 0 ? fmt(n) : "—");

/**
 * Podsumowanie roku jak strona zeszytu: miesiące w rzędach, suma pod podwójną
 * kreską, u góry licznik urlopu. Zarobek tylko, gdy cokolwiek zarobiono.
 */
export function YearSummaryDialog({ open, onOpenChange, data, initialYear }: YearSummaryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[min(88dvh,48rem)] overflow-y-auto">
        {/* Montowane z otwarciem — rok startuje od oglądanego miesiąca bez efektów. */}
        <YearBody data={data} initialYear={initialYear} />
      </DialogContent>
    </Dialog>
  );
}

function YearBody({ data, initialYear }: { data: ShiftData; initialYear: number }) {
  const [year, setYear] = useState(initialYear);
  const summary = useMemo(() => yearSummary(data, year), [data, year]);
  const balance = useMemo(() => leaveBalance(data, year, new Date()), [data, year]);
  const paid = summary.total.earnings > 0;
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display flex items-center gap-1">
          <button type="button" aria-label="Poprzedni rok" onClick={() => setYear((y) => y - 1)}
            className="pressable -ml-2 w-9 h-9 coarse:w-11 coarse:h-11 grid place-items-center rounded-lg outline-hidden hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="w-5 h-5" aria-hidden />
          </button>
          <span className="tabular-nums" aria-live="polite">Rok {year}</span>
          <button type="button" aria-label="Następny rok" onClick={() => setYear((y) => y + 1)}
            className="pressable w-9 h-9 coarse:w-11 coarse:h-11 grid place-items-center rounded-lg outline-hidden hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="w-5 h-5" aria-hidden />
          </button>
        </DialogTitle>
        <DialogDescription>Godziny, nadgodziny, urlop i L4 miesiąc po miesiącu.</DialogDescription>
      </DialogHeader>

      <LeaveMeter balance={balance} />

      {/* Na telefonie tabela przewija się w poziomie zamiast ściskać kolumny (5.6). */}
      <div className="font-mono text-xs sm:text-[0.8125rem] tabular-nums overflow-x-auto">
        <table className="w-full min-w-[30rem] table-fixed border-collapse">
          <caption className="sr-only">Podsumowanie roku {year} według miesięcy</caption>
          <colgroup>
            <col className="w-[15%]" />
            <col />
            <col />
            <col />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            {paid && <col className="w-[23%]" />}
          </colgroup>
          <thead>
            <tr className="text-2xs uppercase tracking-wider text-muted-foreground border-b-2 border-foreground/30">
              <th scope="col" className="text-left font-semibold py-1.5">Mies.</th>
              <th scope="col" className="text-right font-semibold py-1.5">Godz.</th>
              <th scope="col" className="text-right font-semibold py-1.5">Nadg.</th>
              <th scope="col" className="text-right font-semibold py-1.5">Noc</th>
              <th scope="col" className="text-right font-semibold py-1.5">Urlop</th>
              <th scope="col" className="text-right font-semibold py-1.5">L4</th>
              {paid && <th scope="col" className="text-right font-semibold py-1.5">Zarobek</th>}
            </tr>
          </thead>
          <tbody>
            {summary.months.map((m) => (
              <tr key={m.month} aria-current={m.month === currentMonth ? "date" : undefined}
                className={cn("border-b border-dotted border-muted-foreground/40", m.month === currentMonth && "bg-primary/10")}>
                <th scope="row" className="text-left font-body font-medium py-1.5 pl-1">
                  {format(new Date(year, m.month, 1), "LLL", { locale: pl }).replace(".", "")}
                </th>
                <Cell value={orDash(m.minutes, formatHoursShort)} muted={m.minutes === 0} />
                <Cell value={orDash(m.overtimeMinutes, formatHoursShort)} muted={m.overtimeMinutes === 0} accent={m.overtimeMinutes > 0} />
                <Cell value={orDash(m.nightMinutes, formatHoursShort)} muted={m.nightMinutes === 0} />
                <Cell value={orDash(m.leaveDays)} muted={m.leaveDays === 0} />
                <Cell value={orDash(m.sickDays)} muted={m.sickDays === 0} />
                {paid && <Cell value={orDash(m.earnings, (n) => formatMoney(n).replace(/\s?zł$/, ""))} muted={m.earnings === 0} />}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-[3px] border-double border-foreground/40 font-semibold">
              <th scope="row" className="text-left font-body text-2xs uppercase tracking-wider pt-2 pl-1">Razem</th>
              <Cell value={formatHoursShort(summary.total.minutes)} total />
              <Cell value={orDash(summary.total.overtimeMinutes, formatHoursShort)} total accent={summary.total.overtimeMinutes > 0} />
              <Cell value={orDash(summary.total.nightMinutes, formatHoursShort)} total />
              <Cell value={orDash(summary.total.leaveDays)} total />
              <Cell value={orDash(summary.total.sickDays)} total />
              {paid && <Cell value={formatMoney(summary.total.earnings).replace(/\s?zł$/, "")} total accent />}
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 font-body text-2xs text-muted-foreground">
          Godziny i nadgodziny w godzinach (np. 7,5 = 7 h 30 min).{paid ? " Zarobek brutto w zł." : ""}
        </p>
      </div>
    </>
  );
}

function Cell({ value, muted, accent, total }: { value: string; muted?: boolean; accent?: boolean; total?: boolean }) {
  return (
    <td className={cn("text-right py-1.5", total && "pt-2", muted && "text-muted-foreground/60", accent && "text-primary-ink")}>{value}</td>
  );
}

/** Pasek puli urlopu: wykorzystane pełnym kolorem, zaplanowane w paski — jak nadgodziny w podsumowaniu miesiąca. */
export function LeaveMeter({ balance }: { balance: LeaveBalance }) {
  const { reduced } = useMotionPref();
  const { allowance, used, planned, remaining } = balance;
  const scale = Math.max(allowance, used + planned, 1);
  const transition = reduced ? { duration: 0 } : tween.enter;
  const over = remaining < 0;
  return (
    <section aria-label={`Licznik urlopu ${balance.year}`} className="rounded-card bg-muted/50 px-3 py-2.5 space-y-2 text-sm">
      <p className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-muted-foreground">Urlop {balance.year}</span>
        <span className={cn("tabular-nums font-semibold", over && "text-destructive-ink")}>
          {over
            ? `${-remaining} ${pluralPl(-remaining, DAYS)} ponad wymiar`
            : `zostało ${remaining} z ${allowance} ${pluralPl(allowance, DAYS)}`}
        </span>
      </p>
      <div className="h-2 rounded-full bg-background overflow-hidden flex" role="img"
        aria-label={`Wykorzystane ${used}, zaplanowane ${planned}, wymiar ${allowance}`}>
        <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(used / scale) * 100}%` }} transition={transition} />
        <motion.div className="h-full" initial={{ width: 0 }} animate={{ width: `${(planned / scale) * 100}%` }} transition={transition}
          style={{ backgroundImage: "repeating-linear-gradient(-45deg, hsl(var(--primary)) 0 4px, hsl(var(--primary) / 0.45) 4px 8px)" }} />
      </div>
      <p className="text-2xs text-muted-foreground tabular-nums">
        wykorzystane {used} · zaplanowane {planned}
      </p>
      {balance.hours && (
        <p className="text-xs tabular-nums">
          <span className="text-muted-foreground">W godzinach: </span>
          <span className={cn("font-semibold", balance.hours.remaining < 0 && "text-destructive-ink")}>
            {balance.hours.remaining < 0 ? `${formatHoursShort(-balance.hours.remaining)} h ponad wymiar` : `zostało ${formatHoursShort(balance.hours.remaining)} h`}
          </span>
          <span className="text-muted-foreground"> z {formatHoursShort(balance.hours.allowance)} h (art. 154² KP)</span>
        </p>
      )}
    </section>
  );
}
