import { useRef, useEffect, useCallback, Fragment, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable, SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useViewPrefs, type Layout } from "@/lib/viewPrefs";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { NoteCard } from "@/components/NoteCard";
import { NoteViewActionsProvider, type NoteViewActions } from "@/hooks/NoteViewActionsContext";
import type { useNotes } from "@/hooks/useNotes";
import { registerGridNavSection, useGridNavState, setGridNavFocus, setGridNavPreview, setGridNavPreviewScrollEl } from "@/lib/gridKeyboardNav";

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
  searchQuery?: string;
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
  notes, searchQuery, onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder, getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, selectedIds, selectionMode, onToggleSelect, navOrder = 0,
}: NoteGridProps) {
  const noteViewActions: NoteViewActions = {
    onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, isArchived, onMoveToFolder,
    getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, selectionMode, onToggleSelect,
  };
  const prefs = useViewPrefs();
  const noteIds = notes.map((n) => n.id);
  const { focusedId, previewId } = useGridNavState();
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

  const previewNote = previewId ? notes.find((n) => n.id === previewId) ?? null : null;

  const highlightTokens = (() => {
    const q = (searchQuery || "").trim();
    if (!q) return [] as string[];
    const out: string[] = [];
    for (const tok of q.split(/\s+/)) {
      if (/^(label|color|has):/i.test(tok)) continue;
      if (tok.length >= 2) out.push(tok);
    }
    return out;
  })();

  function escRx(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function highlight(text: string) {
    if (!highlightTokens.length || !text) return text;
    const rx = new RegExp(`(${highlightTokens.map(escRx).join("|")})`, "gi");
    const parts = text.split(rx);
    return parts.map((p, i) =>
      rx.test(p) && highlightTokens.some((t) => t.toLowerCase() === p.toLowerCase())
        ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
        : <Fragment key={i}>{p}</Fragment>
    );
  }

  function buildSnippets(text: string, max = 3): { before: string; match: string; after: string }[] {
    if (!highlightTokens.length || !text) return [];
    const rx = new RegExp(highlightTokens.map(escRx).join("|"), "gi");
    const out: { before: string; match: string; after: string }[] = [];
    let m: RegExpExecArray | null;
    const seen = new Set<number>();
    while ((m = rx.exec(text)) && out.length < max) {
      const start = Math.max(0, m.index - 40);
      if (seen.has(start)) continue;
      seen.add(start);
      out.push({
        before: (start > 0 ? "…" : "") + text.slice(start, m.index),
        match: m[0],
        after: text.slice(m.index + m[0].length, m.index + m[0].length + 60) + (m.index + m[0].length + 60 < text.length ? "…" : ""),
      });
    }
    return out;
  }

  const snippets = previewNote ? buildSnippets(previewNote.content || "") : [];
  const titleMatches = previewNote && highlightTokens.length ? highlightTokens.some((t) => previewNote.title.toLowerCase().includes(t.toLowerCase())) : false;

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

      <AnimatePresence onExitComplete={() => { /* noop */ }}>
        {previewNote && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/20 backdrop-blur-[2px]"
              onClick={() => setGridNavPreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              role="dialog"
              aria-label="Szybki podgląd notatki"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(42rem,calc(100vw-2rem))] max-h-[80vh] flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onWheelCapture={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-3 border-b border-border/40">
                <h2 className="font-display text-lg font-semibold leading-tight">
                  {previewNote.title ? highlight(previewNote.title) : "Bez tytułu"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Szybki podgląd · ↑/↓ PgUp/PgDn — przewiń · Enter — edytuj · Spacja/Esc — zamknij
                </p>
                {highlightTokens.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pasuje do:</span>
                    {highlightTokens.map((t) => (
                      <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{t}</span>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {snippets.length + (titleMatches ? 1 : 0)} trafień{snippets.length >= 3 ? "+" : ""}
                    </span>
                  </div>
                )}
              </div>
              <div ref={setGridNavPreviewScrollEl} className="overflow-y-auto px-6 py-4 overscroll-contain">
                {snippets.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dopasowania w treści</p>
                    {snippets.map((s, i) => (
                      <div key={i} className="text-xs text-foreground/80 bg-muted/40 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        {s.before}
                        <mark className="bg-primary/30 text-foreground rounded px-0.5">{s.match}</mark>
                        {s.after}
                      </div>
                    ))}
                  </div>
                )}
                {previewNote.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={previewNote.content} knownTitles={knownTitles} onWikiClick={onWikiClick} />
                  </div>
                )}
                {previewNote.checklist && previewNote.checklist.length > 0 && (
                  <ul className="text-sm space-y-1 mt-2">
                    {previewNote.checklist.map((c) => (
                      <li key={c.id} className={cn("flex gap-2", c.checked && "line-through text-muted-foreground")}>
                        <span>{c.checked ? "☑" : "☐"}</span><span>{highlight(c.text)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {previewNote.images && previewNote.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {previewNote.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full rounded-lg" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </SortableContext>
    </NoteViewActionsProvider>
  );
}
