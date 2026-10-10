import { useSyncExternalStore } from "react";
import { isEffectEnabled } from "./effectsSettings";
import { isMotionReduced } from "@/hooks/useMotionPref";

export interface StampData {
  id: string;
  emoji: string;
  title: string;
  /** Pierwszy raz w życiu (pierwsza notatka, pierwsza lista) - większy moment. */
  big: boolean;
  /** Unikalny klucz zdarzenia, żeby kolejna pieczątka zastąpiła poprzednią. */
  key: number;
}

/** Odznaki „pierwszy raz” - dostają większą pieczątkę. */
const FIRST_TIME_BADGES: ReadonlySet<string> = new Set(["first-note", "first-list"]);

export function isFirstTimeBadge(id: string): boolean {
  return FIRST_TIME_BADGES.has(id);
}

/** Czy pieczątka ma być pokazana (efekt włączony, ruch nie ograniczony). */
export function stampAllowed(): boolean {
  return isEffectEnabled("badgeStamp") && !isMotionReduced();
}

let current: StampData | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Zwraca false, gdy pieczątka jest wyłączona - wtedy wołający pokazuje zwykły toast. */
export function showAchievementStamp(a: { id: string; emoji: string; title: string }): boolean {
  if (!stampAllowed()) return false;
  current = { ...a, big: isFirstTimeBadge(a.id), key: ++counter };
  emit();
  return true;
}

export function dismissAchievementStamp(key?: number) {
  if (current && (key === undefined || current.key === key)) {
    current = null;
    emit();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useAchievementStamp(): StampData | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
