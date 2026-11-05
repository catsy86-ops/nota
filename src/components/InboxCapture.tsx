import { useMemo, useState } from "react";
import { ArrowUp, Inbox, Mic, MicOff } from "lucide-react";
import { captureParts, INBOX_TITLE_MAX, linkCapture } from "@/lib/inbox";
import { applyCapture, extractCapture, toggledSet, type CaptureToken } from "@/lib/quickCapture";
import type { NotePriority } from "@/lib/notePriority";
import { CaptureChips } from "./CaptureChips";
import { useDictation } from "@/hooks/useDictation";
import { cn } from "@/lib/utils";

/**
 * Pole na górze Skrzynki: Enter zapisuje od razu, bez tytułu, folderu i etykiet; Shift+Enter dodaje linię.
 * Pole rośnie z treścią, więc wklejony długi tekst nie ucina się na pierwszej linii (`captureParts`).
 * Zapis robi rodzic (`onCapture`), tu tylko wpis i czyszczenie.
 * Plan Skrzynki 1.1: przy niepustym polu przycisk „Zapisz” (44 px na dotyku) — na telefonie Enter klawiatury
 * bywa nową linią. 2.2: mikrofon dopisuje podyktowany tekst do pola; zapis dalej Enterem albo „Zapisz”.
 * 2.1: frazy jak w pasku nowej notatki (`#etykieta`, `@folder`, `!`, data na końcu) jako chipy pod polem;
 * przyjęte idą w `extras`. Notatka z etykietą albo folderem od razu wychodzi ze Skrzynki — to zamierzone.
 * 2.5: wklejony obraz albo upuszczony plik (obraz, PDF) idzie do `onFiles` razem z tekstem z pola (tytuł notatki).
 */
export interface InboxCaptureExtras {
  labels: string[];
  /** Podzbiór `labels` do utworzenia. */
  newLabels: string[];
  folderId: string | null;
  priority: NotePriority | null;
  reminder: number | null;
}

interface InboxCaptureProps {
  onCapture: (title: string, content: string, extras: InboxCaptureExtras) => void;
  /** Istniejące etykiety i foldery do rozpoznania fraz; bez nich `#słowo` to nowa etykieta, `@` nic nie znaczy. */
  labels?: string[];
  folders?: { id: string; name: string }[];
  /** Wklejone albo upuszczone pliki i tekst pola; bez tej funkcji pole przyjmuje tylko tekst. */
  onFiles?: (files: File[], text: string) => void;
}

const NO_LABELS: string[] = [];
const NO_FOLDERS: { id: string; name: string }[] = [];

export function InboxCapture({ onCapture, labels = NO_LABELS, folders = NO_FOLDERS, onFiles }: InboxCaptureProps) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  /** Pliki z wklejenia albo upuszczenia → rodzic; pole się czyści. `false` = nie było plików (zwykłe wklejenie tekstu). */
  const takeFiles = (list: FileList | null | undefined): boolean => {
    if (!onFiles || !list || list.length === 0) return false;
    onFiles(Array.from(list), text);
    setText("");
    setIgnored(new Set());
    return true;
  };
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());
  const tokens = useMemo<CaptureToken[]>(() => {
    const parts = captureParts(text);
    return parts ? extractCapture(parts, { labels, folders }) : [];
  }, [text, labels, folders]);
  const dictation = useDictation((spoken) => {
    if (spoken) setText((t) => (t.trim() ? `${t.trimEnd()} ${spoken}` : spoken));
  });
  const submit = () => {
    // 2.4: sam wklejony adres — tytuł z domeny i ścieżki, adres w treści, bez rozpoznawania fraz.
    const link = linkCapture(text);
    if (link) {
      onCapture(link.title, link.content, { labels: [], newLabels: [], folderId: null, priority: null, reminder: null });
      setText("");
      setIgnored(new Set());
      return;
    }
    const parts = captureParts(text);
    if (!parts) return;
    const r = applyCapture(parts, tokens, ignored);
    onCapture(r.title, r.content, { labels: r.labels, newLabels: r.newLabels, folderId: r.folderId, priority: r.priority, reminder: r.reminder ? r.reminder.getTime() : null });
    setText("");
    setIgnored(new Set());
  };
  const hasText = text.trim().length > 0;
  return (
    <div className="space-y-2">
    <form
      // 4.1: ten sam kształt, cień i obrys co zwinięty pasek „Zapisz notatkę…” (AddNoteBar), żeby oba pola czytały się jako jedno.
      className={cn("flex w-full max-w-(--page-form) items-start gap-3 rounded-card border bg-card px-3 py-2 note-shadow transition-[box-shadow] focus-ring-gradient hover:shadow-elevation-3", dragging ? "border-primary ring-2 ring-primary/40" : "border-border")}
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      onDragOver={(e) => { if (onFiles && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { setDragging(false); if (takeFiles(e.dataTransfer.files)) e.preventDefault(); }}
    >
      <span aria-hidden className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-card bg-primary/12 text-primary-ink ring-1 ring-primary/20">
        <Inbox className="h-4 w-4" />
      </span>
      <textarea
        rows={1}
        enterKeyHint="send"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => { if (takeFiles(e.clipboardData.files)) e.preventDefault(); }}
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
    <CaptureChips tokens={tokens} ignored={ignored} onToggle={(key) => setIgnored((prev) => toggledSet(prev, key))} />
    </div>
  );
}
