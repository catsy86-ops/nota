import { memo } from "react";
import { m as motion } from "framer-motion";
import { Archive, ArchiveRestore, Check, Download, KeyRound, Lock, Pin, RotateCcw, Trash } from "lucide-react";
import { downloadBlob } from "@/lib/downloadBlob";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { colorClasses } from "@/components/ColorPicker";
import { ReminderBadge } from "@/components/ReminderPicker";
import { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { privateNotes, type VaultPhase } from "@/lib/privateNotes";
import { vaultUi } from "@/lib/vaultUi";
import { cascadeDelay } from "@/lib/cardMotion";
import { tween } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Note } from "@/hooks/useNotes";
import { toast } from "sonner";

interface Props {
  note: Note;
  index: number;
  selected?: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
  phase: VaultPhase;
  /** Kafel powstał z blokady otwartej karty (4.2): bez wejścia z dołu, linie się „zamazują”. */
  sealed?: boolean;
}

/**
 * Kafel zablokowanej notatki. Nie dostaje żadnej treści — `note` jest już
 * zredagowana w projekcji — a „rozmyte linie” to stałe kreski, niezależne od
 * rzeczywistej długości tekstu (długość też jest informacją).
 */
export const LockedNoteTile = memo(function LockedNoteTile({ note, index, selected, dragAttributes, dragListeners, phase, sealed }: Props) {
  const { onDelete, onTogglePin, onArchive, onUnarchive, isArchived, selectionMode, onToggleSelect } = useNoteViewActions();
  const undecryptable = phase === "unlocked" && privateNotes.isUndecryptable(note.id);
  const noVault = phase === "none";
  // Bez szyfrogramu nie ma czego odszyfrować — „Odszyfrowuję…” wisiałoby bez końca.
  const decrypting = phase === "unlocked" && !undecryptable && Boolean(note.vault);
  const busy = phase === "locking" || decrypting;

  function unlock() {
    if (noVault) {
      toast.info("Brak skarbca na tym urządzeniu", { description: "Zsynchronizuj urządzenia albo przywróć pełny backup — wtedy pojawi się okno odblokowania." });
      return;
    }
    if (phase === "unlocked") return;
    vaultUi.open("unlock");
  }

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  return (
    <motion.div
      layout
      initial={sealed ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ default: { ...tween.enter, delay: cascadeDelay(index, false) } }}
      data-note-id={note.id}
      data-note-color={note.color}
      data-private-tile=""
      className={cn(
        "group note-card relative rounded-card border note-shadow overflow-hidden",
        colorClasses[note.color],
        // 4.1: nieodszyfrowywalna ma obwódkę błędu; bez skarbca na urządzeniu kafel jest wyszarzony.
        selected ? "note-glow-active border-transparent" : undecryptable ? "border-destructive/60" : "border-border/50",
        noVault && "border-dashed",
      )}
    >
      {(selectionMode || selected) && onToggleSelect && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id, e.shiftKey); }}
          className={cn(
            "absolute top-2 right-2 z-sticky w-6 h-6 rounded-control border-2 flex items-center justify-center transition-colors",
            selected ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 border-border hover:border-primary",
          )}
          aria-label={selected ? "Odznacz notatkę" : "Zaznacz notatkę"}
        >
          {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </button>
      )}

      {dragListeners && (
        <div
          {...dragAttributes}
          {...dragListeners}
          aria-label="Przeciągnij, aby zmienić kolejność"
          className="absolute top-0 left-1/2 -translate-x-1/2 z-raised px-3 pt-0.5 cursor-grab active:cursor-grabbing rounded-b-md opacity-0 group-hover:opacity-60 hover:opacity-100! focus-visible:opacity-100 transition-opacity"
        >
          <div className="grid grid-cols-3 gap-[2px]" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />)}
          </div>
        </div>
      )}

      <div
        className={cn("cursor-pointer card-body px-3 pt-3 pb-2", noVault && "grayscale")}
        role="button"
        tabIndex={0}
        aria-label={noVault ? "Notatka prywatna — brak skarbca na tym urządzeniu" : "Notatka prywatna — odblokuj, aby zobaczyć"}
        onClick={() => { if (!selectionMode) unlock(); else onToggleSelect?.(note.id, false); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); unlock(); } }}
      >
        <div className="flex items-center gap-2 text-foreground">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-foreground/[0.07]" aria-hidden>
            <Lock className="w-3.5 h-3.5" />
          </span>
          <h3 className="font-display font-semibold text-[0.9375rem] leading-tight">Notatka prywatna</h3>
        </div>

        {/* Stałe kreski jak linie zeszytu — nie odzwierciedlają treści. */}
        <div className={cn("mt-3 space-y-1.5", sealed && "vault-seal", decrypting && "vault-decrypting")} aria-hidden>
          <div className="h-2 rounded-full bg-foreground/10 w-[88%]" />
          <div className="h-2 rounded-full bg-foreground/10 w-[64%]" />
          <div className="h-2 rounded-full bg-foreground/10 w-[40%]" />
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {undecryptable ? (
            <>
              <span className="text-2xs text-destructive-ink">Tego szyfrogramu nie da się odszyfrować tym hasłem.</span>
              <button
                type="button"
                onClick={stop(() => downloadCiphertext(note.id))}
                className="pressable inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-foreground/10 coarse:min-h-11"
              >
                <Download className="w-3 h-3" aria-hidden />Pobierz szyfrogram
              </button>
            </>
          ) : noVault ? (
            <span className="text-2xs text-muted-foreground">Skarbiec nie jest ustawiony na tym urządzeniu.</span>
          ) : (
            <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium", busy ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary-ink")}>
              <KeyRound className="w-3 h-3" />
              {phase === "locking" ? "Blokuję…" : busy ? "Odszyfrowuję…" : "Odblokuj"}
            </span>
          )}
          <ReminderBadgeSafe note={note} />
        </div>

        <div className="card-meta flex items-center gap-1.5 mt-2 text-2xs text-muted-foreground whitespace-nowrap">
          <span>{format(new Date(note.updatedAt), "d MMM", { locale: pl })}</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-2 pb-2 flex-wrap">
        {!isArchived && onTogglePin && (
          <TileBtn title={note.pinned ? "Odepnij" : "Przypnij"} onClick={stop(() => onTogglePin(note.id))}>
            <Pin className={cn("w-4 h-4", note.pinned && "fill-current")} />
          </TileBtn>
        )}
        {isArchived && onUnarchive ? (
          <TileBtn title="Przywróć" onClick={stop(() => onUnarchive(note.id))}>
            {note.trashed ? <RotateCcw className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
          </TileBtn>
        ) : onArchive ? (
          <TileBtn title="Archiwizuj" onClick={stop(() => onArchive(note.id))}><Archive className="w-4 h-4" /></TileBtn>
        ) : null}
        <TileBtn title="Usuń" className="hover:text-destructive-ink" onClick={stop(() => onDelete(note.id))}>
          <Trash className="w-4 h-4" />
        </TileBtn>
      </div>
    </motion.div>
  );
});

