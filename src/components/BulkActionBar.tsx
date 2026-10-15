import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Archive, ArchiveRestore, Download, Trash2, Palette, X, CheckSquare, Undo2, Pin, FolderInput, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ColorPicker } from "./ColorPicker";
import type { Folder, NoteColor } from "@/hooks/useNotes";
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
  /** Widok, w którym leży zaznaczenie — w Koszu i Archiwum akcje są inne niż na liście notatek. */
  view?: "trash" | "archive" | "other";
  /** Przywrócenie z Kosza albo Archiwum. */
  onRestore?: () => void;
  /** Trwałe usunięcie (tylko Kosz) — po potwierdzeniu. */
  onDeleteForever?: () => void;
  /** Eksport zaznaczonych do ZIP z osobnymi plikami `.md`. */
  onExport?: () => void;
  /** Foldery i etykiety do zbiorczego przenoszenia / etykietowania (tylko na liście notatek). */
  folders?: Folder[];
  allLabels?: string[];
  onPin?: () => void;
  onMoveToFolder?: (folderId: string | null) => void;
  onAddLabel?: (label: string) => void;
}

export function BulkActionBar({ count, totalVisible, onSelectAll, onClear, onArchive, onTrash, onColor, view = "other", onRestore, onDeleteForever, onExport, folders = [], allLabels = [], onPin, onMoveToFolder, onAddLabel }: Props) {
  const [newLabel, setNewLabel] = useState("");
  const inTrash = view === "trash";
  const inArchive = view === "archive";
  return (
    <AnimatePresence>
      {count > 0 && (
        // Zewnętrzny kontener centruje (framer nadpisuje `transform` na elemencie z `y`,
        // więc `-translate-x-1/2` na nim znikało i pasek wychodził poza ekran telefonu).
        <div className="pointer-events-none fixed inset-x-2 bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-4 z-40 flex justify-center">
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={spring.soft}
          className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl px-3 py-2 *:shrink-0"
        >
          <IconButton onClick={onClear} title="Wyczyść zaznaczenie" aria-label="Wyczyść zaznaczenie">
            <X className="w-4 h-4" />
          </IconButton>
          <span className="text-sm font-medium px-2 select-none">
            {count} <span className="text-muted-foreground max-sm:sr-only">zaznaczono</span>
          </span>
          <div className="w-px h-5 bg-border mx-1" />
          <button onClick={onSelectAll} className="pressable text-xs font-medium px-2 py-1 coarse:py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Zaznacz wszystko">
            <CheckSquare className="w-3.5 h-3.5 inline mr-1" />
            <span className="max-sm:sr-only">Wszystko </span>({totalVisible})
          </button>
          <div className="w-px h-5 bg-border mx-1" />
          {!inTrash && (
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
          )}
          {!inTrash && !inArchive && onPin && (
            <IconButton onClick={onPin} title="Przypnij / odepnij zaznaczone" aria-label="Przypnij zaznaczone">
              <Pin className="w-4 h-4" />
            </IconButton>
          )}
          {!inTrash && !inArchive && onMoveToFolder && (
            <Popover>
              <PopoverTrigger asChild>
                <IconButton title="Przenieś do folderu" aria-label="Przenieś do folderu">
                  <FolderInput className="w-4 h-4" />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-56 p-1 max-h-64 overflow-y-auto">
                <button onClick={() => onMoveToFolder(null)} className="w-full text-left text-sm px-2 py-1.5 coarse:py-2.5 rounded-md hover:bg-muted text-muted-foreground">
                  Bez folderu
                </button>
                {folders.map((f) => (
                  <button key={f.id} onClick={() => onMoveToFolder(f.id)} className="w-full text-left text-sm px-2 py-1.5 coarse:py-2.5 rounded-md hover:bg-muted truncate">
                    {f.emoji ? `${f.emoji} ` : ""}{f.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
          {!inTrash && !inArchive && onAddLabel && (
            <Popover>
              <PopoverTrigger asChild>
                <IconButton title="Dodaj etykietę" aria-label="Dodaj etykietę">
                  <Tag className="w-4 h-4" />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-56 p-1">
                <form
                  className="p-1"
                  onSubmit={(e) => { e.preventDefault(); if (newLabel.trim()) { onAddLabel(newLabel); setNewLabel(""); } }}
                >
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Nowa etykieta…"
                    aria-label="Nowa etykieta"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </form>
                <div className="max-h-48 overflow-y-auto">
                  {allLabels.map((l) => (
                    <button key={l} onClick={() => onAddLabel(l)} className="w-full text-left text-sm px-2 py-1.5 coarse:py-2.5 rounded-md hover:bg-muted truncate">
                      #{l}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {(inTrash || inArchive) && onRestore && (
            <IconButton onClick={onRestore} title={inTrash ? "Przywróć z kosza" : "Przywróć z archiwum"} aria-label={inTrash ? "Przywróć z kosza" : "Przywróć z archiwum"}>
              {inTrash ? <Undo2 className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
            </IconButton>
          )}
          {onExport && (
            <IconButton onClick={onExport} title="Eksportuj zaznaczone (ZIP z plikami .md)" aria-label="Eksportuj zaznaczone">
              <Download className="w-4 h-4" />
            </IconButton>
          )}
          {!inTrash && !inArchive && (
            <IconButton onClick={onArchive} title="Archiwizuj" aria-label="Archiwizuj">
              <Archive className="w-4 h-4" />
            </IconButton>
          )}
          {inTrash ? (
            <IconButton tone="destructive" onClick={onDeleteForever} title="Usuń trwale" aria-label="Usuń trwale">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          ) : (
            <IconButton tone="destructive" onClick={onTrash} title="Przenieś do kosza" aria-label="Przenieś do kosza">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          )}
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
