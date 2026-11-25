import { useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearErrorLog, ERROR_LOG_MAX, errorLogText, getErrorLog, type ErrorLogEntry } from "@/lib/diagnostics";

/**
 * Q1.6: błędy z tego urządzenia (także z poprzednich sesji) do skopiowania i wklejenia w zgłoszeniu.
 * Tylko nazwa i komunikat błędu, bez treści notatek. Nic nie wychodzi z urządzenia bez „Skopiuj”.
 */

const fmt = (at: number) => new Date(at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ErrorLogPanel({ initial = getErrorLog() }: { initial?: readonly ErrorLogEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [all, setAll] = useState(false);
  if (entries.length === 0) {
    return <p className="ui-hint" data-testid="error-log-empty">Brak błędów — na tym urządzeniu aplikacja nie zgłosiła żadnego nieobsłużonego błędu.</p>;
  }
  const newest = [...entries].reverse();
  const shown = all ? newest : newest.slice(0, 5);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(errorLogText(entries));
      toast.success("Skopiowano błędy — wklej je w zgłoszeniu");
    } catch {
      toast.error("Nie udało się skopiować", { description: "Pobierz raport diagnostyczny — błędy też w nim są." });
    }
  };
  const clear = () => {
    clearErrorLog();
    setEntries([]);
    toast.success("Wyczyszczono listę błędów");
  };
  return (
    <div className="space-y-2" data-testid="error-log">
      <ul className="space-y-1.5 text-sm">
        {shown.map((e) => (
          <li key={`${e.at}-${e.message}`} className="grid grid-cols-[auto_1fr] gap-x-3">
            <span className="ui-meta tabular-nums">{fmt(e.at)}</span>
            <span className="min-w-0">
              <span className="break-all font-mono text-xs">{e.message}</span>
              {e.count > 1 && <span className="ui-meta"> × {e.count}</span>}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void copy()}>
          <Copy className="size-3.5" aria-hidden />Skopiuj
        </Button>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={clear}>
          <Trash2 className="size-3.5" aria-hidden />Wyczyść
        </Button>
        {newest.length > 5 && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setAll((v) => !v)}>
            {all ? "Pokaż ostatnie 5" : `Pokaż wszystkie (${newest.length})`}
          </Button>
        )}
      </div>
      <p className="ui-hint">Ostatnie {ERROR_LOG_MAX} błędów, tylko na tym urządzeniu. Są też w raporcie diagnostycznym.</p>
    </div>
  );
}
