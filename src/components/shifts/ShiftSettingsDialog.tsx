import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { EVENING_NUDGE_HOURS, FTE_OPTIONS, NIGHT_HOURS, NIGHT_STARTS, SETTLEMENT_MONTHS, setFte, setHourlyRate, setLeaveDays, setNightFrom, setOvertimeFrom, setSettlementMonths, setSettlementStart, setSundayFrom, setWorkSystem, type SettlementMonths, type ShiftData, type WorkSystem } from "@/lib/shifts";
import { readEveningNudgeTime, writeEveningNudgeTime } from "@/lib/shifts";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS, WORK_SYSTEM_LABELS } from "./labels";

type Settings = Pick<ShiftData, "hourlyRate" | "workSystem" | "settlementMonths" | "settlementStart" | "fte" | "leaveDays" | "overtimeFrom" | "sundayFrom" | "nightFrom">;

interface ShiftSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
}

const monthName = (m: number) => format(new Date(2026, m, 1), "LLLL", { locale: pl });

const parseNum = (s: string) => parseFloat(s.replace(",", "."));

const CONTROL = "w-full h-10 coarse:h-11 rounded-lg border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Ustawienia rozliczenia: stawka, system czasu pracy, etat, okres, pora nocna
 * i doba niedzieli. Wcześniej rosły wewnątrz podsumowania i przykrywały liczby.
 * Pola jedno pod drugim — etykieta nad polem, więc na telefonie nic się nie łamie.
 */
