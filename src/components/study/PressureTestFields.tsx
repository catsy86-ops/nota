import { useState } from "react";
import { Gauge, X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { defaultTest, TEST_MEDIA, TEST_MEDIUM_LABEL, type PressureTest, type TestMedium } from "@/lib/study/pressureTest";

/**
 * Protokół próby szczelności w arkuszu wpisu: medium, ciśnienie, czas, spadek i wynik.
 * Bez protokołu — jeden przycisk „Protokół próby”, żeby zwykły wpis nie rósł o pola,
 * których nie potrzebuje.
 */
export function PressureTestFields({ value, topic, onChange }: { value: PressureTest | null; topic: string; onChange: (t: PressureTest | null) => void }) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(defaultTest(topic))}
        className="pressable flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted coarse:min-h-12"
      >
        <Gauge className="h-4 w-4 shrink-0" aria-hidden />Dodaj protokół próby szczelności
      </button>
    );
  }
  const sewer = value.medium === "sewer";
  const set = (patch: Partial<PressureTest>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3" data-testid="pressure-test">
      <legend className="sr-only">Protokół próby szczelności</legend>
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
        <p className="flex-1 text-sm font-medium">Protokół próby</p>
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
        <ToggleGroupItem value="fail" className="coarse:h-11 data-[state=on]:text-destructive">Nieszczelna</ToggleGroupItem>
      </ToggleGroup>
    </fieldset>
  );
}

/** Pole liczby z przecinkiem dziesiętnym; tekst trzymany lokalnie, żeby „0,” nie znikało w trakcie pisania. */
function NumField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value).replace(".", ","));
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
        className="h-10 w-full rounded-lg border border-input bg-background px-2 font-mono text-base tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
      />
    </label>
  );
}
