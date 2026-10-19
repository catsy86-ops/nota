import { useState } from "react";
import { Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { captureParts, INBOX_TITLE_MAX } from "@/lib/inbox";

/**
 * Pole na górze Skrzynki: Enter zapisuje od razu, bez tytułu, folderu i etykiet.
 * Zapis robi rodzic (`onCapture`), tu tylko wpis i czyszczenie.
 */
export function InboxCapture({ onCapture }: { onCapture: (title: string, content: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex items-center gap-2 rounded-card border border-border bg-card px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parts = captureParts(text);
        if (!parts) return;
        onCapture(parts.title, parts.content);
        setText("");
      }}
    >
      <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Zapisz, co przyszło do głowy — Enter"
        aria-label="Przechwyć do skrzynki"
        maxLength={INBOX_TITLE_MAX * 20}
        className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
      />
    </form>
  );
}
