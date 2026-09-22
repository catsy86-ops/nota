import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Pin, Trash2, Palette, Archive, ArchiveRestore, ImagePlus, X, Copy, Type, PenTool, ListChecks, Eye, EyeOff, RotateCcw, MoreHorizontal } from "lucide-react";
import { ColorPicker, colorClasses } from "./ColorPicker";
import { LabelPicker, LabelBadges } from "./LabelPicker";
import { ReminderPicker, ReminderBadge } from "./ReminderPicker";
import { ChecklistPreview } from "./ChecklistEditor";
import { ChecklistEditor } from "./ChecklistEditor";
import { MarkdownRenderer, FormatToolbar } from "./MarkdownRenderer";
import { ShareNote } from "./ShareNote";
import { FolderPicker } from "./FolderPicker";
import { VersionHistory } from "./VersionHistory";
import type { Note, NoteColor, ChecklistItem, Folder } from "@/hooks/useNotes";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { fileToBase64 } from "@/hooks/useNotes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DrawingCanvas } from "./DrawingCanvas";
import { useTrashCountdown } from "@/hooks/useTrashCountdown";
import { celebrate, sparkle } from "@/lib/celebrate";
import { useViewPrefs, readingTimeMin } from "@/lib/viewPrefs";

interface NoteCardProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onMoveToFolder?: (noteId: string, folderId: string | null) => void;
  folders?: Folder[];
  allLabels: string[];
  onCreateLabel: (label: string) => void;
  index: number;
  isArchived?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
  noteVersions?: NoteVersion[];
  onSaveVersion?: (noteId: string, title: string, content: string) => void;
  onRestoreVersion?: (noteId: string, version: NoteVersion) => void;
  onPresent?: (id: string) => void;
  knownTitles?: Set<string>;
  onWikiClick?: (title: string) => void;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
}

