import { useState } from "react";
import { Share2, Copy, Check, Download } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Note } from "@/hooks/useNotes";
import { toast } from "sonner";

interface ShareNoteProps {
  note: Note;
}

export function ShareNote({ note }: ShareNoteProps) {
  const [open, setOpen] = useState(false);
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
    const data = {
      t: note.title,
      c: note.content,
      cl: note.checklist,
      l: note.labels,
      co: note.color,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    return `${window.location.origin}?share=${encoded}`;
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
          title: note.title || "Notatka KACZY",
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
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Udostępnij</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="font-display">Udostępnij notatkę</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button variant="outline" className="w-full justify-start gap-3" onClick={copyText}>
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
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
    </>
  );
}
