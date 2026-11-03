import { Bell, Flag, Folder, Hash, X } from "lucide-react";
import { describeToken, type CaptureToken } from "@/lib/quickCapture";
import { formatReminderShort } from "@/lib/reminderTime";
import { cn } from "@/lib/utils";

/**
 * Chipy rozpoznanych fraz (`#etykieta`, `@folder`, `!`, „jutro 9:00”) pod polem tekstu — wspólne dla paska
 * nowej notatki i pola Skrzynki. Klik albo Backspace/Delete na chipie przełącza „zignoruj” (tekst zostaje bez zmian).
 */
export function CaptureChips({ tokens, ignored, onToggle }: { tokens: CaptureToken[]; ignored: ReadonlySet<string>; onToggle: (key: string) => void }) {
  if (tokens.length === 0) return null;
  return (
    <div role="group" aria-label="Rozpoznane w tekście" aria-live="polite" className="flex flex-wrap items-center gap-1.5">
      {tokens.map((t) => {
        const off = ignored.has(t.key);
        const d = describeToken(t, (date) => formatReminderShort(date.getTime()));
        const Icon = t.kind === "label" ? Hash : t.kind === "folder" ? Folder : t.kind === "priority" ? Flag : Bell;
        return (
          <button key={`${t.field}-${t.start}-${t.key}`} type="button"
            aria-label={off ? `Przywróć: ${d.aria}` : `Zignoruj: ${d.aria}`}
            title={off ? "Przywróć rozpoznanie" : "Zignoruj — tekst zostanie bez zmian"}
            onClick={() => onToggle(t.key)}
            onKeyDown={(e) => { if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onToggle(t.key); } }}
            className={cn("pressable inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-primary coarse:min-h-11 coarse:px-3",
              off ? "border-border text-muted-foreground line-through" : "border-primary/40 bg-primary/10 text-primary-ink hover:bg-primary/15")}>
            <Icon className="w-3 h-3 shrink-0" aria-hidden />
            <span>{d.label}</span>
            {t.kind === "label" && t.isNew && !off && <span className="text-2xs opacity-70">nowa</span>}
            <X className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** Przełącza klucz w zbiorze „zignorowanych” (nowy zbiór, żeby React widział zmianę). */
export function toggledSet(prev: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(prev);
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}
