import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Note } from "@/hooks/useNotes";
import { useMotionPref } from "@/hooks/useMotionPref";
import { useEffectsSettings } from "@/lib/effectsSettings";
import { cardExit, hasRecentPin, consumePin, type CardExitIntent } from "@/lib/cardMotion";

/**
 * Efekty ruchu kafla: przechył 3D, wyjście (kosz/archiwum), iskra „klik pinezki” po przypięciu
 * i pieczątka „gotowe” po odhaczeniu ostatniego zadania. Wyciągnięte z `NoteCard` bez zmiany
 * zachowania; testy: `e2e/card-motion.spec.ts`, `e2e/checklist.spec.ts`.
 */
export function useCardMotion({ note, isEditing }: { note: Note; isEditing: boolean }) {
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

  return { reduce, fx, tilt, showFx, cardVariants, pinFx, setPinFx, stampKey, setStampKey };
}
