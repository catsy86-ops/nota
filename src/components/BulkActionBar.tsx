import { motion, AnimatePresence } from "framer-motion";
import { Archive, Trash2, Palette, X, CheckSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "./ColorPicker";
import type { NoteColor } from "@/hooks/useNotes";
import { IconButton } from "@/components/ui/icon-button";
import { spring } from "@/lib/motion";

interface Props {
  count: number;
  totalVisible: number;
  onSelectAll: () => void;
  onClear: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onColor: (c: NoteColor) => void;
}

export function BulkActionBar({ count, totalVisible, onSelectAll, onClear, onArchive, onTrash, onColor }: Props) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={spring.soft}
          className="fixed bottom-[88px] md:bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl px-3 py-2"
        >
          <IconButton onClick={onClear} title="Wyczyść zaznaczenie" aria-label="Wyczyść zaznaczenie">
            <X className="w-4 h-4" />
          </IconButton>
          <span className="text-sm font-medium px-2 select-none">
            {count} <span className="text-muted-foreground">zaznaczono</span>
          </span>
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={onSelectAll} className="pressable text-xs font-medium px-2 py-1 coarse:py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Zaznacz wszystko">
            <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
            Wszystko ({totalVisible})
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <IconButton title="Zmień kolor" aria-label="Zmień kolor">
                <Palette className="w-4 h-4" />
              </IconButton>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-auto p-2">
              <ColorPicker selected="default" onSelect={(c: NoteColor) => onColor(c)} />
            </PopoverContent>
          </Popover>
          <IconButton onClick={onArchive} title="Archiwizuj" aria-label="Archiwizuj">
            <Archive className="w-4 h-4" />
          </IconButton>
          <IconButton tone="destructive" onClick={onTrash} title="Przenieś do kosza" aria-label="Przenieś do kosza">
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
