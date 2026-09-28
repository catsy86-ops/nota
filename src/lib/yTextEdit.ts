import * as Y from "yjs";

/**
 * Edycja `Y.Text` względem **bazy**, którą widział edytor, a nie względem
 * bieżącego stanu CRDT.
 *
 * Stary `applyTextDiff` liczył diff od `ytext.toString()`. Jeśli w trakcie
 * edycji peer dopisał zdanie, szkic go nie zawierał, więc diff uznawał to
 * zdanie za „usunięte lokalnie” i kasował je. Tu zamiast indeksów trzymamy
 * tożsamości znaków (`client`/`clock` Yjs) z chwili, gdy edytor dostał tekst:
 * lokalnie usunięte są tylko te znaki, które użytkownik faktycznie widział
 * i skasował, a wstawka trafia obok znaku, za którym ją napisał — niezależnie
 * od tego, co peer w międzyczasie wstawił gdzie indziej.
 */

interface CharId { client: number; clock: number }

export interface TextBase {
  /** Tekst, który edytor uważa za punkt wyjścia. */
  text: string;
  /** Tożsamość każdego znaku `text` (ta sama długość). */
  ids: CharId[];
}

function key(id: CharId): string {
  return `${id.client}:${id.clock}`;
}

/** Widoczne znaki `Y.Text` razem z ich tożsamościami. */
function readChars(ytext: Y.Text): CharId[] {
  const ids: CharId[] = [];
  for (let item = ytext._start; item; item = item.right) {
    if (item.deleted || !item.countable) continue;
    for (let k = 0; k < item.length; k++) ids.push({ client: item.id.client, clock: item.id.clock + k });
  }
  return ids;
}

export function captureTextBase(ytext: Y.Text): TextBase {
  return { text: ytext.toString(), ids: readChars(ytext) };
}

/**
 * Nakłada zmianę `base.text → next` na `ytext` i zwraca nową bazę — w linii
 * lokalnej (czyli dla tekstu `next`), gotową na kolejny zapis tej samej sesji.
 * Musi być wołane wewnątrz transakcji dokumentu.
 */
export function applyTextEdit(ytext: Y.Text, base: TextBase, next: string): TextBase {
  const prev = base.text;
  if (prev === next) return base;

  let start = 0;
  const maxStart = Math.min(prev.length, next.length);
  while (start < maxStart && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--; endNext--;
  }
  const inserted = next.slice(start, endNext);

  const current = readChars(ytext);
  const indexOf = new Map(current.map((id, i) => [key(id), i]));

  // Punkt wstawienia: za ostatnim widzianym znakiem przed zmianą, który
  // nadal istnieje; jeśli żaden nie istnieje — przed pierwszym za zmianą.
  let at = -1;
  for (let i = start - 1; i >= 0 && at < 0; i--) {
    const idx = indexOf.get(key(base.ids[i]));
    if (idx !== undefined) at = idx + 1;
  }
  if (at < 0) {
    for (let i = endPrev; i < prev.length && at < 0; i++) {
      const idx = indexOf.get(key(base.ids[i]));
      if (idx !== undefined) at = idx;
    }
  }
  if (at < 0) at = start === 0 ? 0 : current.length;

  // Kasujemy tylko znaki, które użytkownik widział i usunął. To, co peer
  // wstawił w środek tego zakresu, zostaje.
  const toDelete = base.ids.slice(start, endPrev)
    .map((id) => indexOf.get(key(id)))
    .filter((i): i is number => i !== undefined)
    .sort((a, b) => b - a);
  for (const idx of toDelete) {
    ytext.delete(idx, 1);
    if (idx < at) at--;
  }

  if (inserted) ytext.insert(at, inserted);

  const after = readChars(ytext);
  const insertedIds = after.slice(at, at + inserted.length);
  return {
    text: next,
    ids: [...base.ids.slice(0, start), ...insertedIds, ...base.ids.slice(endPrev)],
  };
}

/**
 * Przenosi pozycję (np. karetkę) z tekstu `from` na tekst `to` po
 * tożsamościach znaków: karetka zostaje za tym samym znakiem, za którym
 * stała, nawet jeśli peer wstawił albo usunął coś przed nią. Gdy tamten
 * znak zniknął, cofa się do najbliższego wcześniejszego, który przetrwał.
 */
export function mapOffset(from: TextBase, offset: number, to: TextBase): number {
  const indexOf = new Map(to.ids.map((id, i) => [key(id), i]));
  for (let i = Math.min(offset, from.ids.length) - 1; i >= 0; i--) {
    const idx = indexOf.get(key(from.ids[i]));
    if (idx !== undefined) return idx + 1;
  }
  return 0;
}
