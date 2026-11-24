import type { RefObject } from "react";
import { useOnline } from "@/hooks/useOnline";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { JournalKind } from "@/lib/study/store";

/** „Co się dzieje?”: pole tekstu z dyktowaniem i podpowiedziami z tej budowy („Jak wczoraj”, ostatnie teksty). */
export function EntryTextField({ textRef, text, onText, kind, emptyAttempt, onSubmit, dictation, yesterdayText, suggestions }: {
  textRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  /** Zmiana tekstu przez użytkownika (pisanie albo pigułka). */
  onText: (t: string) => void;
  kind: JournalKind;
  /** Pusty wpis: komunikat przy polu (czytany przez czytnik). */
  emptyAttempt: boolean;
  onSubmit: () => void;
  dictation: { supported: boolean; listening: boolean; toggle: () => void };
  yesterdayText: string | null;
  suggestions: readonly string[];
}) {
  const online = useOnline();
  const hint = !dictation.supported
    ? "Dyktuj mikrofonem na klawiaturze telefonu."
    : !online ? "Bez internetu dyktuj mikrofonem na klawiaturze telefonu — przycisk obok działa tylko online." : null;
  const pick = (t: string) => { haptic("selection"); onText(t); };

  return (
    <div className="space-y-1">
      <label className="block space-y-1 text-xs text-muted-foreground">
        Co się dzieje?
        <span className="relative block">
          <textarea
            ref={textRef}
            value={text}
            onChange={(e) => onText(e.target.value)}
            aria-invalid={emptyAttempt || undefined}
            aria-describedby={emptyAttempt ? "journal-empty-hint" : undefined}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); } }}
            rows={4}
            placeholder={kind === "problem" ? "Co poszło nie tak i co z tym zrobisz?" : "Krótko: gdzie, co zrobione, co zauważyłeś"}
            className={cn(
              "shake-invalid w-full resize-none rounded-field border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring",
              dictation.supported && "pr-14",
            )}
          />
          {dictation.supported && (
            <button
              type="button"
              onClick={() => { haptic("tap"); dictation.toggle(); }}
              aria-pressed={dictation.listening}
              aria-label={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj"}
              title={dictation.listening ? "Zakończ dyktowanie" : "Dyktuj wpis"}
              className={cn(
                "absolute right-1.5 top-1.5 grid size-10 place-items-center rounded-full transition-colors coarse:h-12 coarse:w-12",
                dictation.listening ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <Mic className={cn("size-5", dictation.listening && "animate-pulse")} />
            </button>
          )}
        </span>
      </label>
      {hint && <p className="ui-hint hidden coarse:block" data-testid="dictation-hint">{hint}</p>}
      {!text.trim() && (yesterdayText || suggestions.length > 0) && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Podpowiedzi tekstu z tej budowy" data-testid="journal-text-suggestions">
          {yesterdayText && (
            <Button type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => pick(yesterdayText)} title={yesterdayText} variant="pill" size="chip">
              Jak wczoraj
            </Button>
          )}
          {suggestions.map((t) => (
            <Button key={t} type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => pick(t)} title={t} variant="chip-add" size="chip" className="max-w-full">
              <span className="truncate">{t}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
