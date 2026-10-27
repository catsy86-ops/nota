import { useEffect } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { dismissAchievementStamp, useAchievementStamp } from "@/lib/achievementStamp";
import { celebrate, sparkle } from "@/lib/celebrate";

const SHOW_MS = 2400;
const SHOW_BIG_MS = 3400;

/**
 * „Pieczątka” odznaki: odbija się na ekranie jak stempel w zeszycie, z krótkim
 * błyskiem. Pokazywana tylko za zasłużoną akcję (zdobyta odznaka), znika sama.
 * Reduced motion / wyłączony efekt: komponent nic nie renderuje (wołający
 * dostaje wtedy zwykły toast).
 */
export function AchievementStamp() {
  const stamp = useAchievementStamp();

  useEffect(() => {
    if (!stamp) return;
    const key = stamp.key;
    // Pieczątka „ląduje” po ~0.25 s - wtedy błysk.
    const flash = window.setTimeout(() => {
      const x = window.innerWidth / 2;
      const y = window.innerHeight * 0.32;
      if (stamp.big) celebrate(x, y);
      else sparkle(x, y);
    }, 250);
    const hide = window.setTimeout(() => dismissAchievementStamp(key), stamp.big ? SHOW_BIG_MS : SHOW_MS);
    return () => {
      window.clearTimeout(flash);
      window.clearTimeout(hide);
    };
  }, [stamp]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[22%] z-toast flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {stamp && (
          <motion.div
            key={stamp.key}
            data-testid="achievement-stamp"
            role="status"
            initial={{ opacity: 0, scale: 2.4, rotate: -14 }}
            animate={{ opacity: 1, scale: stamp.big ? 1.15 : 1, rotate: -4 }}
            exit={{ opacity: 0, scale: 0.92, y: -12, transition: { duration: 0.3 } }}
            transition={{ type: "spring", stiffness: 420, damping: 22, mass: 0.8 }}
            className="relative flex flex-col items-center gap-1 rounded-xl border-[3px] border-double border-primary/80 bg-card/95 px-6 py-4 text-center shadow-lg backdrop-blur-xs"
          >
            <span className="text-2xs font-semibold uppercase tracking-[0.25em] text-primary-ink">
              {stamp.big ? "Pierwszy raz!" : "Nowa odznaka"}
            </span>
            <span className={stamp.big ? "text-5xl leading-none" : "text-4xl leading-none"} aria-hidden="true">{stamp.emoji}</span>
            <span className="font-display text-lg font-bold text-foreground">{stamp.title}</span>
            {/* Błysk: pierścień rozchodzący się od krawędzi pieczątki. */}
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl border-2 border-primary"
              initial={{ opacity: 0.8, scale: 1 }}
              animate={{ opacity: 0, scale: 1.35 }}
              transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
