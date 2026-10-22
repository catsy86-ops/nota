import { lazy, Suspense, useState } from "react";
import { RotateCcwClock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NoteVersion } from "@/hooks/useNoteVersions";

// Okno ładuje się dopiero przy pierwszym kliknięciu — Markdown i animacje wersji poza główną paczką.
const VersionHistoryDialog = lazy(() => import("./VersionHistoryDialog"));

interface VersionHistoryProps {
  versions: NoteVersion[];
  onRestore: (version: NoteVersion) => void;
}

export function VersionHistory({ versions, onRestore }: VersionHistoryProps) {
  const [open, setOpen] = useState(false);
  // Montowane przy pierwszym otwarciu i zostaje — zamknięcie ma swoją animację.
  const [mounted, setMounted] = useState(false);

  if (versions.length === 0) return null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => { e.stopPropagation(); setMounted(true); setOpen(true); }}
            aria-label="Historia wersji"
            className="pressable p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors"
          >
            <RotateCcwClock className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Historia wersji ({versions.length})</TooltipContent>
      </Tooltip>

      {mounted && (
        <Suspense fallback={null}>
          <VersionHistoryDialog versions={versions} open={open} onOpenChange={setOpen} onRestore={onRestore} />
        </Suspense>
      )}
    </>
  );
}
