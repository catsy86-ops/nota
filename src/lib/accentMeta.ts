import type { Skin } from "@/lib/skinList";

// Osobno od `accent.ts`, żeby nazwy i próbki nie trafiały do paczki startowej (wołają je tylko Ustawienia).
/** Nazwy i próbki odcieni. Próbka = `--primary` z `accents.css` w jasnym schemacie, w hex (w ciemnym schemacie odcień jest jaśniejszy: np. markery Tablicy stają się kredą). Indeks = numer akcentu. */
export const ACCENT_META: Record<Skin, { label: string; swatch: string }[]> = {
  zeszyt: [
    { label: "Bursztyn", swatch: "#e1860e" },
    { label: "Niebieski długopis", swatch: "#55a1fe" },
    { label: "Zielony", swatch: "#47b968" },
    { label: "Czerwony długopis", swatch: "#f1736c" },
    { label: "Fiolet", swatch: "#af86f1" },
  ],
  plan: [
    { label: "Błękit kalki", swatch: "#6bd2fa" },
    { label: "Pomarańcz", swatch: "#f8b277" },
    { label: "Zielony", swatch: "#8dd89d" },
    { label: "Róż korektora", swatch: "#faa5cd" },
    { label: "Biel kredy", swatch: "#b8c5cf" },
  ],
  neon: [
    { label: "Róż", swatch: "#ff52d1" },
    { label: "Błękit", swatch: "#05b8c8" },
    { label: "Żółć", swatch: "#fbdf0c" },
    { label: "Zieleń", swatch: "#05c537" },
    { label: "Fiolet", swatch: "#b586fe" },
  ],
  zorza: [
    { label: "Zieleń zorzy", swatch: "#36f2a7" },
    { label: "Fiolet", swatch: "#c29ffe" },
    { label: "Róż świtu", swatch: "#fa8ac2" },
    { label: "Błękit nocy", swatch: "#2cc4fe" },
    { label: "Złoto", swatch: "#dfac27" },
  ],
  miedz: [
    { label: "Miedź", swatch: "#a95528" },
    { label: "Patyna", swatch: "#058277" },
    { label: "Mosiądz", swatch: "#8d6a02" },
    { label: "Stal", swatch: "#5a738d" },
    { label: "Cegła", swatch: "#ad4f45" },
  ],
  matrix: [
    { label: "Zieleń", swatch: "#19ff2d" },
    { label: "Bursztyn monitora", swatch: "#ffc97f" },
    { label: "Cyjan", swatch: "#0ff0fa" },
    { label: "Koral", swatch: "#fec3bb" },
    { label: "Biel fosforu", swatch: "#cad9c6" },
  ],
  hydraulika: [
    { label: "Miedź", swatch: "#df8549" },
    { label: "Woda", swatch: "#1fade1" },
    { label: "Mosiądz", swatch: "#c59724" },
    { label: "Zawór czerwony", swatch: "#e67b74" },
    { label: "Zawór niebieski", swatch: "#62a1f0" },
  ],
  odblask: [
    { label: "Czarny", swatch: "#161616" },
    { label: "Pomarańcz", swatch: "#803200" },
    { label: "Granat", swatch: "#1a469d" },
    { label: "Zieleń BHP", swatch: "#035d28" },
    { label: "Czerwień", swatch: "#94020d" },
  ],
  kafle: [
    { label: "Kobalt", swatch: "#194cb1" },
    { label: "Turkus", swatch: "#026266" },
    { label: "Butelkowa zieleń", swatch: "#00672d" },
    { label: "Terakota", swatch: "#992400" },
    { label: "Fiolet", swatch: "#6635a3" },
  ],
  tablica: [
    { label: "Niebieski marker", swatch: "#1f53b8" },
    { label: "Czerwony marker", swatch: "#a51f1e" },
    { label: "Zielony marker", swatch: "#046d36" },
    { label: "Fioletowy marker", swatch: "#6b3baa" },
    { label: "Brązowy marker", swatch: "#8b4501" },
  ],
};
