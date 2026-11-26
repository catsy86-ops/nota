import type { ElementType } from "react";
import type { PeriodKind } from "@/lib/periodNote";
import type { Skin } from "@/lib/skins";
import type { AppFont } from "@/lib/appFont";

/**
 * A3.4 Rejestr poleceń palety: dział dopisuje polecenia źródłem (`registerCommandSource`), bez edycji
 * `CommandPalette.tsx`. Polecenie to dane — ta sama lista zasila paletę, a dalej ściągę skrótów (Q5.2).
 */

/** Widoki, do których prowadzi paleta (jak `onGo` w `CommandPalette`). */
export type GoView = "notes" | "inbox" | "today" | "week" | "archive" | "reminders" | "calendar" | "shifts" | "study" | "debts" | "cwiczenia" | "plans" | "trash" | "widget";

/** Co polecenie może zrobić — paleta podaje to z propsów i hooków; polecenia nie importują Reacta ani routera. */
export interface CommandContext {
  navigate: (to: string) => void;
  go: (view: GoView) => void;
  newNote: () => void;
  quickInbox: () => void;
  dailyNote: () => void;
  periodNote: (kind: PeriodKind) => void;
  openSettings: () => void;
  openStats: () => void;
  openFocusMode: () => void;
  openShortcuts: () => void;
  toggleTheme: () => void;
  /** Jasność: jasna, ciemna albo jak w systemie (`useTheme.ts` — warstwa hooks, więc przez kontekst). */
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  /** Tylko przy bieżącej notatce. */
  copyNote?: (format: "markdown" | "text") => void;
  vaultPhase: "locked" | "unlocked" | string;
  skin: Skin;
  /** Widok z adresu (np. `shifts`). */
  view?: string;
  /** Czy w palecie jest wpisany tekst — długie listy (style, kroje, jasność) tylko wtedy. */
  hasQuery: boolean;
  font: AppFont;
}

export interface Command {
  /** Stały identyfikator (`akcje.nowa-notatka`) — do testów, „ostatnio użytych” i ściągi. */
  id: string;
  label: string | ((ctx: CommandContext) => string);
  icon?: ElementType;
  /** Dodatkowe słowa wyszukiwania (bez polskich znaków też, bo filtr cmdk ich nie zna). */
  keywords?: string;
  /** Skrót klawiszowy do pokazania po prawej i w ściądze (np. „Ctrl+N”, „?”). */
  shortcut?: string | (() => string);
  /** Tekst po prawej zamiast skrótu (np. nazwa następnego stylu). */
  hint?: (ctx: CommandContext) => string;
  /** Kiedy polecenie jest widoczne; brak = zawsze. */
  when?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => void;
}

export interface CommandSource {
  /** Nagłówek grupy w palecie. */
  group: string | (() => string);
  /** Kolejność grup (mniejsze wyżej). */
  order: number;
  /** Ikony wyciszone (grupy skrótów do działów) albo w kolorze tekstu (akcje). */
  mutedIcons?: boolean;
  commands: Command[];
}
