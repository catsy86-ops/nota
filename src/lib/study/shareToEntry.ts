import { JOURNAL_MAX_IMAGES } from "./journalEntry";
import { getJournalDraft, patchJournalDraft } from "./draft";
import { addJournalEntry } from "./journalActions";

/**
 * Zdjęcia udostępnione z aparatu albo galerii → wpis z budowy (H4.1). Ładowane leniwie, dopiero po
 * wyborze „Wpis z budowy” w dymku udostępnienia (`useLaunchIntents.ts`).
 */

/**
 * Podział zdjęć: do szkicu wpisu tyle, ile się zmieści obok zdjęć już w szkicu (limit wpisu), reszta
 * w paczkach po `max` jako kolejne wpisy. Kolejność zdjęć zostaje.
 */
export function splitShared(draftImages: readonly string[], refs: readonly string[], max = JOURNAL_MAX_IMAGES): { draft: string[]; rest: string[][] } {
  const fresh = refs.filter((r) => !draftImages.includes(r));
  const room = Math.max(0, max - draftImages.length);
  const draft = fresh.slice(0, room);
  const rest: string[][] = [];
  for (let i = room; i < fresh.length; i += max) rest.push(fresh.slice(i, i + max));
  return { draft, rest };
}

/**
 * Dokłada zdjęcia (i tekst udostępnienia) do szkicu wpisu, a nadmiar zapisuje od razu jako wpisy na bieżącej
 * budowie. Zwraca liczbę dodatkowych wpisów — do komunikatu.
 */
export function sharedToEntry(refs: readonly string[], text: string): number {
  const d = getJournalDraft();
  const { draft, rest } = splitShared(d.images, refs);
  const t = text.trim();
  patchJournalDraft({ images: [...d.images, ...draft], ...(t && !d.text.includes(t) ? { text: d.text ? `${d.text}\n${t}` : t } : {}) });
  let saved = 0;
  for (const images of rest) if (addJournalEntry({ kind: "ok", topic: null, text: "", images })) saved++;
  return saved;
}
