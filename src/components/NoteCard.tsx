import { useState, useRef, memo, useEffect, lazy, Suspense } from "react";
import { markNoteOpened } from "@/lib/lastOpened";
import { m as motion, AnimatePresence } from "framer-motion";
import { tween, dur, ease } from "@/lib/motion";
import { cascadeDelay } from "@/lib/cardMotion";
import { Check } from "lucide-react";
import { Pin, PinOff, Archive, ArchiveRestore, X, Ellipsis } from "lucide-react";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { useNoteImages } from "@/hooks/useNoteImages";
import { haptic } from "@/lib/haptics";
import { ActionBtn, MoreActions, PrimaryActions } from "./NoteCardActions";
import { NoteEditor } from "./NoteEditor";
import { useCardGestures } from "@/hooks/useCardGestures";
import { useCardMotion } from "@/hooks/useCardMotion";
import { NoteCardBody } from "./NoteCardBody";
import { ActionSheet, DeleteNoteDialog, ImagePreviewDialog } from "./NoteCardDialogs";
import type { Note, NoteColor } from "@/hooks/useNotes";
import { useNoteEditSession } from "@/hooks/useNoteEditSession";
import { NoteImage } from "./NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSearchTerms } from "@/lib/searchTerms";
import { firstSnippet } from "@/lib/searchHighlight";
// Płótno ładowane przy pierwszym „Rysuj” — nie wchodzi do paczki startowej.
const DrawingCanvas = lazy(() => import("./DrawingCanvas").then((m) => ({ default: m.DrawingCanvas })));
import { useTrashCountdown } from "@/hooks/useTrashCountdown";
import { useViewPrefs, readingTimeMin } from "@/lib/viewPrefs";
import { useNotesMeta } from "@/hooks/NotesProvider";
import { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { useLatch } from "@/hooks/useLatch";
import { useOriginFromTile } from "@/hooks/useOriginFromTile";
import { backlinksOf } from "@/lib/wikiLinks";
import { toast } from "sonner";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

const NO_TITLES: string[] = [];

interface NoteCardProps {
  note: Note;
  index: number;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  selected?: boolean;
}

export const NoteCard = memo(function NoteCard({ note, index, dragAttributes, dragListeners, selected }: NoteCardProps) {
  const { folders, allLabels, addLabel: onCreateLabel } = useNotesMeta();
  const {
    onUpdate, onDelete, onTogglePin, onArchive, onUnarchive, onDuplicate, onMoveToFolder,
    isArchived, getVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick,
    wikiIndex, onOpenNote, selectionMode, onToggleSelect, animateLayout = true,
  } = useNoteViewActions();
  const noteVersions = getVersions?.(note.id);
  const prefs = useViewPrefs();
  const session = useNoteEditSession({
    note,
    autosaveSeconds: prefs.autosaveSeconds,
    onUpdate,
    onSaveVersion,
    wikiTitles: wikiIndex?.titles ?? NO_TITLES,
  });
  const { isEditing, fullEditor, setFullEditor, wiki, slash, handleSave, begin } = session;
  const [showColors, setShowColors] = useState(false);
  const [showMore, setShowMore] = useState(false);
  // Dotyk: „⋯” otwiera arkusz akcji od dołu zamiast rozkładać ~18 ikon w wąskim kaflu.
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchTerms = useSearchTerms();
  const snippet = searchTerms.length ? firstSnippet(note.content || "", searchTerms) : null;
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const editorMounted = useLatch(isEditing && fullEditor);
  // Pełny edytor rośnie z kafla (jak czytnik); nagłówek dostaje cień, gdy coś pod nim przewinięto.
  // Element w stanie (ref-callback): treść okna montuje się w portalu Radix render po otwarciu.
  const [editorPanel, setEditorPanel] = useState<HTMLDivElement | null>(null);
  useOriginFromTile(editorPanel, note.id, isEditing && fullEditor, 0.9);
  const [editorScrolled, setEditorScrolled] = useState(false);
  useEffect(() => { if (!isEditing || !fullEditor) setEditorScrolled(false); }, [isEditing, fullEditor]);
  const previewMounted = useLatch(!!previewImage);
  const deleteMounted = useLatch(showDeleteConfirm);
  const drawingMounted = useLatch(showDrawing);
  const sheetMounted = useLatch(sheetOpen);
  const { fileInputRef, handleImageUpload, handleEditPaste, addDrawing, removeImage } = useNoteImages({ note, onUpdate });
  const cardRef = useRef<HTMLDivElement>(null);

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const trashCountdown = useTrashCountdown(note.trashed ? note.trashedAt : null, cardRef);
  const readMin = readingTimeMin(note.content);

  const backlinks = prefs.showBacklinks && wikiIndex ? backlinksOf(note, wikiIndex) : [];
  const subpage = wikiIndex?.tree.get(note.id);

  function handleChecklistToggle(itemId: string) {
    const updated = (note.checklist || []).map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
    haptic(updated.every((i) => i.checked) ? "success" : "selection");
    onUpdate?.(note.id, { checklist: updated });
  }

  const { reduce, fx, tilt, showFx, cardVariants, pinFx, setPinFx, stampKey, setStampKey } = useCardMotion({ note, isEditing });
  const {
    isTouch, canSwipePin, canSwipeArchive, swipeEnabled, swipeX, swipeControls, swiping, swipeLabels,
    pinOpacity, archiveOpacity, handleSwipeStart, handleSwipeEnd, handleLongPressStart, handleLongPressMove,
    cancelLongPress, longPressed, rotX, rotY, handleMove, handleLeave,
  } = useCardGestures({
    note, isArchived, isEditing, selectionMode, cardRef, tilt, pinSparkle: showFx && fx.sparkle,
    onToggleSelect, onTogglePin, onArchive, onUnarchive,
  });

  // Ten sam zestaw w rozwinięciu „Więcej opcji” i w arkuszu — jeden element, dwa miejsca.
  const moreActions = (
    <MoreActions
      note={note}
      isArchived={isArchived}
      noteVersions={noteVersions}
      folders={folders}
      allLabels={allLabels}
      onCreateLabel={onCreateLabel}
      onAddImage={() => fileInputRef.current?.click()}
      onDraw={() => setShowDrawing(true)}
      onUpdate={onUpdate}
      onMoveToFolder={onMoveToFolder}
      onRestoreVersion={onRestoreVersion}
      onPresent={onPresent}
      onDuplicate={onDuplicate}
      onOpenNote={onOpenNote}
    />
  );

  // Jeden edytor, dwa miejsca: kafel i okno pełnoekranowe. Ten sam stan,
  // autosave i sesja Yjs — rozwinięcie nie zmienia ścieżki zapisu.
  function renderEditor(full: boolean) {
    return (
      <NoteEditor full={full} note={note} session={session} spellcheck={prefs.spellcheck} editorScrolled={editorScrolled} knownTitles={knownTitles} onWikiClick={onWikiClick} onUpdate={onUpdate} onPaste={handleEditPaste} />
    );
  }

  return (
    <>
      <div className={cn("relative", tilt && "perspective-[1000px]")}>
      {/* Tła gestu tylko w trakcie przeciągania — 300 kafli nie trzyma 600 elementów framer-motion. */}
      {swipeEnabled && swiping && (
        <>
          {canSwipePin && (
            <motion.div style={{ opacity: pinOpacity }} data-swipe-bg="pin" className="absolute inset-y-0 left-0 w-1/2 rounded-xl bg-primary/15 flex items-center justify-start gap-2 pl-5 pointer-events-none text-primary-ink">
              {note.pinned ? <PinOff className="w-6 h-6" aria-hidden /> : <Pin className="w-6 h-6" aria-hidden />}
              {swipeLabels && <span className="text-sm font-semibold">{note.pinned ? "Odepnij" : "Przypnij"}</span>}
            </motion.div>
          )}
          {canSwipeArchive && (
            <motion.div style={{ opacity: archiveOpacity }} data-swipe-bg="archive" className="absolute inset-y-0 right-0 w-1/2 rounded-xl bg-secondary flex items-center justify-end gap-2 pr-5 pointer-events-none text-foreground">
              {swipeLabels && <span className="text-sm font-semibold">{isArchived ? "Przywróć" : "Archiwizuj"}</span>}
              {isArchived ? <ArchiveRestore className="w-6 h-6" aria-hidden /> : <Archive className="w-6 h-6" aria-hidden />}
            </motion.div>
          )}
        </>
      )}

      <motion.div
        ref={cardRef}
        layout={animateLayout}
        variants={cardVariants}
        // Wejście osiada z 6 px; kaskada tylko dla pierwszych kart (`cascadeDelay`).
        // Wyjście zależy od intencji (kosz/archiwum) — patrz `cardExit`.
        // Opóźnienie tylko dla wejścia: `layout` ma własny tor, więc rozciąganie kafla
        // w edycji i przesuwanie sąsiadów nie czekają w kolejce.
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit="exit"
        transition={{
          default: { ...tween.enter, delay: cascadeDelay(index, reduce) },
          layout: { duration: dur.base, ease: ease.out },
        }}
        onMouseMove={tilt ? handleMove : undefined}
        onMouseLeave={tilt ? handleLeave : undefined}
        onPointerDown={(e) => {
          handleLongPressStart(e);
          if (swipeEnabled && !(e.target as Element).closest("[data-drag-handle]")) swipeControls.start(e);
        }}
        onPointerMove={handleLongPressMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={isTouch && onToggleSelect ? (e) => e.preventDefault() : undefined}
        drag={swipeEnabled ? "x" : false}
        dragControls={swipeControls}
        dragListener={false}
        dragDirectionLock
        dragElastic={0.25}
        dragConstraints={{ left: canSwipeArchive ? -160 : 0, right: canSwipePin ? 160 : 0 }}
        dragSnapToOrigin
        onDragStart={handleSwipeStart}
        onDragEnd={handleSwipeEnd}
        style={{
          ...(tilt ? { rotateX: rotX, rotateY: rotY } : {}),
          // Bez `dragListener` framer nie ustawia `touch-action` — inaczej ruch w bok przewija
          // stronę/tablicę i przerywa gest.
          ...(swipeEnabled ? { x: swipeX, touchAction: "pan-y" } : {}),
          ...(tilt ? { transformStyle: "preserve-3d" as const } : {}),
        }}

        role="article"
        aria-label={note.locked ? "Notatka prywatna" : note.title.trim() || "Notatka bez tytułu"}
        data-note-id={note.id}
        data-note-color={note.color}
        // Siatka (`NoteGrid`) rozciąga kafel w edycji na dwie kolumny.
        data-tile-editing={isEditing && !fullEditor ? "" : undefined}
        className={cn(
          "group note-card relative rounded-card border note-shadow transition-[box-shadow,border-color,translate] duration-base ease-out-soft overflow-hidden",
          colorClasses[note.color],
          selected ? "note-glow-active border-transparent" : "border-border/50"
        )}
      >
        {/* Stempel przypięcia i pieczątka „gotowe” — czysto dekoracyjne, bez zdarzeń. */}
        {pinFx > 0 && (
          <span key={pinFx} className="pin-stamp" aria-hidden onAnimationEnd={() => setPinFx(0)}>
            <span className="pin-stamp-ripple" />
            <Pin className="w-4 h-4 fill-current" />
          </span>
        )}
        {stampKey > 0 && (
          <span key={stampKey} className="card-stamp" aria-hidden onAnimationEnd={() => setStampKey(0)}>
            gotowe
          </span>
        )}

        {/* Selection checkbox */}
        {!isEditing && onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id, e.shiftKey); }}
            className={cn(
              "absolute top-2 right-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-[color,background-color,border-color,opacity] coarse:after:absolute coarse:after:-inset-2.5 coarse:after:content-['']",
              // Start zaznaczania bez Ctrl+A: pole pojawia się po najechaniu / fokusie, a na dotyku jest zawsze lekko widoczne.
              !(selectionMode || selected) && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 coarse:opacity-70",
              selected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border hover:border-primary"
            )}
            aria-label={selected ? "Odznacz notatkę" : "Zaznacz notatkę"}
          >
            {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </button>
        )}

        {/* Drag handle — poziomy, na środku górnej krawędzi, żeby nie nachodził na tytuł.
            W edycji schowany: przeciąganie i tak nie ma wtedy sensu. */}
        {dragListeners && !isEditing && (
          <div
            {...dragAttributes}
            {...dragListeners}
            aria-label="Przeciągnij, aby zmienić kolejność"
            data-drag-handle
            // Na dotyku tylko przy sortowaniu ręcznym — przy innym porządku był szumem na każdym kaflu.
            // W tablicy zawsze: przeniesienie kafla do innej kolumny nie zależy od porządku.
            className={cn(prefs.sortKey !== "manual" && prefs.layout !== "board" && "coarse:hidden", "absolute top-0 left-1/2 -translate-x-1/2 z-10 px-3 pt-0.5 pb-0 coarse:px-6 coarse:pt-1.5 coarse:pb-3 coarse:touch-none coarse:opacity-50 cursor-grab active:cursor-grabbing rounded-b-md opacity-0 group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity")}
          >
            {/* 10 px wysokości — mieści się w górnym marginesie karty i nie łapie kliknięć w tytuł. */}
            <div className="grid grid-cols-3 gap-[2px]" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />)}
            </div>
          </div>
        )}

        {/* Images */}
        {note.images && note.images.length > 0 && (
          // Poza edycją jedna miniatura 16:9 i „+N” — siatka czterech zdjęć wydłużała kafel.
          // W edycji wszystkie (do 4), bo każde ma przycisk usuwania.
          <div className={cn("grid gap-0.5", isEditing && note.images.length > 1 && "grid-cols-2")}>
            {note.images.slice(0, isEditing ? note.images.length : 1).map((img, i) => (
              <div key={i} className="relative group/img cursor-pointer overflow-hidden" onClick={() => setPreviewImage(img)}>
                <NoteImage imageRef={img} alt={`Obraz ${i + 1} z ${note.images.length}`} className={cn("w-full object-cover transition-transform duration-300 group-hover/img:scale-105", isEditing ? "h-24" : "aspect-video")} />
                {!isEditing && note.images.length > 1 && (
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-foreground/60 text-background text-2xs font-semibold tabular-nums">
                    +{note.images.length - 1}
                  </span>
                )}
                {isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    aria-label="Usuń obrazek"
                    className="absolute top-1 right-1 p-1 coarse:p-2 rounded-full bg-foreground/60 text-background opacity-0 coarse:opacity-100 group-hover/img:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className={cn("cursor-pointer", isEditing && !fullEditor ? "p-4" : "card-body px-3.5 pt-3 pb-2.5 leading-normal", note.largeText ? "text-base" : "text-[0.875rem]")}
          onClick={(e) => {
            if (longPressed.current) { longPressed.current = false; return; }
            if (swiping || Math.abs(swipeX.get()) > 4) return;
            if (selectionMode && onToggleSelect) { onToggleSelect(note.id, e.shiftKey); return; }

            // Na telefonie kafel ma pół ekranu — edycja w nim ucinała tytuł i układała ikony w kolumnę.
            // Od razu pełny edytor (na `< sm` zajmuje cały ekran); z myszą zostaje edycja w kaflu.
            if (note.readOnly && !isEditing) {
              toast("Notatka jest zablokowana do edycji", { action: { label: "Odblokuj", onClick: () => onUpdate?.(note.id, { readOnly: undefined }) } });
              return;
            }
            if (!isEditing && window.matchMedia("(max-width: 639px)").matches) setFullEditor(true);
            if (!isEditing) { markNoteOpened(note.id); begin(); }
          }}
        >
          {isEditing && !fullEditor ? renderEditor(false) : (
            <NoteCardBody
              note={note}
              isArchived={isArchived}
              selectable={!!onToggleSelect}
              snippet={snippet}
              searchTerms={searchTerms}
              knownTitles={knownTitles}
              onWikiClick={onWikiClick}
              onUpdate={onUpdate}
              onOpenNote={onOpenNote}
              onUnarchive={onUnarchive}
              handleChecklistToggle={handleChecklistToggle}
              backlinks={backlinks}
              subpage={subpage}
              trashCountdown={trashCountdown}
              showReadingTime={prefs.showReadingTime}
              wordCount={wordCount}
              readMin={readMin}
            />
          )}
        </div>

        {/* Actions — 4 główne, reszta pod „więcej” */}
        {/* Z myszą akcje pokazują się dopiero po najechaniu lub fokusie — treść
            karty jest ważniejsza niż sześć ikon. Na dotyku (brak hovera) zostają
            widoczne, za to z celami 44 px. Klasa CSS, nie `animate` framer-motion:
            styl inline `opacity: 1` nadpisywał wcześniej ukrywanie. */}
        {/* Na dotyku główne akcje są schowane za „⋯” (CSS `.card-primary`), żeby
            kafel nie kończył się rzędem sześciu dużych ikon. */}
        <div className="card-actions flex items-center gap-0.5 px-2 pb-2 flex-wrap" data-open={showColors || showMore || undefined} data-more={showMore || undefined} data-editing={isEditing || undefined}>
          <div className="card-primary contents">
            {/* Dotyk: te akcje są w arkuszu „⋯” — w stopce i tak niewidoczne (CSS), więc bez renderu. */}
            {!isTouch && (
              <PrimaryActions
                note={note}
                isArchived={isArchived}
                inSheet={false}
                pinSparkle={showFx && fx.sparkle}
                onToggleColors={() => setShowColors(!showColors)}
                onAskDeleteConfirm={() => setShowDeleteConfirm(true)}
                onUpdate={onUpdate}
                onTogglePin={onTogglePin}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                onDelete={onDelete}
              />
            )}
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

          <ActionBtn
            icon={<Ellipsis className="w-4 h-4" />}
            onClick={() => (isTouch ? setSheetOpen(true) : setShowMore((v) => !v))}
            title={showMore ? "Mniej opcji" : "Więcej opcji"}
            aria-expanded={isTouch ? sheetOpen : showMore}
            className={cn("ml-auto", showMore && "text-primary-ink bg-primary/10")}
          />
        </div>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-3 overflow-hidden"
            >
              <div className="flex items-center gap-0.5 flex-wrap border-t border-border/40 pt-2">
                {moreActions}
              </div>
            </motion.div>
          )}
        </AnimatePresence>


        {showColors && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-4 pb-3">
            <ColorPicker selected={note.color} onSelect={(c: NoteColor) => { onUpdate?.(note.id, { color: c }); setShowColors(false); }} />
          </motion.div>
        )}
      </motion.div>
      </div>

      {sheetMounted && <ActionSheet open={sheetOpen} onOpenChange={setSheetOpen} note={note} isArchived={isArchived} pinSparkle={showFx && fx.sparkle} onAskDeleteConfirm={() => setShowDeleteConfirm(true)} more={moreActions} onUpdate={onUpdate} onTogglePin={onTogglePin} onArchive={onArchive} onUnarchive={onUnarchive} onDelete={onDelete} />}

      {/* Dialogi montowane przy pierwszym otwarciu — 150 kart nie trzyma czterech nieużywanych okien. */}
      {editorMounted && <Dialog open={isEditing && fullEditor} onOpenChange={(open) => { if (!open) handleSave(); }}>
        <DialogContent
          ref={setEditorPanel}
          // Pasek koloru notatki u góry okna (ta sama reguła `--note-ink` co na kaflu).
          data-note-color={note.color}
          // Przewinięcie czegokolwiek w oknie (treść, lista, podgląd) — zdarzenie `scroll` nie bąbelkuje.
          onScrollCapture={(e) => setEditorScrolled((e.target as HTMLElement).scrollTop > 0)}
          // Telefon: od krawędzi do krawędzi, bez prześwitu nawigacji; od `sm` okno.
          className="w-full max-w-3xl h-[calc(100dvh-var(--kb-inset,0px))] max-sm:top-0 max-sm:translate-y-0 rounded-none border-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col sm:w-[calc(100vw-2rem)] sm:h-[85vh] sm:rounded-2xl sm:border sm:p-6"
          // Esc przy otwartych podpowiedziach `[[` chowa listę, nie zamyka edytora.
          onEscapeKeyDown={(e) => { if (slash.isOpen) { e.preventDefault(); slash.dismiss(); } else if (wiki.isOpen) { e.preventDefault(); wiki.dismiss(); } }}
        >
          <DialogTitle className="sr-only">Edycja notatki</DialogTitle>
          {isEditing && fullEditor && renderEditor(true)}
        </DialogContent>
      </Dialog>}

      {previewMounted && <ImagePreviewDialog imageRef={previewImage} onClose={() => setPreviewImage(null)} />}

      {deleteMounted && <DeleteNoteDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm} note={note} onDelete={onDelete} />}

      {drawingMounted && <Suspense fallback={null}><DrawingCanvas open={showDrawing} onOpenChange={setShowDrawing} onSave={addDrawing} /></Suspense>}
    </>
  );
});
