import { createPersistedStore } from "@/lib/persistedStore";
import type { PrivateNotes } from "@/lib/privateNotes";

/** Minuty bezczynności do automatycznej blokady; 0 = nigdy (do zamknięcia karty). */
export const AUTOLOCK_CHOICES = [1, 5, 15, 30, 0] as const;
export const DEFAULT_AUTOLOCK_MINUTES = 5;
/** Ukrycie karty dłużej niż tyle blokuje skarbiec. */
export const HIDDEN_LOCK_MS = 60_000;

const store = createPersistedStore<number>("kaczy.vault.autolock.v1", DEFAULT_AUTOLOCK_MINUTES, {
  merge: (def, stored) => ((AUTOLOCK_CHOICES as readonly number[]).includes(Number(stored)) ? Number(stored) : def),
});

export const setAutoLockMinutes = (m: number) => store.set(m);
export const useAutoLockMinutes = () => store.use();

const CHANNEL = "kaczy-vault";

/**
 * Pilnuje bezczynności i ukrycia karty, dopóki skarbiec jest odblokowany.
 * Czas liczymy z `Date.now()` w momencie zdarzenia, więc uśpiony komputer też blokuje.
 * Ręczne zablokowanie w jednej karcie rozsyła sygnał do pozostałych.
 */
export function startAutoLock(pn: PrivateNotes): () => void {
  let lastActivity = Date.now();
  let hiddenAt: number | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (hiddenTimer) clearTimeout(hiddenTimer);
    idleTimer = hiddenTimer = null;
  };

  function armIdle(delay?: number) {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    const minutes = store.get();
    if (!pn.isUnlocked() || minutes === 0) return;
    const limit = minutes * 60_000;
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!pn.isUnlocked()) return;
      const idle = Date.now() - lastActivity;
      if (idle >= limit) void pn.lock();
      else armIdle(limit - idle);
    }, delay ?? limit);
  }

  const onActivity = () => { lastActivity = Date.now(); };
  const events = ["pointerdown", "keydown", "wheel", "touchstart", "pointermove"] as const;
  events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));

  function onVisibility() {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
      if (hiddenTimer) clearTimeout(hiddenTimer);
      hiddenTimer = setTimeout(() => { hiddenTimer = null; if (pn.isUnlocked()) void pn.lock(); }, HIDDEN_LOCK_MS);
    } else {
      if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= HIDDEN_LOCK_MS && pn.isUnlocked()) { void pn.lock(); return; }
      lastActivity = Date.now();
      armIdle();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  const offState = pn.subscribe(() => {
    if (pn.isUnlocked()) { if (!idleTimer) { lastActivity = Date.now(); armIdle(); } } else clearTimers();
  });
  const offSetting = store.subscribe(() => armIdle());

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => { if (e.data === "lock" && pn.isUnlocked()) void pn.lock(); };
  } catch { /* brak BroadcastChannel — blokada obejmuje tylko tę kartę */ }

  if (pn.isUnlocked()) armIdle();

  return () => {
    clearTimers();
    events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
    document.removeEventListener("visibilitychange", onVisibility);
    offState();
    offSetting();
    channel?.close();
  };
}

/** Blokuje skarbiec w tej karcie i we wszystkich pozostałych. */
export async function lockEverywhere(pn: PrivateNotes): Promise<void> {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage("lock");
    ch.close();
  } catch { /* ignore */ }
  await pn.lock();
}