export function NoteCard({ note, onUpdate, onDelete, onTogglePin, onArchive, onUnarchive, onDuplicate, onMoveToFolder, folders, allLabels, onCreateLabel, index, isArchived, dragAttributes, dragListeners, noteVersions, onSaveVersion, onRestoreVersion, onPresent, knownTitles, onWikiClick, selected, selectionMode, onToggleSelect }: NoteCardProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const wordCount = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
  const trashCountdown = useTrashCountdown(note.trashed ? note.trashedAt : null, cardRef);
  const prefs = useViewPrefs();
  const readMin = readingTimeMin(note.content);

  function handleSave() {
    // Save version before updating
    if (onSaveVersion && (note.title !== editTitle.trim() || note.content !== editContent.trim())) {
      onSaveVersion(note.id, note.title, note.content);
    }
    onUpdate(note.id, { title: editTitle.trim(), content: editContent.trim(), checklist: editChecklist });
    setIsEditing(false);
    setShowPreview(false);
  }

  function handleLabelToggle(label: string) {
    const labels = note.labels.includes(label) ? note.labels.filter((l) => l !== label) : [...note.labels, label];
    onUpdate(note.id, { labels });
  }

  function handleChecklistToggle(itemId: string) {
    const updated = (note.checklist || []).map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
    onUpdate(note.id, { checklist: updated });
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
    const newImages: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 2 * 1024 * 1024) continue;
      const base64 = await fileToBase64(file);
      newImages.push(base64);
    }
    onUpdate(note.id, { images: [...(note.images || []), ...newImages] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(idx: number) {
    const updated = [...(note.images || [])];
    updated.splice(idx, 1);
    onUpdate(note.id, { images: updated });
  }

  // Subtle 3D hover tilt — disabled when user prefers reduced motion.
  const reduce = useReducedMotion();
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

  function handleSwipeEnd(_: any, info: { offset: { x: number }; velocity: { x: number } }) {
    setSwiping(false);
    const dx = info.offset.x;
    const fast = Math.abs(info.velocity.x) > 500;
    const threshold = fast ? 60 : 110;
    if (dx > threshold && canSwipeArchive) {
      onArchive?.(note.id);
    } else if (dx < -threshold && canSwipeTrash) {
      onDelete(note.id);
    }
    swipeX.set(0);
  }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isEditing || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    mvX.set((e.clientX - r.left) / r.width - 0.5);
    mvY.set((e.clientY - r.top) / r.height - 0.5);
  }
  function handleLeave() { mvX.set(0); mvY.set(0); }

  return (
    <>
      <div className="[perspective:1000px] relative">
      {swipeEnabled && (
        <>
          <motion.div style={{ opacity: archiveOpacity }} className="absolute inset-y-0 left-0 w-1/2 rounded-2xl bg-primary/15 flex items-center justify-start pl-5 pointer-events-none">
            <Archive className="w-6 h-6 text-primary" />
          </motion.div>
          <motion.div style={{ opacity: trashOpacity }} className="absolute inset-y-0 right-0 w-1/2 rounded-2xl bg-destructive/15 flex items-center justify-end pr-5 pointer-events-none">
            <Trash2 className="w-6 h-6 text-destructive" />
          </motion.div>
        </>
      )}

      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ duration: 0.3, delay: reduce ? 0 : index * 0.04 }}
        whileHover={reduce ? undefined : { y: -4, transition: { duration: 0.2 } }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        drag={swipeEnabled ? "x" : false}
        dragDirectionLock
        dragElastic={0.25}
        dragConstraints={{ left: canSwipeTrash ? -160 : 0, right: canSwipeArchive ? 160 : 0 }}
        dragSnapToOrigin
        onDragStart={() => setSwiping(true)}
        onDragEnd={handleSwipeEnd}
        style={{
          ...(reduce ? {} : { rotateX: rotX, rotateY: rotY }),
          ...(swipeEnabled ? { x: swipeX } : {}),
          transformStyle: "preserve-3d",
        }}

        data-note-id={note.id}
        className={cn(
          "group relative rounded-2xl border note-shadow hover:note-shadow-hover transition-all duration-300 card-shine overflow-hidden",
          colorClasses[note.color],
          selected ? "note-glow-active border-transparent" : "border-border/50"
        )}
      >
        {/* Selection checkbox */}
        {(selectionMode || selected) && onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id, e.shiftKey); }}
            className={cn(
              "absolute top-2 right-2 z-20 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all",
              selected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border hover:border-primary"
            )}
            aria-label={selected ? "Odznacz notatkę" : "Zaznacz notatkę"}
          >
            {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </button>
        )}

        {/* Pin indicator */}
        {note.pinned && !(selectionMode || selected) && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 right-3 z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.4)]" />
          </motion.div>
        )}

        {/* Drag handle */}
        {dragListeners && (
          <div {...dragAttributes} {...dragListeners} className="absolute top-2 left-2 z-10 cursor-grab active:cursor-grabbing p-1 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity">
            <div className="flex flex-col gap-0.5">
              <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-muted-foreground"/><div className="w-1 h-1 rounded-full bg-muted-foreground"/></div>
              <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-muted-foreground"/><div className="w-1 h-1 rounded-full bg-muted-foreground"/></div>
              <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-muted-foreground"/><div className="w-1 h-1 rounded-full bg-muted-foreground"/></div>
            </div>
          </div>
        )}

        {/* Images */}
        {note.images && note.images.length > 0 && (
          <div className={cn("grid gap-0.5", note.images.length === 1 ? "" : "grid-cols-2")}>
            {note.images.slice(0, 4).map((img, i) => (
              <div key={i} className="relative group/img cursor-pointer overflow-hidden" onClick={() => setPreviewImage(img)}>
                <img src={img} alt="" className="w-full h-32 object-cover transition-transform duration-300 group-hover/img:scale-105" loading="lazy" />
                {note.images.length > 4 && i === 3 && (
                  <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                    <span className="text-primary-foreground font-display font-bold text-lg">+{note.images.length - 4}</span>
                  </div>
                )}
                {isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-foreground/60 text-background opacity-0 group-hover/img:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="p-4 cursor-pointer"
          onClick={(e) => {
            if (swiping || Math.abs(swipeX.get()) > 4) return;
            if (selectionMode && onToggleSelect) { onToggleSelect(note.id, e.shiftKey); return; }

            if (!isEditing) { setIsEditing(true); setEditTitle(note.title); setEditContent(note.content); setEditChecklist(note.checklist || []); setShowChecklist((note.checklist || []).length > 0); }
          }}
        >
          {isEditing ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <input spellCheck={prefs.spellcheck} autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full bg-transparent font-display font-semibold text-foreground outline-none" placeholder="Tytuł" />
              <div className="flex items-center gap-1">
                <FormatToolbar onInsert={handleFormatInsert} />
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={cn("p-1 rounded text-[10px] transition-colors ml-auto", showPreview ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                  title={showPreview ? "Ukryj podgląd" : "Podgląd Markdown"}
                >
                  {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              
              {showPreview ? (
                <div className="grid grid-cols-2 gap-2">
                  <textarea spellCheck={prefs.spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-transparent text-sm text-foreground/80 outline-none resize-none min-h-[80px] border border-border/30 rounded-lg p-2" placeholder="Treść (obsługuje **Markdown**)..." />
                  <div className="bg-muted/20 rounded-lg p-2 min-h-[80px] overflow-y-auto border border-border/30">
                    {editContent ? <MarkdownRenderer content={editContent} knownTitles={knownTitles} onWikiClick={onWikiClick} /> : <p className="text-xs text-muted-foreground italic">Podgląd...</p>}
                  </div>
                </div>
              ) : (
                <textarea spellCheck={prefs.spellcheck} ref={textareaRef} value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full bg-transparent text-sm text-foreground/80 outline-none resize-none min-h-[60px]" placeholder="Treść (obsługuje **Markdown**)..." />
              )}
              
              {/* Checklist toggle */}
              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className={cn("flex items-center gap-1.5 text-xs transition-colors", showChecklist ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <ListChecks className="w-3.5 h-3.5" />
                {showChecklist ? "Lista zadań" : "Dodaj listę"}
              </button>
              
              {showChecklist && (
                <ChecklistEditor items={editChecklist} onChange={setEditChecklist} />
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Type className="w-3 h-3" />
                  {editContent.trim().split(/\s+/).filter(Boolean).length} słów · {editContent.length} znaków
                </span>
                <button onClick={handleSave} className="text-sm font-medium text-primary hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors">Zapisz</button>
              </div>
            </div>
          ) : (
            <>
              {note.title && <h3 className="font-display font-semibold text-foreground mb-1.5 line-clamp-2">{note.title}</h3>}
              {note.content && (
                <div className="line-clamp-6">
                  <MarkdownRenderer content={note.content} knownTitles={knownTitles} onWikiClick={(t)=>{onWikiClick?.(t);}} />
                </div>
              )}
              {(note.checklist || []).length > 0 && (
                <ChecklistPreview items={note.checklist} onToggle={handleChecklistToggle} />
              )}
              <LabelBadges labels={note.labels} />
              <ReminderBadge reminder={note.reminder} />
              {trashCountdown && (
                <div className="inline-flex items-center gap-1 mt-2">
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                    trashCountdown.urgent ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
                  )}>
                    <Trash2 className="w-3 h-3" />
                    {trashCountdown.label}
                  </div>
                  {onUnarchive && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        celebrate(r.left + r.width / 2, r.top + r.height / 2);
                        onUnarchive(note.id);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title="Przywróć notatkę"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Przywróć
                    </motion.button>
                  )}
                </div>
              )}
              {(wordCount > 0 || note.createdAt) && (
                <div className="flex items-center gap-2 mt-2.5 text-[10px] text-muted-foreground/60">
                  {wordCount > 0 && <span>{wordCount} słów</span>}
                  {wordCount > 0 && prefs.showReadingTime && <span>·</span>}
                  {prefs.showReadingTime && wordCount > 0 && <span>~{readMin} min</span>}
                  <span>·</span>
                  <span>{format(new Date(note.updatedAt), "d MMM", { locale: pl })}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions — 4 główne, reszta pod „więcej” */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-0.5 px-3 pb-3 flex-wrap md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200"
        >
          {!isArchived && (
            <ActionBtn
              icon={<Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />}
              onClick={(e) => {
                if (!note.pinned) {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  sparkle(r.left + r.width / 2, r.top + r.height / 2);
                }
                onTogglePin(note.id);
              }}
              title={note.pinned ? "Odepnij" : "Przypnij"}
            />
          )}
          <ActionBtn icon={<Palette className="w-4 h-4" />} onClick={() => setShowColors(!showColors)} title="Kolor" />
          {isArchived && onUnarchive ? (
            <ActionBtn icon={<ArchiveRestore className="w-4 h-4" />} onClick={() => onUnarchive(note.id)} title="Przywróć" />
          ) : onArchive ? (
            <ActionBtn icon={<Archive className="w-4 h-4" />} onClick={() => onArchive(note.id)} title="Archiwizuj" />
          ) : null}
          <ActionBtn icon={<Trash2 className="w-4 h-4" />} onClick={() => setShowDeleteConfirm(true)} title="Usuń" className="hover:text-destructive" />

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />

          <ActionBtn
            icon={<MoreHorizontal className="w-4 h-4" />}
            onClick={() => setShowMore((v) => !v)}
            title={showMore ? "Mniej opcji" : "Więcej opcji"}
            className={cn("ml-auto", showMore && "text-primary bg-primary/10")}
          />
        </motion.div>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-3 pb-3 overflow-hidden"
            >
              <div className="flex items-center gap-0.5 flex-wrap border-t border-border/40 pt-2">
                <ActionBtn icon={<ImagePlus className="w-4 h-4" />} onClick={() => fileInputRef.current?.click()} title="Dodaj obrazek" />
                <ActionBtn icon={<PenTool className="w-4 h-4" />} onClick={() => setShowDrawing(true)} title="Rysuj" />
                {!isArchived && (
                  <>
                    <LabelPicker allLabels={allLabels} selected={note.labels} onToggle={handleLabelToggle} onCreateLabel={onCreateLabel} />
                    <ReminderPicker reminder={note.reminder} onSet={(r) => onUpdate(note.id, { reminder: r })} />
                  </>
                )}
                {onMoveToFolder && folders && folders.length > 0 && (
                  <FolderPicker folders={folders} currentFolderId={note.folderId} onSelect={(fId) => onMoveToFolder(note.id, fId)} />
                )}
                <ShareNote note={note} />
                {noteVersions && onRestoreVersion && (
                  <VersionHistory versions={noteVersions} onRestore={(v) => onRestoreVersion(note.id, v)} />
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
            <ColorPicker selected={note.color} onSelect={(c: NoteColor) => { onUpdate(note.id, { color: c }); setShowColors(false); }} />
          </motion.div>
        )}
      </motion.div>
      </div>

      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2 bg-transparent border-none shadow-none">
          {previewImage && <img src={previewImage} alt="" className="w-full rounded-2xl shadow-2xl" />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
      </AlertDialog>

      <DrawingCanvas open={showDrawing} onOpenChange={setShowDrawing} onSave={(dataUrl) => onUpdate(note.id, { images: [...(note.images || []), dataUrl] })} />
    </>
  );
}

function ActionBtn({ icon, onClick, title, className = "" }: { icon: React.ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; title: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); onClick(e); }}
          className={cn("p-1.5 rounded-full text-muted-foreground hover:bg-foreground/5 transition-colors", className)}
        >
          {icon}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );
}
