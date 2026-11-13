import type MiniSearch from "minisearch";
import type { Note } from "@/hooks/useNotes";
import { fold } from "@/lib/fold";

/**
 * Wspólny rdzeń indeksu notatek: ten sam kształt dokumentu, wagi pól i podział na słowa w głównym wątku
 * (`searchNotes.ts`) i w Workerze (`noteSearchHandlers.ts`). Bez Reacta i bez Yjs, żeby Worker nie ciągnął
 * za sobą reszty aplikacji.
 */

/**
 * Dokument indeksu: każde pole osobno, żeby MiniSearch liczył trafność per pole (tytuł waży więcej
 * niż treść). Aliasy, etykiety i pozycje listy to teksty złączone znakiem nowej linii.
 */
export interface IndexDoc {
  id: string;
  title: string;
  aliases: string;
  labels: string;
  checklist: string;
  content: string;
}

export const FIELDS: (keyof Omit<IndexDoc, "id">)[] = ["title", "aliases", "labels", "checklist", "content"];

/** Waga pól przy trafności (BM25 per pole, sumowane). */
export const BOOST: Record<(typeof FIELDS)[number], number> = { title: 4, aliases: 3, labels: 2, checklist: 1.5, content: 1 };

/**
 * Podział na słowa po zdjęciu ogonków: „Żółta, kartka” → `zolta`, `kartka`. Ten sam podział
 * dotyczy zapytania, więc „zolta” trafia w „żółta”, a „kupić” w „kupic”.
 */
export function tokenize(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export type DocSource = Pick<Note, "id" | "title" | "content" | "labels" | "aliases" | "checklist">;

export function toDoc(n: DocSource): IndexDoc {
  return {
    id: n.id,
    title: n.title,
    aliases: (n.aliases ?? []).join("\n"),
    labels: n.labels.join("\n"),
    checklist: (n.checklist ?? []).map((c) => c.text).join("\n"),
    content: n.content,
  };
}

export function sameDoc(a: IndexDoc, b: IndexDoc): boolean {
  return FIELDS.every((f) => a[f] === b[f]);
}

const INDEX_OPTIONS = {
  fields: FIELDS,
  storeFields: [] as string[],
  idField: "id",
  tokenize,
  searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND" as const, boost: BOOST },
};

/** Pusty indeks z ustawieniami wyszukiwania notatek (prefiksy, literówki, wszystkie słowa naraz). */
export function createNoteIndex(Ctor: typeof MiniSearch): MiniSearch<IndexDoc> {
  return new Ctor<IndexDoc>(INDEX_OPTIONS);
}

/** Indeks odtworzony ze zrzutu `MiniSearch#toJSON` (te same ustawienia co w `createNoteIndex`). */
export function loadNoteIndex(Ctor: typeof MiniSearch, json: unknown): MiniSearch<IndexDoc> {
  return Ctor.loadJS<IndexDoc>(json as Parameters<typeof MiniSearch.loadJS>[0], INDEX_OPTIONS);
}

/**
 * Wersja formatu zrzutu indeksu: zmiana pól, wag albo podziału na słowa unieważnia zapisany zrzut
 * (Worker buduje wtedy indeks od nowa). Podniesiona ręcznie przy zmianie samego `tokenize`.
 */
export const INDEX_FORMAT = `1|${FIELDS.join(",")}|${Object.values(BOOST).join(",")}`;

/** Odcisk dokumentu (cyrb53, 53 bity): po nim Worker poznaje, że zapisany indeks jest aktualny dla danej notatki. */
export function docFingerprint(d: IndexDoc): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const text = FIELDS.map((f) => d[f]).join("\u0001");
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}.${text.length.toString(36)}`;
}
