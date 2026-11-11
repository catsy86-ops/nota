import { useEffect, useState } from "react";
import { Gauge, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { clockLabel, defaultTest, isRunning, readingsLine, remainingSec, TEST_MEDIA, TEST_MEDIUM_LABEL, type PressureTest, type TestMedium } from "@/lib/study/pressureTest";
import { PressureChart } from "./PressureChart";
import { PressureTestTimer } from "./PressureTestTimer";

/**
 * Protokół próby szczelności w arkuszu wpisu: medium, ciśnienie, czas, spadek i wynik.
 * Bez protokołu — jeden przycisk „Protokół próby”, żeby zwykły wpis nie rósł o pola,
 * których nie potrzebuje.
 */
export function PressureTestFields({ value, topic, onChange }: { value: PressureTest | null; topic: string; onChange: (t: PressureTest | null) => void }) {
  const [timerOpen, setTimerOpen] = useState(false);
  // Licznik na przycisku, gdy próba trwa, a okno minutnika jest zamknięte.
  const running = !!value && isRunning(value);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(defaultTest(topic))}
        className="pressable flex w-full items-center gap-2 rounded-card border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted coarse:min-h-12"
      >
        <Gauge className="h-4 w-4 shrink-0" aria-hidden />Dodaj protokół próby szczelności
      </button>
    );
  }
  const sewer = value.medium === "sewer";
  const set = (patch: Partial<PressureTest>) => onChange({ ...value, ...patch });
  return (
    <>
      <fieldset className="min-w-0 space-y-3 rounded-card border border-primary/40 bg-primary/5 p-3" data-testid="pressure-test">
        <legend className="sr-only">Protokół próby szczelności</legend>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
          <p className="flex-1 text-sm font-medium">Protokół próby</p>
          {!sewer && (
            <Button size="sm" variant="outline" onClick={() => setTimerOpen(true)} className="coarse:h-9">
              <Clock className="mr-1 h-4 w-4" aria-hidden />Minutnik
              {isRunning(value) && <span className="ml-1 font-mono tabular-nums" data-testid="timer-badge">· {clockLabel(remainingSec(value, now))}</span>}
            </Button>
          )}
          <button type="button" onClick={() => onChange(null)} aria-label="Usuń protokół próby" className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted coarse:size-11">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      <ToggleGroup
        aria-label="Czym próba"
        value={value.medium}
        onValueChange={(m) => set(m === "sewer" ? { medium: "sewer", bar: null, drop: null } : { medium: m as TestMedium })}
      >
        {TEST_MEDIA.map((m) => <ToggleGroupItem key={m} value={m} className="coarse:h-11">{TEST_MEDIUM_LABEL[m]}</ToggleGroupItem>)}
      </ToggleGroup>
      <div className={cn("grid gap-2", sewer ? "grid-cols-1" : "grid-cols-3")}>
        {!sewer && <NumField label="Ciśnienie [bar]" value={value.bar} onChange={(bar) => set({ bar })} />}
        <NumField label="Czas [min]" value={value.minutes} onChange={(minutes) => set({ minutes })} />
        {!sewer && <NumField label="Spadek [bar]" value={value.drop} onChange={(drop) => set({ drop })} />}
      </div>
      <ToggleGroup aria-label="Wynik próby" value={value.ok ? "ok" : "fail"} onValueChange={(v) => set({ ok: v === "ok" })}>
        <ToggleGroupItem value="ok" className="coarse:h-11 data-[state=on]:text-success-ink">Szczelna</ToggleGroupItem>
        <ToggleGroupItem value="fail" className="coarse:h-11 data-[state=on]:text-destructive-ink">Nieszczelna</ToggleGroupItem>
      </ToggleGroup>
      {!running && value.readings && value.readings.length > 1 && (
        <div data-testid="test-readings">
          <PressureChart test={value} />
          <p className="ui-hint mt-1">{readingsLine(value)}</p>
        </div>
      )}
      </fieldset>
      {/* Minutnik zwraca cały protokół (koniec próby usuwa `startedAt`), więc zastępujemy, nie scalamy. */}
      <PressureTestTimer open={timerOpen} onOpenChange={setTimerOpen} test={value} onUpdate={onChange} />
    </>
  );
}

/** Pole liczby z przecinkiem dziesiętnym; tekst trzymany lokalnie, żeby „0,” nie znikało w trakcie pisania. */
function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value).replace(".", ","));
  // Wartość zmieniona z zewnątrz (minutnik wpisuje czas i spadek) musi trafić do pola; pisanie nie jest nadpisywane,
  // bo „0,” i „0” to ta sama liczba.
  useEffect(() => {
    const typed = Number.parseFloat(text.replace(",", "."));
    const same = value === null ? !Number.isFinite(typed) : typed === value;
    if (!same) setText(value === null ? "" : String(value).replace(".", ","));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaguje tylko na `value`
  }, [value]);
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      {label}
      <input
        value={text}
        inputMode="decimal"
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setText(raw);
          const n = Number.parseFloat(raw.replace(",", "."));
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="h-10 w-full rounded-field border border-input bg-background px-2 font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
      />
    </label>
  );
}
