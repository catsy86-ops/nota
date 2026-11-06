import { memo, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { NoteCard } from "@/components/NoteCard";
import { LockedNoteTile } from "@/components/vault/LockedNoteTile";
import { privateNotes, type VaultSnapshot } from "@/lib/privateNotes";
import type { Note } from "@/hooks/useNotes";

interface Props {
  note: Note;
  index: number;
  selected?: boolean;
  dragAttributes?: DraggableAttributes;
  dragListeners?: DraggableSyntheticListeners;
}

/** Stały snapshot dla zwykłych notatek — nie przerysowują się przy zmianach skarbca. */
const IDLE: VaultSnapshot = { phase: "none", corrupt: false, version: 0 };

/**
 * Jedyne miejsce, w którym jawna treść notatki prywatnej trafia do UI.
 * Zablokowany skarbiec (albo trwająca blokada) = kafel z kłódką, bez treści i
 * bez `NoteCard`, więc nie ma czego zostawić w DOM ani w stanie edytora.
 * Odblokowany = zwykły `NoteCard` z odszyfrowanym widokiem notatki.
 */
export const PrivateNoteGate = memo(function PrivateNoteGate({ note, ...rest }: Props) {
  const snap = useSyncExternalStore(privateNotes.subscribe, () => (note.locked ? privateNotes.getSnapshot() : IDLE));
  const unlocked = note.locked && snap.phase === "unlocked";

  useEffect(() => {
    if (unlocked) void privateNotes.ensureDecrypted(note);
    // `snap.version`: zmiana szyfrogramu z synchronizacji wymaga ponownego odszyfrowania.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, note.id, note.vault, snap.version]);

  const content = unlocked ? privateNotes.peek(note.id) : undefined;
  const view = useMemo(() => (content ? { ...note, ...content } : note), [note, content]);

  // 4.2: kafel, który zastąpił kartę z odszyfrowaną treścią, „zamazuje” linie zamiast wjechać od zera.
  // Liczone z tego, czy karta pokazywała treść, a nie z fazy skarbca: kafle, które nigdy nie miały treści,
  // nie dostają animacji, a krok „locking” → „locked” jej nie urywa.
  const shown = Boolean(note.locked && content);
  const [prevShown, setPrevShown] = useState(shown);
  const [sealed, setSealed] = useState(false);
  if (prevShown !== shown) {
    setPrevShown(shown);
    setSealed(prevShown && !shown);
  }

  if (note.locked && !content) return <LockedNoteTile note={note} index={rest.index} selected={rest.selected} dragAttributes={rest.dragAttributes} dragListeners={rest.dragListeners} phase={snap.phase} sealed={sealed} />;
  return <NoteCard note={view} {...rest} />;
});