/**
 * Skarbiec 1.2: plik z szyfrogramem notatki, której nie da się odszyfrować — do ręcznego odzysku (np. po
 * przywróceniu dawnego skarbca). Zawiera tylko szyfrogram i id (id jest częścią danych uwierzytelniających).
 * Id przychodzi od peera — w nazwie pliku tylko `[A-Za-z0-9-]` (przegląd `security-reviewer` 2026-11-02).
 */
function downloadCiphertext(id: string) {
  const vault = privateNotes.undecryptableToken(id);
  if (!vault) { toast.error("Tej notatki nie ma już w dokumencie"); return; }
  const file = JSON.stringify({ format: "notki-vault-note", version: 1, id, vault, exportedAt: new Date().toISOString() }, null, 2);
  downloadBlob(new Blob([file], { type: "application/json" }), `notki-szyfrogram-${id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 8) || "notatka"}.notki-vault`);
  toast.success("Zapisano szyfrogram", { description: "Plik nie zawiera hasła ani treści — tylko zaszyfrowane dane." });
}

/** Termin przypomnienia zostaje jawny (decyzja projektowa), tekstu nie ma. */
function ReminderBadgeSafe({ note }: { note: Note }) {
  return <ReminderBadge reminder={note.reminder} reminderRepeat={note.reminderRepeat} reminderAllDay={note.reminderAllDay} />;
}

function TileBtn({ title, onClick, className, children }: { title: string; onClick: (e: React.MouseEvent) => void; className?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={title} data-tip={title} className={cn("card-action text-muted-foreground", className)}>
      {children}
    </button>
  );
}
