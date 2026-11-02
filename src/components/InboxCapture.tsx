import { useState } from "react";
import { ArrowUp, Inbox, Mic, MicOff } from "lucide-react";
import { captureParts, INBOX_TITLE_MAX } from "@/lib/inbox";
import { useDictation } from "@/hooks/useDictation";
import { cn } from "@/lib/utils";

/**
 * Pole na górze Skrzynki: Enter zapisuje od razu, bez tytułu, folderu i etykiet; Shift+Enter dodaje linię.
 * Pole rośnie z treścią, więc wklejony długi tekst nie ucina się na pierwszej linii (`captureParts`).
 * Zapis robi rodzic (`onCapture`), tu tylko wpis i czyszczenie.
 * Plan Skrzynki 1.1: przy niepustym polu przycisk „Zapisz” (44 px na dotyku) — na telefonie Enter klawiatury
 * bywa nową linią. 2.2: mikrofon dopisuje podyktowany tekst do pola; zapis dalej Enterem albo „Zapisz”.
 */
export function InboxCapture({ onCapture }: { onCapture: (title: string, content: string) => void }) {
  const [text, setText] = useState("");
  const dictation = useDictation((spoken) => {
    if (spoken) setText((t) => (t.trim() ? `${t.trimEnd()} ${spoken}` : spoken));
  });
  const submit = () => {
    const parts = captureParts(text);
    if (!parts) return;
    onCapture(parts.title, parts.content);
    setText("");
  };
  const hasText = text.trim().length > 0;
  return (
    <form
      className="flex items-start gap-2 rounded-card border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring"
      onSubmit={(e) => { e.preventDefault(); submit(); }}
    >
      <Inbox className="mt-2.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <textarea
        rows={1}
        enterKeyHint="send"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
        }}
        placeholder="Zapisz pomysł — Enter"
        aria-label="Przechwyć do skrzynki"
        aria-describedby="inbox-capture-hint"
        data-inbox-capture
        maxLength={INBOX_TITLE_MAX * 20}
        className="max-h-60 min-h-9 w-full min-w-0 flex-1 resize-none bg-transparent py-2 text-base outline-hidden placeholder:text-muted-foreground sm:text-sm"
      />
      <span id="inbox-capture-hint" className="sr-only">Enter zapisuje, Shift+Enter dodaje nową linię.</span>
      {dictation.supported && (
        <button
          type="button"
          onClick={dictation.toggle}
          aria-pressed={dictation.listening}
          aria-label={dictation.listening ? "Zatrzymaj dyktowanie" : "Dyktuj do skrzynki"}
          className={cn(
            "pressable mt-0.5 grid size-8 shrink-0 place-items-center rounded-full coarse:size-11",
            dictation.listening ? "bg-destructive/10 text-destructive-ink" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {dictation.listening ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
        </button>
      )}
      {hasText && (
        <button
          type="submit"
          aria-label="Zapisz do skrzynki"
          className="pressable mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 coarse:size-11"
        >
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      )}
    </form>
  );
}
