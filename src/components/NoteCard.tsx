import { useState, useRef, memo, useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { markNoteOpened } from "@/lib/lastOpened";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { tween, dur, ease } from "@/lib/motion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { cascadeDelay, cardExit, markPinned, hasRecentPin, consumePin, type CardExitIntent } from "@/lib/cardMotion";
import { Check } from "lucide-react";
import { Star, Pin, Trash2, Palette, Archive, ArchiveRestore, ImagePlus, X, Copy, Type, PenTool, ListChecks, Eye, EyeOff, RotateCcw, MoreHorizontal, Maximize2, Minimize2, Expand, Link2 } from "lucide-react";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { LabelPicker, LabelBadges } from "./LabelPicker";
import { ReminderPicker, ReminderBadge } from "./ReminderPicker";
import { PriorityPicker, PriorityBadge } from "./PriorityPicker";
import { ChecklistCount, ChecklistPreview } from "./ChecklistEditor";
import { ChecklistConvertButtons, ChecklistEditor } from "./ChecklistEditor";
import { isChecklistShortcut, selectionToChecklist } from "@/lib/checklistPaste";
import { handleEditorKey } from "@/lib/editorKeysDom";
import { EditorStats } from "./EditorStats";
import { prepareImage } from "@/lib/imagePrepare";
import { FindReplaceBar } from "./FindReplaceBar";
import { haptic } from "@/lib/haptics";
import { TitleField } from "./TitleField";
import { MarkdownRenderer, FormatToolbar } from "./MarkdownRenderer";
import { ShareNote } from "./ShareNote";
import { PrivateNoteButton } from "./vault/PrivateNoteButton";
import { FolderPicker } from "./FolderPicker";
import { VersionHistory } from "./VersionHistory";
import type { Note, NoteColor, ChecklistItem } from "@/hooks/useNotes";
import { beginNoteTextEdit, endNoteTextEdit } from "@/hooks/useNotes";
import { imageStore } from "@/lib/imageStore";
import { NoteImage } from "./NoteImage";
import { AttachmentsPanel } from "./AttachmentsPanel";
import { AttachmentsBadge } from "./AttachmentsList";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DrawingCanvas } from "./DrawingCanvas";
import { useTrashCountdown } from "@/hooks/useTrashCountdown";
import { celebrate, sparkle } from "@/lib/celebrate";
import { useViewPrefs, readingTimeMin } from "@/lib/viewPrefs";
import { useEffectsSettings } from "@/lib/effectsSettings";
import { useNotesMeta } from "@/hooks/NotesProvider";
import { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { useLatch } from "@/hooks/useLatch";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useLiveNoteText } from "@/hooks/useLiveNoteText";
import { useWikiAutocomplete } from "@/hooks/useWikiAutocomplete";
import { useSlashMenu } from "@/hooks/useSlashMenu";
import { NoteLookPicker, NoteCoverStrip } from "./NoteLookPicker";
import { backlinksOf } from "@/lib/wikiLinks";
import { toast } from "sonner";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

