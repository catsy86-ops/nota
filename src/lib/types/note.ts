import type { NotePriority } from "@/lib/notePriority";
import type { Attachment } from "@/lib/attachments";
import type { NoteCover } from "@/lib/noteLook";
import type { RepeatRule } from "@/lib/reminderRepeat";
import type { NoteProps } from "@/lib/noteProps";

export type NoteColor = "default" | "coral" | "peach" | "sand" | "mint" | "sage" | "sky" | "lavender" | "rose";

export type FolderColor = "default" | "coral" | "peach" | "sand" | "mint" | "sage" | "sky" | "lavender" | "rose";

export interface Folder {
  id: string;
  name: string;
  color: FolderColor;
  emoji: string | null;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt?: number;
  /**
   * Domyślny szablon nowej notatki w tym folderze (nowy plan 5.9): id wbudowanego szablonu
   * (`TEMPLATES` w QuickTemplates) albo własnego (`kaczy.templates.v1`). Własne szablony są
   * lokalne — na urządzeniu, które go nie zna, folder zachowuje się jak bez szablonu.
   */
  templateId?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  /** Podzadanie: pozycja wcięta pod poprzednią. Brak pola = poziom główny. */
  indent?: 1;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  trashedAt: number | null;
  labels: string[];
  /** Inne nazwy notatki: `[[alias]]` prowadzi tutaj (opcjonalne, starsze notatki ich nie mają). */
  aliases?: string[];
  reminder: number | null;
  reminderRepeat?: "none" | "daily" | "weekly" | "monthly";
  /** Rodzaj powtarzania z nowszej wersji (dni robocze, co 2 tygodnie, co rok, wybrane dni, co N dni). `reminderRepeat` to wtedy zapasowy, najbliższy znany rodzaj. */
  reminderRule?: RepeatRule;
  /**
   * Dzień miesiąca, na który użytkownik ustawił termin (1–31). Seria miesięczna
   * od 31. trafia w krótszych miesiącach na ostatni dzień, a potem wraca na 31. —
   * bez tego pola 28 lutego „zjadłoby” zamiar na zawsze. Ustawiane w `updateNote`.
   */
  reminderDay?: number;
  /**
   * Koniec serii: ostatni moment, w którym seria może mieć termin (koniec wybranego
   * dnia, czas lokalny). Brak = seria bez końca. Jedna liczba — bezpieczna dla LWW.
   */
  reminderRepeatUntil?: number;
  /** Przypomnienie na cały dzień: `reminder` = 9:00 tego dnia, UI pokazuje samą datę. Brak = zwykły termin z godziną. */
  reminderAllDay?: boolean;
  /** Odłożone wystąpienie serii: termin serii, który `reminder` zastępuje (patrz `reminderSpec.ts`). */
  reminderBase?: number;
  /** Wcześniejsze przypomnienie w minutach przed terminem (Terminy 3.2, `lib/reminderLead.ts`). */
  reminderLead?: number;
  /** Godzina serii w minutach od północy (T 1.2): kotwica, żeby seria nie dryfowała po zmianie czasu. */
  reminderTime?: number;
  /** S-1 (Skrzynka „Odłóż”): notatka nie jest w Skrzynce do tej chwili (ms). Brak lub minęła = w Skrzynce. */
  snoozedUntil?: number;
  priority: NotePriority;
  /** Notatka dnia: lokalna data `YYYY-MM-DD` (patrz `lib/dailyNote.ts`); brak = zwykła notatka. */
  dailyDate?: string;
  /** Notatka tygodnia (`2026-W43`) albo miesiąca (`2026-10`): patrz `lib/periodNote.ts`. */
  periodKey?: string;
  /** Ikona notatki (emoji) — brak = bez ikony. Strukturalna: zostaje jawna także w notatce prywatnej. */
  icon?: string;
  /** Okładka kafla: jeden z gotowych wzorów (`lib/noteLook.ts`). */
  cover?: NoteCover;
  /** Ulubiona: pokazuje się w pasku bocznym. Brak = nie. */
  favorite?: boolean;
  /** Blokada edycji: kafel nie wchodzi w tryb edycji, dopóki nie zostanie odblokowany. */
  readOnly?: boolean;
  /**
   * Podstrona: id notatki-rodzica (`lib/subpages.ts`). Brak = poziom główny.
   * Rodzic, którego nie ma, jest traktowany jak brak rodzica.
   */
  parentId?: string;
  /** Kafel rozciągnięty na dwie kolumny siatki (od `sm`). */
  wide?: boolean;
  /** Wartości własnych właściwości (`lib/noteProps.ts`), klucz = id definicji. Brak = bez wartości. Nie w notatce prywatnej. */
  props?: NoteProps;
  /** Większy tekst w treści kafla. */
  largeText?: boolean;
  /** Klucze SHA-256 w `imageStore` (manifest `imageHashes` w Y.Doc). Bajty poza dokumentem — patrz `lib/imageStore.ts`. */
  images: string[];
  /** Pliki inne niż obrazy: manifest `attachments` w Y.Doc, bajty w `imageStore` — patrz `lib/attachments.ts`. Brak = bez załączników. */
  attachments?: Attachment[];
  checklist: ChecklistItem[];
  /**
   * Notatka prywatna (patrz `lib/privateNotes.ts`): `title`, `content`, `checklist`
   * i `labels` są w projekcji puste, a prawdziwa treść siedzi zaszyfrowana w
   * `vault`. Reszta aplikacji widzi więc pustą notatkę — wyciek jest wyłączony
   * z konstrukcji, nie z pamięci o filtrach.
   */
  locked?: boolean;
  /** Szyfrogram `v1.<iv>.<ct>` z treścią notatki prywatnej (AAD = id notatki). */
  vault?: string;
  folderId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}
