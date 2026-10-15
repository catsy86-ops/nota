import type { Skin } from "@/lib/skins";

// Opisy i miniatury stylów — tylko dla galerii w Ustawieniach (leniwa paczka), żeby nie
// obciążać wejściowego JS. Schemat i kolor paska stanu są w `skins.ts`.
export interface SkinMeta {
  label: string;
  /** Jedno zdanie w galerii: skąd ten wygląd. */
  blurb: string;
  /** Kolory miniatury w galerii (bez wczytywania tokenów). */
  preview: { bg: string; card: string; ink: string; accent: string; muted: string };
  /** Krój nagłówków — miniatura pokazuje „Aa” tym krojem. */
  font: string;
}

export const SKIN_META: Record<Skin, SkinMeta> = {
  zeszyt: {
    label: "Zeszyt",
    blurb: "Kratka, bursztyn i niebieski długopis.",
    preview: { bg: "#fbfaf4", card: "#ffffff", ink: "#1c2230", accent: "#e08a10", muted: "#dfe6f0" },
    font: "'Plus Jakarta Sans Variable', sans-serif",
  },
  plan: {
    label: "Plan",
    blurb: "Rysunek techniczny: biała linia na granacie.",
    preview: { bg: "#10304f", card: "#163a5f", ink: "#eaf4fc", accent: "#6cd3fb", muted: "#5b84ab" },
    font: "'Barlow Condensed', sans-serif",
  },
  neon: {
    label: "Neon",
    blurb: "Po fajrancie: róż i błękit szklanych rurek.",
    preview: { bg: "#130a1b", card: "#1f1229", ink: "#f8ecff", accent: "#ff47d1", muted: "#3ef0ff" },
    font: "'Unbounded Variable', sans-serif",
  },
  zorza: {
    label: "Zorza",
    blurb: "Nocne niebo, gwiazdy i falująca zorza.",
    preview: { bg: "#060a17", card: "#111a2e", ink: "#eef4fb", accent: "#3cf5a6", muted: "#9b7bff" },
    font: "'Fraunces Variable', serif",
  },
  miedz: {
    label: "Miedź",
    blurb: "Beton z szalunku i miedziane rury.",
    preview: { bg: "#e6e3df", card: "#fcfbf9", ink: "#24201d", accent: "#ae5a28", muted: "#2f7a83" },
    font: "'Bricolage Grotesque Variable', sans-serif",
  },
};
