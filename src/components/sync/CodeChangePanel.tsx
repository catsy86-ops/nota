import { useState } from "react";
import { format } from "date-fns";
import { Check, Circle, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { canCancelRekey, canSkipMarker, type RekeyRecord, type RekeyResult, type RekeyStep, type RunOptions } from "@/lib/sync/rekey";
import { useRekeyRecord } from "@/lib/sync/rekeyRuntime";
import { cancelCodeChange, dismissCodeChange, markRekeyDevicePaired, prepareCodeChange, runCodeChange } from "@/lib/yjsSync";

/** Kroki widoczne dla użytkownika (§3.7) i krok zapisu, po którym każdy jest zrobiony. */
const STEPS: { label: string; doneAt: RekeyStep[] }[] = [
  { label: "Nowy pokój", doneAt: ["seeded", "marked", "switched", "done"] },
  { label: "Informacja dla urządzeń", doneAt: ["marked", "switched", "done"] },
  { label: "Przełączenie", doneAt: ["switched", "done"] },
  { label: "Sparuj urządzenia", doneAt: [] },
];

/**
 * Wymiana kodu synchronizacji (S2.1, Z-15.3; projekt `docs/plan-wymiana-kodu.md` §3.4, §3.7). Stan w całości z zapisu
 * wymiany, więc druga karta widzi ten sam postęp; działania prowadzi jedna karta (blokada), druga dostaje komunikat.
 */
export function CodeChangePanel() {
  const record = useRekeyRecord();
  const [running, setRunning] = useState(false);

  async function act(fn: () => Promise<RekeyResult | boolean>) {
    setRunning(true);
    try {
      const r = await fn();
      if (r === false) toast.error("Anulowanie nie jest już możliwe");
      else if (typeof r === "object" && r.wait === "busy") toast.info("Zmianę kodu prowadzi inna karta tej przeglądarki");
    } catch (err) {
      toast.error("Nie udało się zmienić kodu", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRunning(false);
    }
  }
  const run = (opts: RunOptions = {}) => act(() => runCodeChange(opts));

  if (!record) {
    return (
      <div className="rounded-card border border-border/60 bg-muted/20 p-4 space-y-2 text-xs" data-testid="code-change">
        <h3 className="font-semibold text-muted-foreground">Zmiana kodu</h3>
        <p className="text-muted-foreground">
          Nowy kod odcina urządzenia, które znają tylko stary — na przykład zgubiony telefon. Pozostałe trzeba będzie sparować ponownie.
        </p>
        <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => act(prepareCodeChange)} className="coarse:h-11">
          Zmień kod
        </Button>
      </div>
    );
  }

  if (record.step === "prepared" && !record.error) return <Confirm record={record} running={running} onConfirm={() => run({ confirmed: true })} onCancel={() => act(cancelCodeChange)} />;

  return (
    <div className="rounded-card border border-border/60 bg-muted/20 p-4 space-y-3 text-xs" data-testid="code-change">
      <h3 className="font-semibold text-muted-foreground">Zmiana kodu</h3>
      <ol className="space-y-1" aria-label="Postęp zmiany kodu">
        {STEPS.map((s, i) => {
          const done = s.doneAt.includes(record.step) || (i === 3 && record.step === "done" && record.devices.every((d) => d.done));
          const current = !done && STEPS.slice(0, i).every((p) => p.doneAt.includes(record.step));
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              {done ? <Check className="size-4 text-success-ink" aria-hidden />
                : current && running ? <Loader2 className="size-4 motion-safe:animate-spin text-muted-foreground" aria-hidden />
                : <Circle className="size-4 text-faint" aria-hidden />}
              <span className={done ? "" : current ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              <span className="sr-only">{done ? "— zrobione" : current ? "— w toku" : "— czeka"}</span>
            </li>
          );
        })}
      </ol>

      {record.error && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-warning/50 bg-warning/10 px-3 py-2 text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
          <p className="min-w-0 flex-1">{record.error.message}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {record.step !== "done" && record.step !== "switched" && (
          <Button type="button" size="sm" disabled={running} onClick={() => run({ confirmed: true })} className="coarse:h-11">
            {record.error ? "Spróbuj ponownie" : "Dokończ"}
          </Button>
        )}
        {canSkipMarker(record) && (
          <Button type="button" size="sm" variant="outline" disabled={running} onClick={() => run({ skipMarker: true })} className="coarse:h-11">
            Pomiń — urządzenia offline nie dostaną informacji
          </Button>
        )}
        {canCancelRekey(record) && (
          <Button type="button" size="sm" variant="ghost" disabled={running} onClick={() => act(cancelCodeChange)} className="coarse:h-11">
            Anuluj zmianę
          </Button>
        )}
      </div>

      {(record.step === "switched" || record.step === "done") && <Repair record={record} running={running} onRetireNow={() => run({ retireNow: true })} />}
    </div>
  );
}

function Confirm({ record, running, onConfirm, onCancel }: { record: RekeyRecord; running: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="region" aria-label="Potwierdzenie zmiany kodu" className="rounded-card border border-warning/50 bg-warning/10 p-4 space-y-2 text-xs" data-testid="code-change">
      <h3 className="font-semibold text-foreground">Zmienić kod synchronizacji?</h3>
      <p>Po zmianie kodu każde urządzenie trzeba sparować ponownie. Urządzenie, którego nie sparujesz, przestanie dostawać nowe zmiany.</p>
      <p>Zmiana kodu nie usuwa danych, które tamto urządzenie już pobrało.</p>
      {!record.relay && <p>Urządzenia, które są teraz wyłączone, nie dostaną informacji o zmianie. Pamiętaj, żeby je sparować.</p>}
      {record.devices.length > 0 && (
        <ul className="space-y-1" aria-label="Urządzenia do ponownego sparowania">
          {record.devices.map((d) => (
            <li key={d.name}>
              <span className="font-medium">{d.name}</span>
              {!d.version && (
                <span className="block text-muted-foreground">
                  Stara wersja — nie pokaże prośby o ponowne sparowanie. Zaktualizuj ją przed zmianą kodu albo sparuj od razu po niej.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="destructive" disabled={running} onClick={onConfirm} className="coarse:h-11">Zmień kod</Button>
        <Button type="button" size="sm" variant="ghost" disabled={running} onClick={onCancel} className="coarse:h-11">Anuluj</Button>
      </div>
    </div>
  );
}

function Repair({ record, running, onRetireNow }: { record: RekeyRecord; running: boolean; onRetireNow: () => void }) {
  return (
    <div className="space-y-2 border-t border-border/60 pt-3">
      <p>Zeskanuj nowy kod (wyżej, w „Dodaj urządzenie”) na każdym urządzeniu z listy. Urządzenie odhacza się samo, gdy połączy się nowym kodem.</p>
      {record.devices.length > 0 && (
        <ul className="space-y-1" aria-label="Urządzenia do ponownego sparowania">
          {record.devices.map((d) => {
            const id = `rekey-dev-${d.name}`;
            return (
              <li key={d.name} className="flex items-center gap-2 text-sm">
                <Checkbox id={id} checked={d.done} disabled={d.done} onCheckedChange={() => void markRekeyDevicePaired(d.name)} />
                <label htmlFor={id} className={d.done ? "text-muted-foreground line-through" : ""}>{d.name}</label>
              </li>
            );
          })}
        </ul>
      )}
      {record.step === "switched" && record.relay && record.retireAt && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1">Stary pokój zostanie usunięty {format(record.retireAt, "dd.MM")}.</p>
          <Button type="button" size="sm" variant="outline" disabled={running} onClick={onRetireNow} className="coarse:h-11">Usuń teraz</Button>
        </div>
      )}
      {record.step === "done" && (
        <Button type="button" size="sm" variant="ghost" onClick={() => void dismissCodeChange()} className="coarse:h-11">Zamknij listę</Button>
      )}
    </div>
  );
}
