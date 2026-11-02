import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Skarbiec 2.4: okresowe sprawdzenie kodu awaryjnego. Pamięta na tym urządzeniu, kiedy kod ostatnio
 * sprawdzono i kiedy ostatnio przypomniano — bez samego kodu i bez niczego z dokumentu. Po odblokowaniu,
 * gdy od obu dat minęło 90 dni, okno skarbca pyta „Masz zapisany kod awaryjny?”. Przypomnienie można wyłączyć.
 */

export const RECOVERY_CHECK_KEY = "kaczy.vault.recoveryCheck.v1";
export const RECOVERY_CHECK_EVERY_MS = 90 * 24 * 60 * 60 * 1000;

export interface RecoveryCheckState {
  /** Ostatnie udane sprawdzenie kodu (ms). */
  checkedAt?: number;
  /** Ostatnie przypomnienie (ms) — żeby nie pytać przy każdym odblokowaniu. */
  nudgedAt?: number;
  /** Przypomnienie wyłączone w Ustawieniach. */
  off?: boolean;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

const store = createPersistedStore<RecoveryCheckState>(RECOVERY_CHECK_KEY, {}, {
  merge: (_defaults, stored) => {
    const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
    return { checkedAt: num(s.checkedAt), nudgedAt: num(s.nudgedAt), ...(s.off === true ? { off: true } : {}) };
  },
});

export const useRecoveryCheck = () => store.use();
export const getRecoveryCheck = () => store.get();

/** Czy pora przypomnieć: nie wyłączone i od ostatniego sprawdzenia albo przypomnienia minęło 90 dni. */
export function recoveryCheckDue(state: RecoveryCheckState, now: number): boolean {
  if (state.off) return false;
  const last = Math.max(state.checkedAt ?? 0, state.nudgedAt ?? 0);
  return now - last >= RECOVERY_CHECK_EVERY_MS;
}

export const markRecoveryChecked = (now: number = Date.now()) => store.set({ ...store.get(), checkedAt: now });
export const markRecoveryNudged = (now: number = Date.now()) => store.set({ ...store.get(), nudgedAt: now });
export const setRecoveryNudgeOff = (off: boolean) => {
  const { off: _o, ...rest } = store.get();
  store.set(off ? { ...rest, off: true } : rest);
};