export function ShiftSettingsDialog({ open, onOpenChange, settings: s }: ShiftSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md max-h-[min(88dvh,44rem)] overflow-y-auto"
        // Fokus na okno, nie na pole stawki — na telefonie klawiatura zasłaniałaby pół ustawień.
        onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
        <DialogHeader>
          <DialogTitle className="font-display">Ustawienia grafiku</DialogTitle>
          <DialogDescription>Na ich podstawie liczymy normę, nadgodziny i zarobek. Zmiany zapisują się od razu.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RateField value={s.hourlyRate} />
          <Field label="System czasu pracy">
            <select value={s.workSystem} onChange={(e) => setWorkSystem(e.target.value as WorkSystem)} className={CONTROL}>
              {(Object.keys(WORK_SYSTEM_LABELS) as WorkSystem[]).map((k) => <option key={k} value={k}>{WORK_SYSTEM_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field label="Wymiar etatu">
            <select value={FTE_OPTIONS.some(([v]) => v === s.fte) ? s.fte : 1} onChange={(e) => setFte(Number(e.target.value))} className={CONTROL}>
              {FTE_OPTIONS.map(([v, label]) => <option key={label} value={v}>{label}</option>)}
            </select>
          </Field>
          {s.fte < 1 && (
            <Field label="Nadgodziny ponad" hint="Do tej granicy praca ponad etat to godziny ponadwymiarowe, bez dodatku (art. 151 § 5 KP).">
              <select value={Math.max(s.fte, s.overtimeFrom)} onChange={(e) => setOvertimeFrom(Number(e.target.value))} className={CONTROL}>
                {FTE_OPTIONS.filter(([v]) => v >= s.fte).map(([v, label]) => (
                  <option key={label} value={v}>{v === 1 ? "pełny etat (ustawowo)" : `${label} etatu (z umowy)`}</option>
                ))}
              </select>
            </Field>
          )}
          <LeaveDaysField value={s.leaveDays} />
          <Field label="Okres rozliczeniowy">
            <select value={s.settlementMonths} onChange={(e) => setSettlementMonths(Number(e.target.value) as SettlementMonths)} className={CONTROL}>
              {SETTLEMENT_MONTHS.map((m) => <option key={m} value={m}>{PERIOD_LABELS[m]}</option>)}
            </select>
          </Field>
          {s.settlementMonths > 1 && (
            <Field label="Okresy zaczynają się od">
              <select value={s.settlementStart} onChange={(e) => setSettlementStart(Number(e.target.value))} className={CONTROL}>
                {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{monthName(m)}</option>)}
              </select>
            </Field>
          )}
          <EveningNudgeField />
          {/* Pora nocna i doba niedzieli zwykle zostają ustawowe — zmienia się je tylko, gdy regulamin pracy mówi inaczej. */}
          <details open={s.nightFrom !== 22 || s.sundayFrom !== 6 || undefined} className="group rounded-card border border-border/60 px-3 py-2.5">
            <summary className="cursor-pointer text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-md">
              Opcjonalne <span className="font-normal text-muted-foreground">— pora nocna, niedziela i święto</span>
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">Zostaw ustawowe, jeśli regulamin pracy nie ustala inaczej.</p>
            <div className="mt-3 space-y-4">
              <Field label="Pora nocna" hint="8 godzin między 21 a 7 — tak, jak ustala regulamin pracy (art. 151⁷ KP).">
                <select value={s.nightFrom} onChange={(e) => setNightFrom(Number(e.target.value))} className={CONTROL}>
                  {NIGHT_STARTS.map((h) => <option key={h} value={h}>{`${h}:00–${(h + NIGHT_HOURS) % 24}:00`}</option>)}
                </select>
              </Field>
              <Field label="Niedziela i święto od godziny" hint="Do tej samej godziny następnego dnia (art. 151¹⁰ KP).">
                <select value={s.sundayFrom} onChange={(e) => setSundayFrom(Number(e.target.value))} className={CONTROL}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h}:00`}{h === 6 ? " (ustawowo)" : ""}</option>)}
                </select>
              </Field>
            </div>
          </details>
        </div>

        <details className="group rounded-card bg-muted/50 px-3 py-2.5 text-sm">
          <summary className="cursor-pointer font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-md">Jak liczymy?</summary>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
            <li>Norma miesiąca wg art. 130 KP, proporcjonalna do etatu, pomniejszona o nieobecności w dni robocze.</li>
            <li>Nadgodziny dobowe: ponad 8 h (w systemie równoważnym ponad godziny z grafiku, do 12 h) w dobie pracowniczej, czyli 24 h od początku zmiany.</li>
            <li>Nadgodziny ponad normę okresu rozliczeniowego wychodzą w jego ostatnim miesiącu.</li>
            <li>Dodatek 100%: w porze nocnej, w niedzielę i święto wolne wg grafiku, w dzień wolny za niedzielę lub święto, za przekroczenie normy okresu. Pozostałe nadgodziny: 50% (art. 151¹ KP).</li>
            <li>Dzień „poza grafikiem” i „wolny za niedzielę” zaznaczysz w oknie dnia.</li>
            <li>Przerwa bez godziny skraca koniec zmiany.</li>
            <li>Licznik urlopu liczy dni nieobecności typu „Urlop” w dni robocze (pon–pt bez świąt) — tak jak norma miesiąca.</li>
            <li>Odpoczynek dobowy: co najmniej 11 h (art. 132 KP).</li>
          </ul>
        </details>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

/**
 * Roczny wymiar urlopu: 20 dni (staż poniżej 10 lat) albo 26 (od 10 lat) —
 * ale też dowolna liczba całkowita 0–99, np. proporcjonalnie przy zmianie pracy.
 */
function LeaveDaysField({ value }: { value: number }) {
  const [text, setText] = useState(() => String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(value)); }, [value, editing]);
  const invalid = text.trim() !== "" && !(/^\d{1,2}$/.test(text.trim()));
  return (
    <Field label="Roczny wymiar urlopu" hint="20 dni (staż do 10 lat) albo 26 dni (od 10 lat). Licznik pokazuje, ile zostało.">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input type="number" inputMode="numeric" min={0} max={99} step={1} value={text}
            aria-invalid={invalid || undefined}
            onFocus={() => setEditing(true)}
            onBlur={() => { setEditing(false); setText(String(value)); }}
            onChange={(e) => {
              setText(e.target.value);
              const v = e.target.value.trim();
              // Tylko poprawna liczba się zapisuje; pusta albo błędna zostawia poprzednią wartość.
              if (/^\d{1,2}$/.test(v)) setLeaveDays(Number(v));
            }}
            className={`${CONTROL} pr-12 tabular-nums`} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">dni</span>
        </div>
        {[20, 26].map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => { setText(String(n)); setLeaveDays(n); }}
            className={cn("pressable h-10 coarse:h-11 min-w-12 px-3 rounded-lg border text-sm font-medium tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              value === n ? "border-primary bg-primary/10 text-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground")}>
            {n}
          </button>
        ))}
      </div>
    </Field>
  );
}

/** Godzina wieczornego przypomnienia o jutrzejszej zmianie — ustawienie tego urządzenia. */
function EveningNudgeField() {
  const [time, setTime] = useState(() => readEveningNudgeTime() ?? "");
  return (
    <Field label="Przypomnienie o jutrzejszej zmianie" hint="Wieczorem przypomni, jaką masz zmianę następnego dnia. Działa na tym urządzeniu, gdy aplikacja jest otwarta.">
      <select
        value={time}
        onChange={(e) => {
          const v = e.target.value;
          setTime(v);
          writeEveningNudgeTime(v || null);
          if (v) requestNotificationPermissionOnIntent();
        }}
        className={CONTROL}
      >
        <option value="">Wyłączone</option>
        {EVENING_NUDGE_HOURS.map((h) => <option key={h} value={`${h}:00`}>{`codziennie o ${h}:00`}</option>)}
      </select>
    </Field>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      {/* Podpowiedź poza <label>, żeby nie wchodziła do nazwy pola czytanej przez czytnik ekranu. */}
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Stawka zapisywana na bieżąco, ale też odświeżana, gdy zmieni się z zewnątrz
 * (inna karta, przywrócona kopia) — o ile użytkownik akurat w niej nie pisze.
 */
function RateField({ value }: { value: number }) {
  const shown = (v: number) => (v === 0 ? "" : String(v));
  const [text, setText] = useState(() => shown(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(value === 0 ? "" : String(value)); }, [value, editing]);
  return (
    <Field label="Stawka za godzinę" hint="Puste pole — zarobek nie jest liczony.">
      <div className="relative">
        <input type="number" inputMode="decimal" min={0} step={0.5} value={text} placeholder="0"
          onFocus={() => setEditing(true)} onBlur={() => setEditing(false)}
          onChange={(e) => { setText(e.target.value); setHourlyRate(parseNum(e.target.value)); }}
          className={`${CONTROL} pr-10 tabular-nums`} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">zł</span>
      </div>
    </Field>
  );
}
