import { useState } from "react";
import { Inbox } from "lucide-react";
import { captureParts, INBOX_TITLE_MAX } from "@/lib/inbox";

/**
 * Pole na górze Skrzynki: Enter zapisuje od razu, bez tytułu, folderu i etykiet; Shift+Enter dodaje linię.
 * Pole rośnie z treścią, więc wklejony długi tekst nie ucina się na pierwszej linii (`captureParts`).
 * Zapis robi rodzic (`onCapture`), tu tylko wpis i czyszczenie.
 */
export function InboxCapture({ onCapture }: { onCapture: (title: string, content: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    const parts = captureParts(text);
    if (!parts) return;
    onCapture(parts.title, parts.content);
    setText("");
  };
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
        placeholder="Zapisz, co przyszło do głowy — Enter"
        aria-label="Przechwyć do skrzynki"
        aria-describedby="inbox-capture-hint"
        data-inbox-capture
        maxLength={INBOX_TITLE_MAX * 20}
        className="max-h-60 min-h-9 w-full min-w-0 flex-1 resize-none bg-transparent py-2 text-base outline-hidden placeholder:text-muted-foreground sm:text-sm"
      />
      <span id="inbox-capture-hint" className="sr-only">Enter zapisuje, Shift+Enter dodaje nową linię.</span>
    </form>
  );
}
