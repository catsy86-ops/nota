import { useSyncExternalStore } from "react";

export type EffectKey =
  | "confetti"
  | "sparkle"
  | "emojiShower"
  | "fireworks"
  | "hearts"
  | "bubbles"
  | "rainbow"
  | "snow"
  | "seasonalTheme"
  | "dailyQuote";

export const EFFECT_LABELS: Record<EffectKey, { label: string; description: string; emoji: string }> = {
  confetti: { label: "Konfetti", description: "Wystrzał przy przywracaniu z kosza", emoji: "🎉" },
  sparkle: { label: "Iskierki", description: "Subtelny błysk przy przypinaniu", emoji: "✨" },
  emojiShower: { label: "Deszcz emoji", description: "Po ukończeniu całej listy zadań", emoji: "🥳" },
  fireworks: { label: "Fajerwerki", description: "Easter egg po 3 kliknięciach w logo", emoji: "🎆" },
  hearts: { label: "Serduszka", description: "Lecące serca przy ulubionych akcjach", emoji: "❤️" },
  bubbles: { label: "Bąbelki", description: "Delikatne bąbelki unoszące się w górę", emoji: "🫧" },
  rainbow: { label: "Tęcza", description: "Kolorowy łuk po większych osiągnięciach", emoji: "🌈" },
  snow: { label: "Śnieg / liście", description: "Akcent sezonowy w tle aplikacji", emoji: "❄️" },
  seasonalTheme: { label: "Motyw sezonowy", description: "Akcenty dopasowane do pory roku", emoji: "🍂" },
  dailyQuote: { label: "Cytat dnia", description: "Inspiracja na górze ekranu", emoji: "💭" },
};

const STORAGE_KEY = "kaczy.effectsSettings.v1";

export type EffectsSettings = Record<EffectKey, boolean>;

const DEFAULTS: EffectsSettings = {
  confetti: true,
  sparkle: true,
  emojiShower: true,
  fireworks: true,
  hearts: true,
  bubbles: true,
  rainbow: true,
  snow: true,
  seasonalTheme: true,
  dailyQuote: true,
};

function read(): EffectsSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

let current: EffectsSettings = read();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getEffectsSettings(): EffectsSettings {
  return current;
}

export function isEffectEnabled(key: EffectKey): boolean {
  return current[key] !== false;
}

export function setEffectEnabled(key: EffectKey, enabled: boolean) {
  current = { ...current, [key]: enabled };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore quota */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEffectsSettings(): EffectsSettings {
  return useSyncExternalStore(subscribe, getEffectsSettings, getEffectsSettings);
}
