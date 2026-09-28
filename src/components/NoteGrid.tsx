import { useRef, useEffect, useCallback, memo, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useViewPrefs, type Layout } from "@/lib/viewPrefs";
import { NoteCard } from "@/components/NoteCard";
import { NoteViewActionsProvider, type NoteViewActions } from "@/hooks/NoteViewActionsContext";
import type { useNotes } from "@/hooks/useNotes";
import { registerGridNavSection, useGridNavState, setGridNavFocus } from "@/lib/gridKeyboardNav";

interface SortableNoteCardProps {
  note: ReturnType<typeof useNotes>["notes"][number];
  index: number;
  layout: Layout;
  selected: boolean;
}

const SortableNoteCard = memo(function SortableNoteCard({ layout, note, index, selected }: SortableNoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: note.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={layout === "masonry" ? "break-inside-avoid mb-4" : layout === "grid" ? "h-full" : ""}>
      <NoteCard note={note} index={index} selected={selected} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
});

interface NoteGridProps extends Omit<NoteViewActions, "selectionMode" | "onToggleSelect"> {
  notes: ReturnType<typeof useNotes>["notes"];
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
  /**
   * Pozycja tej siatki w nawigacji klawiaturą, gdy strona renderuje kilka
   * (widok „Notatki”: 0 = Przypięte, 1 = Inne). Strzałki przechodzą między
   * sekcjami w tej kolejności, jak po jednej liście.
   */
  navOrder?: number;
}

export function NoteGrid({
  notes, onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder, getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectedIds, selectionMode, onToggleSelect, navOrder = 0,
}: NoteGridProps) {
  // Stabilna wartość kontekstu — inaczej każdy render siatki przerysowuje wszystkie karty mimo `memo`.
  const noteViewActions = useMemo<NoteViewActions>(() => ({
    onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder,
    getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectionMode, onToggleSelect,
  }), [onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder,
    getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, wikiIndex, onOpenNote, selectionMode, onToggleSelect]);
  const prefs = useViewPrefs();
  const noteIds = notes.map((n) => n.id);
  const { focusedId } = useGridNavState();
  const gridRef = useRef<HTMLDivElement>(null);

  const colsCount = useCallback(() => {
    if (prefs.layout === "list") return 1;
    if (!gridRef.current) return 1;
    const w = gridRef.current.clientWidth;
    if (prefs.autoColumns) {
      if (w >= 1280) return 4;
      if (w >= 1024) return 3;
      if (w >= 640) return 2;
      return 1;
    }
    return Math.max(1, Math.min(prefs.columns || 1, 4));
  }, [prefs.layout, prefs.autoColumns, prefs.columns]);

  // Ta siatka tylko zgłasza swoje notatki i akcje; klawiszy nasłuchuje jeden
  // globalny właściciel w `gridKeyboardNav` — patrz komentarz w tym module.
  const noteIdsKey = noteIds.join(",");
  useEffect(() => {
    return registerGridNavSection(navOrder, noteIdsKey ? noteIdsKey.split(",") : [], {
      onDelete,
      onArchive: isArchived ? undefined : onArchive,
      onTogglePin,
      onDuplicate,
      openNote: (id) => {
        const target = gridRef.current?.querySelector(`[data-note-id-wrap="${id}"] .cursor-pointer`) as HTMLElement | null;
        target?.click();
      },
      scrollToNote: (id) => {
        const el = gridRef.current?.querySelector(`[data-note-id-wrap="${id}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
      colsCount,
    });
  }, [navOrder, noteIdsKey, onDelete, onArchive, onTogglePin, onDuplicate, isArchived, colsCount]);

  const gap = prefs.density === "compact" ? "gap-2 space-y-2" : prefs.density === "comfy" ? "gap-6 space-y-6" : "gap-4 space-y-4";

  let containerClass: string;
  if (prefs.layout === "list") {
    containerClass = `max-w-2xl mx-auto ${gap.split(" ")[1]}`;
  } else if (prefs.layout === "grid") {
    const cols = prefs.autoColumns
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : prefs.columns === 1 ? "grid-cols-1"
      : prefs.columns === 2 ? "grid-cols-1 sm:grid-cols-2"
      : prefs.columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    containerClass = `grid ${cols} ${gap.split(" ")[0]} auto-rows-fr`;
  } else {
    const cols = prefs.autoColumns
      ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4"
      : prefs.columns === 1 ? "columns-1"
      : prefs.columns === 2 ? "columns-1 sm:columns-2"
      : prefs.columns === 3 ? "columns-1 sm:columns-2 lg:columns-3"
      : "columns-1 sm:columns-2 lg:columns-3 xl:columns-4";
    containerClass = `${cols} ${gap}`;
  }

  return (
    <NoteViewActionsProvider value={noteViewActions}>
    <SortableContext items={noteIds} strategy={rectSortingStrategy}>
      <div ref={gridRef} className={containerClass}>
        <AnimatePresence mode="popLayout">
          {notes.map((note, i) => (
            <div
              key={note.id}
              data-note-idx={i}
              data-note-id-wrap={note.id}
              onClickCapture={() => setGridNavFocus(note.id)}
              className={cn(
                "rounded-2xl transition-shadow",
                prefs.layout === "masonry" ? "break-inside-avoid mb-4" : prefs.layout === "grid" ? "h-full" : "",
                focusedId === note.id && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
              )}
            >
              <SortableNoteCard
                note={note}
                index={i}
                layout={prefs.layout}
                selected={selectedIds?.has(note.id) ?? false}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

    </SortableContext>
    </NoteViewActionsProvider>
  );
}
