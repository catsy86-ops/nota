import { createPersistedStore } from "@/lib/persistedStore";

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

const store = createPersistedStore<EffectsSettings>("kaczy.effectsSettings.v1", DEFAULTS, {
  merge: (defaults, stored) => ({ ...defaults, ...stored }),
});

export function getEffectsSettings(): EffectsSettings {
  return store.get();
}

export function isEffectEnabled(key: EffectKey): boolean {
  return store.get()[key] !== false;
}

export function setEffectEnabled(key: EffectKey, enabled: boolean) {
  store.set({ ...store.get(), [key]: enabled });
}

export function useEffectsSettings(): EffectsSettings {
  return store.use();
}
