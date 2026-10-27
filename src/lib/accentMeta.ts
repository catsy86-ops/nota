import type { Skin } from "@/lib/skinList";

// Osobno od `accent.ts`, żeby nazwy i próbki nie trafiały do paczki startowej (wołają je tylko Ustawienia).
/** Nazwy i próbki odcieni. Próbka = `--primary` z `accents.css` (dla Zeszytu: jasny schemat) w hex. Indeks = numer akcentu. */
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
};
