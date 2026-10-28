import { useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { olderDevices } from "@/lib/formatSchema";
import { useSyncState } from "@/lib/yjsSync";

const DISMISS_KEY = "kaczy.olderDeviceBanner.v1";

/** Klucz zestawu starszych urządzeń: ukrycie dotyczy tego zestawu, nowe starsze urządzenie pokaże baner znowu. */
const setKey = (devices: readonly { id: string | number; schema?: number }[]) => devices.map((d) => `${d.id}:${d.schema ?? 0}`).sort().join("|");

/**
 * P3.2: baner w całej aplikacji, gdy w grupie synchronizacji jest urządzenie ze starszą wersją
 * (dotąd tylko w Ustawieniach → Sync). „Szczegóły” otwiera Sync, „Ukryj” chowa go dla tego zestawu urządzeń.
 */
export function OlderDeviceBanner({ onOpenSync }: { onOpenSync: () => void }) {
  const sync = useSyncState();
  const older = olderDevices(sync.devices);
  const key = setKey(older);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(DISMISS_KEY); } catch { return null; } });
  if (older.length === 0 || dismissed === key) return null;

  function hide() {
    try { localStorage.setItem(DISMISS_KEY, key); } catch { /* bez pamięci — tylko na teraz */ }
    setDismissed(key);
  }

  return (
    <div role="status" data-testid="older-device-banner" className="flex items-start gap-2 rounded-card border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">{older.map((d) => d.name).join(", ")}</span> {older.length === 1 ? "ma" : "mają"} starszą wersję aplikacji — część danych może być tam niewidoczna. Zaktualizuj {older.length === 1 ? "go" : "je"}.
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onOpenSync} className="shrink-0 coarse:h-11">Szczegóły</Button>
      <button type="button" onClick={hide} aria-label="Ukryj ostrzeżenie o starszej wersji"
        className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:bg-muted coarse:size-11">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
