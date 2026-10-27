import type { ComponentProps, ReactNode } from "react";
import { Star, Pin, Palette, Archive, ArchiveRestore, ImagePlus, Copy, ClipboardCopy, PenTool, Trash, Maximize2, Lock, LockOpen, FilePlusCorner, MoveHorizontal, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";
import type { Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { addSubpage } from "@/lib/subpageActions";
import { haptic } from "@/lib/haptics";
import { markPinned } from "@/lib/cardMotion";
import { repeatUpdate } from "@/lib/reminderRepeat";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { sparkle } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { ReminderPicker } from "./ReminderPicker";
import { PriorityPicker } from "./PriorityPicker";
import { LabelPicker } from "./LabelPicker";
import { FolderPicker } from "./FolderPicker";
import { AliasPicker } from "./AliasPicker";
import { PrivateNoteButton } from "./vault/PrivateNoteButton";
import { ShareNote } from "./ShareNote";
import { VersionHistory } from "./VersionHistory";
import { NoteLookPicker } from "./NoteLookPicker";

type Actions = ReturnType<typeof useNoteViewActions>;

/** Przycisk akcji na stopce kafla (ikona, bez tekstu; podpowiedź w `data-tip`). */
export function ActionBtn({ icon, onClick, title, className = "", "aria-expanded": ariaExpanded, "aria-pressed": ariaPressed }: { icon: ReactNode; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; title: string; className?: string; "aria-expanded"?: boolean; "aria-pressed"?: boolean }) {
  return (
    // Podpowiedź przez wspólny `HoverTip` (`data-tip`), nie osobny Radix Tooltip na każdy przycisk każdej karty.
    // `aria-pressed` podaje czytnikowi stan przełącznika (ulubione, szerokość, większy tekst, blokada).
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      aria-label={title}
      aria-expanded={ariaExpanded}
      aria-pressed={ariaPressed}
      data-tip={title}
      className={cn("card-action text-muted-foreground", className)}
    >
      {icon}
    </button>
  );
}

/**
 * Główne akcje kafla: przypnij, kolor, przypomnienie, priorytet, archiwum, usuń.
 * Używane w stopce (mysz) i w arkuszu „⋯” (dotyk, `inSheet`). W arkuszu kolor jest
 * osobną sekcją, więc przycisku koloru tu nie ma.
 */
export function PrimaryActions({
  note,
  isArchived,
  inSheet,
  pinSparkle,
  onClose,
  onToggleColors,
  onAskDeleteConfirm,
  onUpdate,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  note: Note;
  isArchived?: boolean;
  inSheet: boolean;
  /** Iskry przy przypięciu (już po sprawdzeniu ustawień efektów i ruchu). */
  pinSparkle?: boolean;
  /** Zamyka arkusz po akcji (tylko w arkuszu). */
  onClose?: () => void;
  onToggleColors?: () => void;
  /** Usunięcie notatki z kosza wymaga potwierdzenia — dialog trzyma `NoteCard`. */
  onAskDeleteConfirm: () => void;
} & Pick<Actions, "onUpdate" | "onTogglePin" | "onArchive" | "onUnarchive" | "onDelete">) {
  return (
    <>
      {!isArchived && (
        <ActionBtn
          icon={<Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />}
          onClick={(e) => {
            if (!note.pinned) {
              if (pinSparkle) markPinned(note.id);
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              sparkle(r.left + r.width / 2, r.top + r.height / 2);
            }
            haptic("tap");
            onTogglePin?.(note.id);
            if (inSheet) onClose?.();
          }}
          title={note.pinned ? "Odepnij" : "Przypnij"}
        />
      )}
      {!inSheet && <ActionBtn icon={<Palette className="w-4 h-4" />} onClick={() => onToggleColors?.()} title="Kolor" />}
      {!isArchived && (
        <ReminderPicker
          reminder={note.reminder}
          reminderRepeat={note.reminderRepeat}
          reminderRule={note.reminderRule}
          reminderRepeatUntil={note.reminderRepeatUntil}
          reminderAllDay={note.reminderAllDay}
          onSet={(r, repeat, until, allDay) => onUpdate?.(note.id, { reminder: r, ...repeatUpdate(repeat), reminderRepeatUntil: until, reminderAllDay: allDay })}
        />
      )}
      {!isArchived && (
        <PriorityPicker
          priority={note.priority ?? "none"}
          onSet={(p) => { const prev = note.priority; onUpdate?.(note.id, { priority: p }); if (prev !== p) toastWithUndo("Zmieniono priorytet", () => onUpdate?.(note.id, { priority: prev })); }}
        />
      )}
      {isArchived && onUnarchive ? (
        <ActionBtn icon={<ArchiveRestore className="w-4 h-4" />} onClick={() => { onUnarchive(note.id); if (inSheet) onClose?.(); }} title="Przywróć" />
      ) : onArchive ? (
        <ActionBtn icon={<Archive className="w-4 h-4" />} onClick={() => { haptic("tap"); onArchive(note.id); if (inSheet) onClose?.(); }} title="Archiwizuj" />
      ) : null}
      <ActionBtn
        icon={<Trash className="w-4 h-4" />}
        onClick={() => { if (note.trashed) onAskDeleteConfirm(); else { haptic("warn"); onDelete(note.id); } if (inSheet) onClose?.(); }}
        title="Usuń"
        className="hover:text-destructive-ink"
      />
    </>
  );
}

/**
 * Akcje rzadziej używane: ikona, okładka, ulubione, szerokość, tekst, blokada, podstrona,
 * obraz, rysunek, etykiety, folder, prywatność, udostępnianie, wersje, prezentacja, duplikat.
 * Te same w rozwinięciu „Więcej opcji” i w arkuszu.
 */
export function MoreActions({
  note,
  isArchived,
  noteVersions,
  folders,
  allLabels,
  onCreateLabel,
  onAddImage,
  onDraw,
  onUpdate,
  onMoveToFolder,
  onRestoreVersion,
  onPresent,
  onDuplicate,
  onOpenNote,
}: {
  note: Note;
  isArchived?: boolean;
  noteVersions: ComponentProps<typeof VersionHistory>["versions"] | undefined;
  folders: ComponentProps<typeof FolderPicker>["folders"] | undefined;
  allLabels: ComponentProps<typeof LabelPicker>["allLabels"];
  onCreateLabel: ComponentProps<typeof LabelPicker>["onCreateLabel"];
  onAddImage: () => void;
  onDraw: () => void;
} & Pick<Actions, "onUpdate" | "onMoveToFolder" | "onRestoreVersion" | "onPresent" | "onDuplicate" | "onOpenNote">) {
  function handleLabelToggle(label: string) {
    const labels = note.labels.includes(label) ? note.labels.filter((l) => l !== label) : [...note.labels, label];
    onUpdate?.(note.id, { labels });
  }

  return (
    <>
      <NoteLookPicker icon={note.icon} cover={note.cover} onChange={(patch) => onUpdate?.(note.id, patch)} />
      {!isArchived && (
        <ActionBtn
          icon={<Star className={cn("w-4 h-4", note.favorite && "fill-current")} />}
          onClick={() => { haptic("tap"); onUpdate?.(note.id, { favorite: note.favorite ? undefined : true }); }}
          title={note.favorite ? "Usuń z ulubionych" : "Dodaj do ulubionych"}
          aria-pressed={!!note.favorite}
          className={cn(note.favorite && "text-primary-ink")}
        />
      )}
      {!isArchived && (
        <ActionBtn
          icon={<MoveHorizontal className="w-4 h-4" />}
          onClick={() => { haptic("tap"); onUpdate?.(note.id, { wide: note.wide ? undefined : true }); }}
          title={note.wide ? "Zwiń do jednej kolumny" : "Rozciągnij na dwie kolumny"}
          aria-pressed={!!note.wide}
          className={cn(note.wide && "text-primary-ink")}
        />
      )}
      {!isArchived && (
        <ActionBtn
          icon={<ZoomIn className="w-4 h-4" />}
          onClick={() => { haptic("tap"); onUpdate?.(note.id, { largeText: note.largeText ? undefined : true }); }}
          title={note.largeText ? "Zwykły rozmiar tekstu" : "Większy tekst"}
          aria-pressed={!!note.largeText}
          className={cn(note.largeText && "text-primary-ink")}
        />
      )}
      {!isArchived && (
        <ActionBtn
          icon={note.readOnly ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
          onClick={() => { haptic("tap"); onUpdate?.(note.id, { readOnly: note.readOnly ? undefined : true }); }}
          title={note.readOnly ? "Odblokuj edycję" : "Zablokuj edycję"}
          aria-pressed={!!note.readOnly}
          className={cn(note.readOnly && "text-primary-ink")}
        />
      )}
      {!isArchived && !note.locked && (
        <ActionBtn
          icon={<FilePlusCorner className="w-4 h-4" />}
          onClick={() => {
            haptic("tap");
            const id = addSubpage(note.id);
            if (id) toast("Dodano podstronę", { action: { label: "Otwórz", onClick: () => onOpenNote?.(id) } });
          }}
          title="Dodaj podstronę"
        />
      )}
      {!note.locked && <ActionBtn icon={<ImagePlus className="w-4 h-4" />} onClick={onAddImage} title="Dodaj obrazek" />}
      {!note.locked && <ActionBtn icon={<PenTool className="w-4 h-4" />} onClick={onDraw} title="Rysuj" />}
      {!isArchived && (
        <LabelPicker allLabels={allLabels} selected={note.labels} onToggle={handleLabelToggle} onCreateLabel={onCreateLabel} />
      )}
      {!isArchived && !note.locked && (
        <AliasPicker title={note.title} aliases={note.aliases ?? []} onSave={(aliases) => onUpdate?.(note.id, { aliases })} />
      )}
      {onMoveToFolder && folders && folders.length > 0 && (
        <FolderPicker folders={folders} currentFolderId={note.folderId} onSelect={(fId) => { const prev = note.folderId; onMoveToFolder(note.id, fId); if (prev !== fId) toastWithUndo("Przeniesiono do folderu", () => onMoveToFolder(note.id, prev), { icon: "📁" }); }} />
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
      {/* Prywatnej notatki nie kopiujemy: jej treść w projekcji jest pusta (szyfrogram). */}
      {!note.locked && (
        <ActionBtn
          icon={<ClipboardCopy className="w-4 h-4" />}
          onClick={() => { haptic("tap"); void copyNoteToClipboard(note, "markdown"); }}
          title="Kopiuj jako Markdown"
        />
      )}
    </>
  );
}
