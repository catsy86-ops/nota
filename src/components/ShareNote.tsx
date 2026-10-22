import { lazy, Suspense, useState } from "react";
import { Share2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Note } from "@/hooks/useNotes";

// Okno ładuje się dopiero przy pierwszym kliknięciu „Udostępnij” — poza główną paczką.
const ShareNoteDialog = lazy(() => import("./ShareNoteDialog"));

interface ShareNoteProps {
  note: Note;
}

export function ShareNote({ note }: ShareNoteProps) {
  const [open, setOpen] = useState(false);
  // Montowane przy pierwszym otwarciu i zostaje — zamknięcie ma swoją animację.
  const [mounted, setMounted] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setMounted(true); setOpen(true); }}
            aria-label="Udostępnij"
            className="pressable p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Udostępnij</TooltipContent>
      </Tooltip>

      {mounted && (
        <Suspense fallback={null}>
          <ShareNoteDialog note={note} open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </>
  );
}
