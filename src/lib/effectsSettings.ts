import { createPersistedStore } from "@/lib/persistedStore";

export type EffectKey =
  | "confetti"
  | "sparkle"
  | "emojiShower"
  | "fireworks"
  | "hearts"
  | "bubbles"
  | "rainbow"
  | "seasonalTheme"
  | "dailyQuote"
  | "cardTilt"
  | "badgeStamp"
  | "doneReward"
  | "themeFade"
  | "haptics";

export const EFFECT_LABELS: Record<EffectKey, { label: string; description: string; emoji: string }> = {
  confetti: { label: "Konfetti", description: "Wystrzał przy przywracaniu z kosza", emoji: "🎉" },
  sparkle: { label: "Iskierki", description: "Subtelny błysk przy przypinaniu", emoji: "✨" },
  emojiShower: { label: "Deszcz emoji", description: "Po ukończeniu całej listy zadań", emoji: "🥳" },
  fireworks: { label: "Fajerwerki", description: "Easter egg po 3 kliknięciach w logo", emoji: "🎆" },
  hearts: { label: "Serduszka", description: "Lecące serca przy ulubionych akcjach", emoji: "❤️" },
  bubbles: { label: "Bąbelki", description: "Delikatne bąbelki unoszące się w górę", emoji: "🫧" },
  rainbow: { label: "Tęcza", description: "Kolorowy łuk po większych osiągnięciach", emoji: "🌈" },
  seasonalTheme: { label: "Motyw sezonowy", description: "Akcenty dopasowane do pory roku", emoji: "🍂" },
  dailyQuote: { label: "Cytat dnia", description: "Inspiracja na górze ekranu", emoji: "💭" },
  cardTilt: { label: "Przechył kafli", description: "Kafel lekko przechyla się za kursorem", emoji: "🃏" },
  badgeStamp: { label: "Pieczątka odznaki", description: "Pieczątka z błyskiem po zdobyciu odznaki", emoji: "🏅" },
  doneReward: { label: "Dzień zamknięty", description: "Drobna nagroda, gdy zrobisz wszystkie zadania na dziś", emoji: "✅" },
  themeFade: { label: "Płynna zmiana motywu", description: "Łagodne przejście jasny/ciemny", emoji: "🌓" },
  haptics: { label: "Wibracje na telefonie", description: "Krótkie drgnięcie przy przypięciu, odhaczeniu, przeciąganiu i zapisie", emoji: "📳" },
};

export type EffectsSettings = Record<EffectKey, boolean>;

const DEFAULTS: EffectsSettings = {
  // Zostają dwa: przywrócenie z kosza i zamknięty dzień. Reszta konkuruje z treścią,
  // więc jest wyłączona domyślnie (wybór użytkownika jest zachowany).
  confetti: true,
  sparkle: false,
  emojiShower: false,
  fireworks: false,
  hearts: false,
  bubbles: false,
  rainbow: false,
  seasonalTheme: false,
  dailyQuote: false,
  // Sprężyny na każdym kaflu kosztują render, a nic nie mówią.
  cardTilt: false,
  badgeStamp: false,
  doneReward: true,
  themeFade: true,
  haptics: true,
};

/** Wartości, które przy pierwszym starcie tej wersji wyłączamy także u osób z już zapisanymi ustawieniami. */
const DEFAULTS_V2_OFF: EffectKey[] = ["sparkle", "emojiShower", "fireworks", "hearts", "bubbles", "rainbow", "seasonalTheme", "dailyQuote", "badgeStamp"];
const MIGRATION_FLAG = "kaczy.effectsSettings.defaults2";

const store = createPersistedStore<EffectsSettings>("kaczy.effectsSettings.v1", DEFAULTS, {
  merge: (defaults, stored) =>
    stored !== null && typeof stored === "object" && !Array.isArray(stored) ? { ...defaults, ...stored } : defaults,
});

// Jednorazowo: nowe domyślne wartości nie docierają do już zapisanych ustawień, więc wyłączamy je raz.
try {
  if (localStorage.getItem(MIGRATION_FLAG) !== "1") {
    const current = store.get();
    const next = { ...current };
    for (const key of DEFAULTS_V2_OFF) next[key] = false;
    store.set(next);
    localStorage.setItem(MIGRATION_FLAG, "1");
  }
} catch {
  // Bez localStorage zostają domyślne wartości z DEFAULTS.
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
