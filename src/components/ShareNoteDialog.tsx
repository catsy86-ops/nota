import { useState } from "react";
import { Share2, Copy, Check, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Note } from "@/hooks/useNotes";
import { toast } from "sonner";
import { encodeShareParam } from "@/lib/shareLink";

interface ShareNoteDialogProps {
  note: Note;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Okno „Udostępnij” z „⋯” na kaflu. Ładowane leniwie (`ShareNote.tsx`), więc cały kod
 * kopiowania, linku i pobierania nie wchodzi do paczki startowej.
 */
export default function ShareNoteDialog({ note, open, onOpenChange }: ShareNoteDialogProps) {
  const [copied, setCopied] = useState(false);

  function noteToText(): string {
    let text = "";
    if (note.title) text += `# ${note.title}\n\n`;
    if (note.content) text += `${note.content}\n\n`;
    if (note.labels.length) text += `Etykiety: ${note.labels.join(", ")}\n`;
    if (note.checklist?.length) {
      text += "\nLista:\n";
      note.checklist.forEach((item) => {
        text += `${item.checked ? "☑" : "☐"} ${item.text}\n`;
      });
    }
    return text.trim();
  }

  function noteToShareUrl(): string {
    return `${window.location.origin}?share=${encodeShareParam(note)}`;
  }

  async function copyText() {
    await navigator.clipboard.writeText(noteToText());
    setCopied(true);
    toast.success("Skopiowano tekst notatki");
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyLink() {
    const url = noteToShareUrl();
    await navigator.clipboard.writeText(url);
    toast.success("Skopiowano link do notatki");
  }

  async function shareNative() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title || "Notatka",
          text: noteToText(),
        });
      } catch { /* user cancelled the native share sheet */ }
    } else {
      copyText();
    }
  }

  function downloadAsFile() {
    const text = noteToText();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title || "notatka"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Pobrano notatkę");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display">Udostępnij notatkę</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Button variant="outline" className="w-full justify-start gap-3" onClick={copyText}>
            {copied ? <Check className="w-4 h-4 text-primary-ink" /> : <Copy className="w-4 h-4" />}
            Kopiuj tekst
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3" onClick={copyLink}>
            <Share2 className="w-4 h-4" />
            Kopiuj link
          </Button>
          {typeof navigator.share === "function" && (
            <Button variant="outline" className="w-full justify-start gap-3" onClick={shareNative}>
              <Share2 className="w-4 h-4" />
              Udostępnij...
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start gap-3" onClick={downloadAsFile}>
            <Download className="w-4 h-4" />
            Pobierz jako .md
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
