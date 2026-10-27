import { createPersistedStore } from "@/lib/persistedStore";
import { isSkin, skinStore, type Skin } from "@/lib/skins";

/**
 * Styl na noc (plan motywów 1.4): para „styl dzienny / styl nocny”. Wieczorem aplikacja sama przechodzi
 * na styl nocny, rano wraca na dzienny — według godzin albo razem z trybem ciemnym systemu. Zmiana jest
 * jawna: użytkownik sam ustawił parę (Ustawienia → Wygląd → „Styl na noc”).
 *
 * Ręczny wybór stylu, gdy harmonogram działa, nie wyłącza go, tylko zmienia styl bieżącej pory
 * (w nocy — nocny), więc harmonogram nigdy nie cofa wyboru użytkownika. Per urządzenie.
 */
export interface SkinSchedule {
  enabled: boolean;
  day: Skin;
  night: Skin;
  /** `hours` — od `from` do `to`; `system` — gdy system jest w trybie ciemnym. */
  mode: "hours" | "system";
  /** „HH:MM”. */
  from: string;
  to: string;
}

const DEFAULTS: SkinSchedule = { enabled: false, day: "zeszyt", night: "zorza", mode: "hours", from: "20:00", to: "07:00" };

const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const skinScheduleStore = createPersistedStore<SkinSchedule>("kaczy.skinSchedule.v1", DEFAULTS, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    const s = stored as Partial<SkinSchedule>;
    return {
      enabled: s.enabled === true,
      day: isSkin(s.day) ? s.day : defaults.day,
      night: isSkin(s.night) ? s.night : defaults.night,
      mode: s.mode === "system" ? "system" : "hours",
      from: isTime(s.from) ? s.from : defaults.from,
      to: isTime(s.to) ? s.to : defaults.to,
    };
  },
});

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Czy `now` wypada w nocy od `from` do `to` (także przez północ, np. 20:00–07:00). */
export function isNightHours(now: Date, from: string, to: string): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const a = minutes(from);
  const b = minutes(to);
  if (a === b) return false;
  return a < b ? t >= a && t < b : t >= a || t < b;
}

/** Czy według harmonogramu jest teraz noc. */
export function isNight(s: SkinSchedule, now: Date, systemDark: boolean): boolean {
  return s.mode === "system" ? systemDark : isNightHours(now, s.from, s.to);
}

/** Czysta decyzja: który styl powinien być teraz (`null`, gdy harmonogram wyłączony). */
export function scheduledSkin(s: SkinSchedule, now: Date, systemDark: boolean): Skin | null {
  if (!s.enabled) return null;
  return isNight(s, now, systemDark) ? s.night : s.day;
}

const mql = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
let applying = false;

/** Ustawia styl według harmonogramu, gdy różni się od bieżącego. */
export function applySkinSchedule(now = new Date()) {
  const want = scheduledSkin(skinScheduleStore.get(), now, !!mql?.matches);
  if (!want || want === skinStore.get()) return;
  applying = true;
  try { skinStore.set(want); } finally { applying = false; }
}

/** Włącza harmonogram; bieżący styl staje się dziennym albo nocnym zależnie od pory. */
export function setSkinSchedule(next: SkinSchedule) {
  skinScheduleStore.set(next);
  applySkinSchedule();
}

if (typeof window !== "undefined") {
  // Ręczny wybór stylu przy włączonym harmonogramie zmienia styl bieżącej pory, zamiast walczyć z nim.
  skinStore.subscribe(() => {
    if (applying) return;
    const s = skinScheduleStore.get();
    if (!s.enabled) return;
    const night = isNight(s, new Date(), !!mql?.matches);
    const skin = skinStore.get();
    if ((night ? s.night : s.day) !== skin) skinScheduleStore.set({ ...s, [night ? "night" : "day"]: skin });
  });
  applySkinSchedule();
  // Granice pory sprawdzane co minutę i po powrocie do karty; tryb ciemny systemu — od razu.
  window.setInterval(() => applySkinSchedule(), 60_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") applySkinSchedule(); });
  mql?.addEventListener?.("change", () => applySkinSchedule());
}