const NO_TITLES: string[] = [];
/** Na kaflu jeden link zwrotny i „+N” — pełna lista jest w czytniku. */
const BACKLINKS_SHOWN = 1;

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
  const [showColors, setShowColors] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editChecklist, setEditChecklist] = useState<ChecklistItem[]>(note.checklist || []);
  const [showChecklist, setShowChecklist] = useState((note.checklist || []).length > 0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fullEditor, setFullEditor] = useState(false);
  const editorMounted = useLatch(isEditing && fullEditor);
  const previewMounted = useLatch(!!previewImage);
  const deleteMounted = useLatch(showDeleteConfirm);
  const drawingMounted = useLatch(showDrawing);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /** Ctrl+Shift+L zamienia zaznaczone linie (albo bieżącą) na pozycje listy zadań; reszta klawiszy trafia do podpowiedzi wikilinków. */
  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isChecklistShortcut(e)) {
      e.preventDefault();
      const r = selectionToChecklist(editContent, e.currentTarget.selectionStart, e.currentTarget.selectionEnd, editChecklist);
      if (r) { setEditContent(r.content); setEditChecklist(r.checklist); setShowChecklist(true); }
      return;
    }
    // Ctrl+F / Ctrl+H w treści: znajdź i zamień w tej notatce (zamiast wyszukiwania przeglądarki).
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h")) {
      e.preventDefault();
      setFindOpen(true);
      return;
    }
    // Menu „/” przejmuje strzałki, Enter, Tab i Esc, dopóki jest otwarte.
    if (slash.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { slash.onKeyDown(e); return; }
    // Otwarta lista `[[` ma pierwszeństwo dla Enter/Tab/strzałek/Esc; Ctrl/Alt jej nie dotyczą.
    if (wiki.isOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { wiki.textareaProps.onKeyDown(e); return; }
    if (handleEditorKey(e, { onSave: handleSave })) return;
    wiki.textareaProps.onKeyDown(e);
  }
  const [findOpen, setFindOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const trashCountdown = useTrashCountdown(note.trashed ? note.trashedAt : null, cardRef);
  const prefs = useViewPrefs();
  const readMin = readingTimeMin(note.content);

  // Edycja w kaflu rośnie z treścią (do ~60% ekranu), zamiast pokazywać 2 linie.
  // Pełny ekran bez listy ma własną wysokość (`h-full`), tam nie ruszamy;
  // z listą treść rośnie do ~35% ekranu, a resztę dostaje lista.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!isEditing || (fullEditor && !showChecklist) || !ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight + 2, Math.round(window.innerHeight * (fullEditor ? 0.35 : 0.6)))}px`;
  }, [isEditing, fullEditor, showChecklist, showPreview, editContent]);

  // Szkic trzymamy też w refie: `commitDraft` jest wołane z cleanupu efektu
  // przy odmontowaniu, gdzie zwykłe domknięcie byłoby już zestarzałe.
  const draftRef = useRef({ title: editTitle, content: editContent, checklist: editChecklist });
  draftRef.current = { title: editTitle, content: editContent, checklist: editChecklist };
  // Wersję zapisujemy raz na sesję edycji — inaczej autosave co 5 s wyczerpałby
  // limit 20 wersji na notatkę w ciągu dwóch minut pisania.
  const versionSavedRef = useRef(false);

  const commitDraft = useCallback(() => {
    const draft = draftRef.current;
    const title = draft.title.trim();
    const content = draft.content.trim();
    const checklistChanged = JSON.stringify(draft.checklist) !== JSON.stringify(note.checklist || []);
    if (note.title === title && note.content === content && !checklistChanged) return;

    if (onSaveVersion && !versionSavedRef.current) {
      onSaveVersion(note.id, note.title, note.content);
      versionSavedRef.current = true;
    }
    onUpdate?.(note.id, { title, content, checklist: draft.checklist });
  }, [note.id, note.title, note.content, note.checklist, onSaveVersion, onUpdate]);

  useDraftAutosave({
    active: isEditing,
    draftKey: `${editTitle} ${editContent} ${JSON.stringify(editChecklist)}`,
    intervalSeconds: prefs.autosaveSeconds,
    onSave: commitDraft,
  });

  useLiveNoteText({
    noteId: note.id,
    active: isEditing,
    textareaRef,
    getDraft: () => draftRef.current.content,
    setDraft: setEditContent,
  });

  const wiki = useWikiAutocomplete({
    textareaRef,
    value: editContent,
    onChange: setEditContent,
    titles: wikiIndex?.titles ?? NO_TITLES,
    exclude: editTitle,
  });
  const slash = useSlashMenu({ textareaRef, value: editContent, disabled: wiki.isOpen });
  function handleEditSelect() { wiki.textareaProps.onSelect(); slash.refresh(); }
  const backlinks = prefs.showBacklinks && wikiIndex ? backlinksOf(note, wikiIndex) : [];

  // Sesję zamykamy po zapisie przy odmontowaniu — cleanupy efektów idą
  // w kolejności deklaracji, więc `useDraftAutosave` zdąży zapisać pierwszy.
  useEffect(() => () => endNoteTextEdit(note.id), [note.id]);

  function handleSave() {
    haptic("success");
    commitDraft();
    endNoteTextEdit(note.id);
    setIsEditing(false);
    setShowPreview(false);
    setFullEditor(false);
  }

  function handleLabelToggle(label: string) {
    const labels = note.labels.includes(label) ? note.labels.filter((l) => l !== label) : [...note.labels, label];
    onUpdate?.(note.id, { labels });
  }

  function handleChecklistToggle(itemId: string) {
    const updated = (note.checklist || []).map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
    haptic("tap");
    onUpdate?.(note.id, { checklist: updated });
  }

  function handleFormatInsert(before: string, after: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editContent.slice(start, end);
    const newContent = editContent.slice(0, start) + before + selected + after + editContent.slice(end);
    setEditContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    await addImages(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Wklejony zrzut ekranu albo skopiowany obraz trafia do notatki zamiast do pola tekstu. */
  function handleEditPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (pasted.length === 0) return;
    e.preventDefault();
    void addImages(pasted);
  }

  /** Obrazy większe niż limit są skalowane; dopiero gdy się nie da, trafiają na listę pominiętych. */
  async function addImages(files: File[]) {
    const newImages: string[] = [];
    let skipped = 0;
    try {
      for (const file of files) {
        const prepared = await prepareImage(file);
        if (!prepared) { skipped++; continue; }
        newImages.push(await imageStore.putBlob(prepared));
      }
    } catch {
      toast.error("Nie udało się zapisać obrazka", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare notatki z obrazkami i spróbuj ponownie." });
    }
    if (skipped > 0) {
      toast.error(skipped === 1 ? "Obrazek jest za duży (max 2 MB)" : `${skipped} obrazków jest za dużych (max 2 MB)`, {
        description: newImages.length > 0 ? "Pozostałe zostały dodane." : undefined,
      });
    }
    if (newImages.length) onUpdate?.(note.id, { images: [...(note.images || []), ...newImages] });
  }

  function removeImage(idx: number) {
    const before = [...(note.images || [])];
    const updated = [...before];
    updated.splice(idx, 1);
    onUpdate?.(note.id, { images: updated });
    toast("Usunięto obrazek", { action: { label: "Cofnij", onClick: () => onUpdate?.(note.id, { images: before }) } });
  }

  // Subtle 3D hover tilt — opt-in (effectsSettings.cardTilt), never with reduced motion.
  // Ruch ograniczamy zarówno ustawieniem aplikacji, jak i preferencją systemu.
  const osReduce = useReducedMotion();
  const { reduced: appReduce } = useMotionPref();
  const reduce = !!osReduce || appReduce;
  const fx = useEffectsSettings();
  const tilt = fx.cardTilt && !reduce;
  const showFx = !reduce;

  // Wyjście zależne od akcji (kosz/archiwum) — intencję podaje `custom` z AnimatePresence w NoteGrid.
  const cardVariants = useMemo(() => ({
    exit: (intent: CardExitIntent | undefined) => cardExit(intent, note.id, reduce),
  }), [note.id, reduce]);

  // „Klik pinezki”: po przypięciu notatka trafia do innej sekcji (karta montuje się od nowa),
  // więc na nowej karcie na chwilę pojawia się pinezka z falą.
  const [pinFx, setPinFx] = useState(0);
  useEffect(() => {
    if (note.pinned && hasRecentPin(note.id)) {
      consumePin(note.id);
      if (showFx) setPinFx((k) => k + 1);
    }
  }, [note.pinned, note.id, showFx]);

  // Pieczątka „gotowe” po odhaczeniu ostatniego zadania (efekt „Deszcz emoji”).
  const checklistItems = note.checklist || [];
  const allDone = checklistItems.length > 0 && checklistItems.every((i) => i.checked);
  const prevAllDone = useRef(allDone);
  const [stampKey, setStampKey] = useState(0);
  useEffect(() => {
    if (allDone && !prevAllDone.current && !isEditing && !note.trashed && fx.emojiShower && showFx) {
      setStampKey((k) => k + 1);
    }
    prevAllDone.current = allDone;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagujemy tylko na zmianę „wszystko gotowe”
  }, [allDone]);
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const rotX = useSpring(useTransform(mvY, [-0.5, 0.5], [4, -4]), { stiffness: 220, damping: 18 });
  const rotY = useSpring(useTransform(mvX, [-0.5, 0.5], [-4, 4]), { stiffness: 220, damping: 18 });

  // Swipe-to-act (touch): right → archiwum, left → kosz
  const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const canSwipeArchive = !!onArchive && !isArchived && !note.trashed;
  const canSwipeTrash = !note.trashed;
  const swipeEnabled = isTouch && !isEditing && !selectionMode && (canSwipeArchive || canSwipeTrash);
  const swipeX = useMotionValue(0);
  const archiveOpacity = useTransform(swipeX, [0, 40, 110], [0, 0.5, 1]);
  const trashOpacity = useTransform(swipeX, [0, -40, -110], [0, 0.5, 1]);
  const [swiping, setSwiping] = useState(false);

  function handleSwipeEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    setSwiping(false);
    const dx = info.offset.x;
    const fast = Math.abs(info.velocity.x) > 500;
    const threshold = fast ? 60 : 110;
    if (dx > threshold && canSwipeArchive) {
      haptic("tap");
      onArchive?.(note.id);
    } else if (dx < -threshold && canSwipeTrash) {
      haptic("warn");
      onDelete(note.id);
    }
    swipeX.set(0);
  }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isEditing || !tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mvX.set((e.clientX - r.left) / r.width - 0.5);
    mvY.set((e.clientY - r.top) / r.height - 0.5);
  }
  function handleLeave() { mvX.set(0); mvY.set(0); }

  // Jeden edytor, dwa miejsca: kafel i okno pełnoekranowe. Ten sam stan,
  // autosave i sesja Yjs — rozwinięcie nie zmienia ścieżki zapisu.
  function renderEditor(full: boolean) {
    // Pełny ekran z listą: lista zaraz pod treścią i to ona wypełnia okno —
    // inaczej pusta treść zajmowała ekran, a pozycje lądowały na dole.
    const contentFills = full && !showChecklist;
    const textareaCls = full
      ? cn("w-full bg-transparent text-base leading-relaxed text-foreground/90 outline-none resize-none", contentFills && "h-full")
      : "w-full bg-transparent text-sm text-foreground/80 outline-none resize-none";
    return (
      <div
        className={full ? "flex flex-col gap-3 h-full min-h-0" : "space-y-2"}
        onClick={(e) => e.stopPropagation()}
        // Wyjście fokusem poza edytor zapisuje, ale go nie zamyka —
        // zamknięcie przy kliknięciu w paletę kolorów byłoby zaskoczeniem.
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commitDraft();
        }}
      >
        {/* W oknie `pr-*` zostawia miejsce na ✕ w prawym górnym rogu. */}
        <TitleField spellCheck={prefs.spellcheck} autoFocus value={editTitle} onChange={setEditTitle} onEnter={() => textareaRef.current?.focus()} className={cn("w-full bg-transparent font-display font-semibold text-foreground outline-none", full && "text-2xl pr-8 coarse:pr-12")} placeholder="Tytuł" />
        {findOpen && <FindReplaceBar value={editContent} onChange={setEditContent} textareaRef={textareaRef} onClose={() => setFindOpen(false)} />}
        <div className="flex items-center gap-1">
          <FormatToolbar onInsert={handleFormatInsert} nowrap={!full} />
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={cn("p-1 rounded text-2xs transition-colors ml-auto", showPreview ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
            title={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
            aria-label={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setFullEditor(!full)}
            // Na telefonie edycja jest zawsze pełnoekranowa — powrót do wąskiego kafla nie ma sensu.
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors max-sm:hidden"
            title={full ? "Wróć do kafla" : "Pełny ekran"}
            aria-label={full ? "Wróć do kafla" : "Pełny ekran"}
          >
            {full ? <Minimize2 className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* `relative`: tu kotwiczy się lista podpowiedzi `[[` (pozycja karetki). */}
        <div className={cn("relative", contentFills && "flex-1 min-h-0")}>
          {showPreview ? (
            <div className={cn("grid grid-cols-2 gap-2", contentFills && "h-full")}>
              <textarea spellCheck={prefs.spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} {...wiki.textareaProps} onSelect={handleEditSelect} onKeyDown={handleEditKeyDown} onPaste={handleEditPaste} className={cn(textareaCls, "border border-border/30 rounded-lg p-2", !contentFills && "min-h-[80px]")} placeholder="Treść notatki..." />
              <div className={cn("bg-muted/20 rounded-lg p-2 overflow-y-auto border border-border/30", contentFills ? "h-full" : "min-h-[80px]")}>
                {editContent ? <MarkdownRenderer content={editContent} knownTitles={knownTitles} onWikiClick={onWikiClick} /> : <p className="text-xs text-muted-foreground italic">Podgląd...</p>}
              </div>
            </div>
          ) : (
            <textarea spellCheck={prefs.spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} {...wiki.textareaProps} onSelect={handleEditSelect} onKeyDown={handleEditKeyDown} onPaste={handleEditPaste} className={cn(textareaCls, !full && "min-h-[60px]")} placeholder="Treść notatki..." />
          )}
          {wiki.popup()}{slash.popup()}
        </div>

        {/* Checklist toggle + konwersja tekst ↔ lista */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            className={cn("flex items-center gap-1.5 text-xs transition-colors", showChecklist ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <ListChecks className="w-3.5 h-3.5" />
            {showChecklist ? "Lista zadań" : "Dodaj listę"}
          </button>
          <ChecklistConvertButtons
            content={editContent}
            checklist={editChecklist}
            onConvert={(r, toList) => { setEditContent(r.content); setEditChecklist(r.checklist); setShowChecklist(toList); }}
          />
        </div>

        {showChecklist && (
          <div className={full ? "flex-1 min-h-0 overflow-y-auto" : undefined}>
            <ChecklistEditor items={editChecklist} onChange={setEditChecklist} />
          </div>
        )}

        {!note.locked && <AttachmentsPanel attachments={note.attachments ?? []} onChange={(attachments) => onUpdate?.(note.id, { attachments })} showAddButton />}

        <div className="flex items-center justify-between">
          <span className="text-2xs text-muted-foreground flex items-center gap-1 whitespace-nowrap min-w-0 truncate">
            <Type className="w-3 h-3 shrink-0" />
            <EditorStats textareaRef={textareaRef} value={editContent} />
          </span>
          <button onClick={handleSave} className="text-sm font-medium text-primary hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors">Zapisz</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative", tilt && "[perspective:1000px]")}>
      {swipeEnabled && (
        <>
          <motion.div style={{ opacity: archiveOpacity }} className="absolute inset-y-0 left-0 w-1/2 rounded-xl bg-primary/15 flex items-center justify-start pl-5 pointer-events-none">
            <Archive className="w-6 h-6 text-primary" />
          </motion.div>
          <motion.div style={{ opacity: trashOpacity }} className="absolute inset-y-0 right-0 w-1/2 rounded-xl bg-destructive/15 flex items-center justify-end pr-5 pointer-events-none">
            <Trash2 className="w-6 h-6 text-destructive" />
          </motion.div>
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
        drag={swipeEnabled ? "x" : false}
        dragDirectionLock
        dragElastic={0.25}
        dragConstraints={{ left: canSwipeTrash ? -160 : 0, right: canSwipeArchive ? 160 : 0 }}
        dragSnapToOrigin
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleSwipeEnd}
        style={{
          ...(tilt ? { rotateX: rotX, rotateY: rotY } : {}),
          ...(swipeEnabled ? { x: swipeX } : {}),
          ...(tilt ? { transformStyle: "preserve-3d" as const } : {}),
        }}

        role="article"
        aria-label={note.locked ? "Notatka prywatna" : note.title.trim() || "Notatka bez tytułu"}
        data-note-id={note.id}
        data-note-color={note.color}
        // Siatka (`NoteGrid`) rozciąga kafel w edycji na dwie kolumny.
        data-tile-editing={isEditing && !fullEditor ? "" : undefined}
        className={cn(
          "group note-card relative rounded-xl border note-shadow transition-[box-shadow,border-color,translate] duration-base ease-out-soft overflow-hidden",
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
              "absolute top-2 right-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-[color,background-color,border-color,opacity]",
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
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10 px-3 pt-0.5 pb-0 cursor-grab active:cursor-grabbing rounded-b-md opacity-0 group-hover:opacity-60 hover:!opacity-100 focus-visible:opacity-100 transition-opacity"
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
          className={cn("cursor-pointer", isEditing && !fullEditor ? "p-4" : "card-body px-3 pt-2.5 pb-2 text-[0.8125rem] sm:text-sm leading-snug")}
          onClick={(e) => {
            if (swiping || Math.abs(swipeX.get()) > 4) return;
            if (selectionMode && onToggleSelect) { onToggleSelect(note.id, e.shiftKey); return; }

            // Na telefonie kafel ma pół ekranu — edycja w nim ucinała tytuł i układała ikony w kolumnę.
            // Od razu pełny edytor (na `< sm` zajmuje cały ekran); z myszą zostaje edycja w kaflu.
            if (!isEditing && window.matchMedia("(max-width: 639px)").matches) setFullEditor(true);
            if (!isEditing) { markNoteOpened(note.id); versionSavedRef.current = false; setIsEditing(true); setEditTitle(note.title); setEditContent(beginNoteTextEdit(note.id) ?? note.content); setEditChecklist(note.checklist || []); setShowChecklist((note.checklist || []).length > 0); }
          }}
        >
          {isEditing && !fullEditor ? renderEditor(false) : (
            <>
              <NoteCoverStrip cover={note.cover} className="-mx-3 -mt-2.5 mb-2 w-[calc(100%+1.5rem)] rounded-t-[inherit]" />
              {(note.title || note.icon) && (
                <h3 className="font-display font-semibold text-[0.9375rem] leading-tight text-foreground mb-0.5 line-clamp-2">
                  {note.icon && <span className="mr-1.5" aria-hidden>{note.icon}</span>}
                  {note.title}
                  <ChecklistCount items={note.checklist || []} />
                </h3>
              )}
              {note.content && (
                // Kafel to zapowiedź, nie lektura: 4 linie (na telefonie 3) i zwykła interlinia — pełny tekst jest w czytniku.
                <div className="line-clamp-4 max-sm:line-clamp-3 text-foreground/85 [&_p]:leading-normal [&_li]:leading-normal [&_p]:mb-0.5">
                  <MarkdownRenderer content={note.content} knownTitles={knownTitles} onWikiClick={onWikiClick} />
                </div>
              )}
              {(note.checklist || []).length > 0 && (
                <ChecklistPreview items={note.checklist} onToggle={handleChecklistToggle} showProgress={!note.title} />
              )}
              {/* Etykiety, przypomnienie i priorytet w jednym rzędzie — każde w osobnej linii robiło z kafla wieżę. */}
              <div className="flex items-center gap-1 flex-wrap mt-1.5 empty:hidden [&>*]:!mt-0">
                <LabelBadges labels={note.labels} />
                <ReminderBadge reminder={note.reminder} reminderRepeat={note.reminderRepeat} />
                <PriorityBadge priority={note.priority ?? "none"} />
                <AttachmentsBadge attachments={note.attachments} />
              </div>
              {backlinks.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 min-w-0 text-2xs text-muted-foreground" title="Linkują tu">
                  <Link2 className="w-3 h-3 shrink-0" aria-hidden />
                  <span className="sr-only">Linkują tu:</span>
                  {backlinks.slice(0, BACKLINKS_SHOWN).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenNote?.(b.id); }}
                      className="min-w-0 px-1.5 py-0.5 rounded-full bg-foreground/5 hover:bg-primary/10 hover:text-primary truncate transition-colors"
                    >
                      {b.title || "Bez tytułu"}
                    </button>
                  ))}
                  {backlinks.length > BACKLINKS_SHOWN && <span className="shrink-0">+{backlinks.length - BACKLINKS_SHOWN}</span>}
                </div>
              )}
              {trashCountdown && (
                <div className="inline-flex items-center gap-1 mt-2">
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium",
                    trashCountdown.urgent ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                  )}>
                    <Trash2 className="w-3 h-3" />
                    {trashCountdown.label}
                  </div>
                  {onUnarchive && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        celebrate(r.left + r.width / 2, r.top + r.height / 2);
                        onUnarchive(note.id);
                      }}
                      className="pressable inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Przywróć notatkę"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Przywróć
                    </button>
                  )}
                </div>
              )}
              {/* Liczba słów jest w czytniku — na wąskim kaflu łamała stopkę na trzy linie. */}
              <div className="card-meta flex items-center gap-1.5 mt-1.5 text-2xs text-muted-foreground whitespace-nowrap">
                {prefs.showReadingTime && wordCount > 0 && readMin >= 2 && <><span>~{readMin} min</span><span aria-hidden>·</span></>}
                <span>{format(new Date(note.updatedAt), "d MMM", { locale: pl })}</span>
              </div>
            </>
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
          {!isArchived && (
            <ActionBtn
              icon={<Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />}
              onClick={(e) => {
                if (!note.pinned) {
                  if (showFx && fx.sparkle) markPinned(note.id);
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  sparkle(r.left + r.width / 2, r.top + r.height / 2);
                }
                haptic("tap");
                onTogglePin?.(note.id);
              }}
              title={note.pinned ? "Odepnij" : "Przypnij"}
            />
          )}
          <ActionBtn icon={<Palette className="w-4 h-4" />} onClick={() => setShowColors(!showColors)} title="Kolor" />
          {!isArchived && (
            <ReminderPicker
              reminder={note.reminder}
              reminderRepeat={note.reminderRepeat}
              reminderRepeatUntil={note.reminderRepeatUntil}
              onSet={(r, repeat, until) => onUpdate?.(note.id, { reminder: r, reminderRepeat: repeat, reminderRepeatUntil: until })}
            />
          )}
          {!isArchived && (
            <PriorityPicker
              priority={note.priority ?? "none"}
              onSet={(p) => onUpdate?.(note.id, { priority: p })}
            />
          )}
          {isArchived && onUnarchive ? (
            <ActionBtn icon={<ArchiveRestore className="w-4 h-4" />} onClick={() => onUnarchive(note.id)} title="Przywróć" />
          ) : onArchive ? (
            <ActionBtn icon={<Archive className="w-4 h-4" />} onClick={() => { haptic("tap"); onArchive(note.id); }} title="Archiwizuj" />
          ) : null}
          <ActionBtn
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => { if (note.trashed) setShowDeleteConfirm(true); else { haptic("warn"); onDelete(note.id); } }}
            title="Usuń"
            className="hover:text-destructive"
          />
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

          <ActionBtn
            icon={<MoreHorizontal className="w-4 h-4" />}
            onClick={() => setShowMore((v) => !v)}
            title={showMore ? "Mniej opcji" : "Więcej opcji"}
            aria-expanded={showMore}
            className={cn("ml-auto", showMore && "text-primary bg-primary/10")}
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
                <NoteLookPicker icon={note.icon} cover={note.cover} onChange={(patch) => onUpdate?.(note.id, patch)} />
                {!isArchived && (
                  <ActionBtn
                    icon={<Star className={cn("w-4 h-4", note.favorite && "fill-current")} />}
                    onClick={() => { haptic("tap"); onUpdate?.(note.id, { favorite: note.favorite ? undefined : true }); }}
                    title={note.favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
                    className={cn(note.favorite && "text-primary")}
                  />
                )}
                {!note.locked && <ActionBtn icon={<ImagePlus className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()} title="Dodaj obrazek" />}
                {!note.locked && <ActionBtn icon={<PenTool className="w-4 h-4" />} onClick={() => setShowDrawing(true)} title="Rysuj" />}
                {!isArchived && (
                  <LabelPicker allLabels={allLabels} selected={note.labels} onToggle={handleLabelToggle} onCreateLabel={onCreateLabel} />
                )}
                {onMoveToFolder && folders && folders.length > 0 && (
                  <FolderPicker folders={folders} currentFolderId={note.folderId} onSelect={(fId) => onMoveToFolder(note.id, fId)} />
                )}
                <PrivateNoteButton noteId={note.id} locked={!!note.locked} />
                {!note.locked && <ShareNote note={note} />}
                {!note.locked && noteVersions && onRestoreVersion && (
                  <VersionHistory versions={noteVersions} onRestore={(v) => onRestoreVersion(note.id, v)} />
                )}
                {!note.locked && onPresent && (
                  <ActionBtn icon={<Maximize2 className="w-4 h-4" />} onClick={() => onPresent(note.id)} title="Prezentacja" />
                )}
                {onDuplicate && (
                  <ActionBtn icon={<Copy className="w-4 h-4" />} onClick={() => onDuplicate(note.id)} title="Duplikuj" />
                )}
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

      {/* Dialogi montowane przy pierwszym otwarciu — 150 kart nie trzyma czterech nieużywanych okien. */}
      {editorMounted && <Dialog open={isEditing && fullEditor} onOpenChange={(open) => { if (!open) handleSave(); }}>
        <DialogContent
          // Telefon: od krawędzi do krawędzi, bez prześwitu nawigacji; od `sm` okno.
          className="w-full max-w-3xl h-[100dvh] rounded-none border-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex flex-col sm:w-[calc(100vw-2rem)] sm:h-[85vh] sm:rounded-2xl sm:border sm:p-6"
          // Esc przy otwartych podpowiedziach `[[` chowa listę, nie zamyka edytora.
          onEscapeKeyDown={(e) => { if (slash.isOpen) { e.preventDefault(); slash.dismiss(); } else if (wiki.isOpen) { e.preventDefault(); wiki.dismiss(); } }}
        >
          <DialogTitle className="sr-only">Edycja notatki</DialogTitle>
          {isEditing && fullEditor && renderEditor(true)}
        </DialogContent>
      </Dialog>}

      {previewMounted && <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-transparent border-none shadow-none">
          {previewImage && <NoteImage imageRef={previewImage} loading="eager" className="w-full rounded-2xl shadow-2xl" placeholderClassName="aspect-video" />}
        </DialogContent>
      </Dialog>}

      {deleteMounted && <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Usunąć notatkę?</AlertDialogTitle>
            <AlertDialogDescription>
              {note.title ? `„${note.title}" zostanie trwale usunięta.` : "Ta notatka zostanie trwale usunięta."} Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>}

      {drawingMounted && <DrawingCanvas open={showDrawing} onOpenChange={setShowDrawing} onSave={(dataUrl) => {
        imageStore.putDataUrl(dataUrl)
          .then((ref) => onUpdate?.(note.id, { images: [...(note.images || []), ref] }))
          .catch(() => toast.error("Nie udało się zapisać rysunku", { description: "Brakuje miejsca w pamięci przeglądarki." }));
      }} />}
    </>
  );
});

function ActionBtn({ icon, onClick, title, className = "", "aria-expanded": ariaExpanded }: { icon: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; title: string; className?: string; "aria-expanded"?: boolean }) {
  return (
    // Podpowiedź przez wspólny `HoverTip` (`data-tip`), nie osobny Radix Tooltip na każdy przycisk każdej karty.
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      aria-label={title}
      aria-expanded={ariaExpanded}
      data-tip={title}
      className={cn("card-action text-muted-foreground", className)}
    >
      {icon}
    </button>
  );
}
