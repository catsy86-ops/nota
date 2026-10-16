import { useEffect, useRef, useState, type RefObject } from "react";
import { useDragControls, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { Note } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { haptic } from "@/lib/haptics";
import { countSwipe, showSwipeLabels } from "@/lib/swipeHint";
import { runWithoutConfirm } from "@/components/ConfirmActionDialog";
import { markPinned } from "@/lib/cardMotion";
import { toastWithUndo } from "@/lib/undoToast";

type Actions = ReturnType<typeof useNoteViewActions>;

/**
 * Gesty kafla: przesunięcie w bok na dotyku (przypnij / archiwizuj), przytrzymanie
 * (zaznaczenie) i przechył 3D przy najechaniu myszą. Wyciągnięte z `NoteCard` bez
 * zmiany zachowania; testy: `e2e/mobile.spec.ts`, `e2e/card-motion.spec.ts`,
 * `e2e/notes.spec.ts` (zaznaczanie), `e2e/board-table.spec.ts`.
 */
export function useCardGestures({
  note,
  isArchived,
  isEditing,
  selectionMode,
  cardRef,
  tilt,
  pinSparkle,
  onToggleSelect,
  onTogglePin,
  onArchive,
  onUnarchive,
}: {
  note: Note;
  isArchived: boolean | undefined;
  isEditing: boolean;
  selectionMode: boolean | undefined;
  cardRef: RefObject<HTMLDivElement | null>;
  /** Przechył włączony w ustawieniach i bez redukcji ruchu. */
  tilt: boolean;
  /** Iskry przy przypięciu gestem (po sprawdzeniu ustawień efektów i ruchu). */
  pinSparkle: boolean;
} & Pick<Actions, "onToggleSelect" | "onTogglePin" | "onArchive" | "onUnarchive">) {
  // Przesunięcie (dotyk): w prawo przypnij/odepnij, w lewo archiwizuj (w Archiwum: przywróć).
  // Kosz celowo nie ma gestu — tylko w arkuszu akcji, żeby przypadkowy ruch niczego nie usuwał.
  const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const canSwipePin = !!onTogglePin && !isArchived && !note.trashed;
  const canSwipeArchive = !note.trashed && (isArchived ? !!onUnarchive : !!onArchive);
  const swipeEnabled = isTouch && !isEditing && !selectionMode && (canSwipePin || canSwipeArchive);
  const swipeX = useMotionValue(0);
  // Gest startuje ręcznie: dotyk zaczęty na uchwycie przeciągania należy do dnd-kit
  // (zmiana kolejności / kolumny tablicy), a nie do przesunięcia, które archiwizuje albo usuwa.
  const swipeControls = useDragControls();
  const pinOpacity = useTransform(swipeX, [0, 40, 110], [0, 0.5, 1]);
  const archiveOpacity = useTransform(swipeX, [0, -40, -110], [0, 0.5, 1]);
  const [swiping, setSwiping] = useState(false);
  // Podpisy w tle tylko przy pierwszych gestach (`lib/swipeHint.ts`); czytane na starcie gestu.
  const [swipeLabels, setSwipeLabels] = useState(false);

  // Dotyk: przytrzymanie kafla zaznacza go (wejście w tryb zaznaczania), jak w aplikacjach systemowych.
  const longPressTimer = useRef<number | undefined>(undefined);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressed = useRef(false);
  function cancelLongPress() {
    window.clearTimeout(longPressTimer.current);
    longPressStart.current = null;
  }
  function handleLongPressStart(e: React.PointerEvent) {
    if (e.pointerType === "mouse" || isEditing || !onToggleSelect) return;
    const target = e.target as Element;
    // Zdarzenia z portali (arkusz akcji) płyną drzewem Reacta — tylko dotyk w samym kaflu.
    if (!cardRef.current?.contains(target) || target.closest("button, a, input, textarea, [role='checkbox'], [data-drag-handle]")) return;
    longPressStart.current = { x: e.clientX, y: e.clientY };
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      longPressStart.current = null;
      haptic("selection");
      onToggleSelect(note.id, false);
    }, 450);
  }
  function handleLongPressMove(e: React.PointerEvent) {
    const s = longPressStart.current;
    if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) cancelLongPress();
  }
  useEffect(() => () => window.clearTimeout(longPressTimer.current), []);

  function handleSwipeStart() {
    setSwipeLabels(showSwipeLabels());
    setSwiping(true);
  }

  function handleSwipeEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    setSwiping(false);
    const dx = info.offset.x;
    const fast = Math.abs(info.velocity.x) > 500;
    const threshold = fast ? 60 : 110;
    if (dx > threshold && canSwipePin) {
      haptic("tap");
      countSwipe();
      const pinning = !note.pinned;
      if (pinning && pinSparkle) markPinned(note.id);
      onTogglePin?.(note.id);
      toastWithUndo(pinning ? "Przypięto" : "Odpięto", () => onTogglePin?.(note.id), { icon: "📌" });
    } else if (dx < -threshold && canSwipeArchive) {
      haptic("tap");
      countSwipe();
      runWithoutConfirm(() => (isArchived ? onUnarchive : onArchive)?.(note.id));
    }
    swipeX.set(0);
  }

  // Subtle 3D hover tilt — opt-in (effectsSettings.cardTilt), never with reduced motion.
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const rotX = useSpring(useTransform(mvY, [-0.5, 0.5], [4, -4]), { stiffness: 220, damping: 18 });
  const rotY = useSpring(useTransform(mvX, [-0.5, 0.5], [-4, 4]), { stiffness: 220, damping: 18 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (isEditing || !tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mvX.set((e.clientX - r.left) / r.width - 0.5);
    mvY.set((e.clientY - r.top) / r.height - 0.5);
  }
  function handleLeave() { mvX.set(0); mvY.set(0); }

  return {
    isTouch,
    canSwipePin,
    canSwipeArchive,
    swipeEnabled,
    swipeX,
    swipeControls,
    swiping,
    swipeLabels,
    pinOpacity,
    archiveOpacity,
    handleSwipeStart,
    handleSwipeEnd,
    handleLongPressStart,
    handleLongPressMove,
    cancelLongPress,
    longPressed,
    rotX,
    rotY,
    handleMove,
    handleLeave,
  };
}
