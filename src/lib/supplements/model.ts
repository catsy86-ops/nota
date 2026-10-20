/**
 * Odżywki: lista suplementów i dzienne odhaczenia. Czysta logika bez Yjs i bez React —
 * wejście z dokumentu, kopii i peera przechodzi przez `cleanSupplement`, więc śmieci nie wywracają widoku.
 */

export const SUPPLEMENT_WHEN = ["rano", "w_ciagu_dnia", "wieczorem"] as const;
export type SupplementWhen = (typeof SUPPLEMENT_WHEN)[number];

export const SUPPLEMENT_WHEN_LABEL: Record<SupplementWhen, string> = {
  rano: "Rano",
  w_ciagu_dnia: "W ciągu dnia",
  wieczorem: "Wieczorem",
};

export const SUPPLEMENT_NAME_MAX = 60;
export const SUPPLEMENT_DOSE_MAX = 40;
/** Ile odżywek może być na liście — zabezpieczenie przed zalaniem dokumentu. */
export const SUPPLEMENT_MAX_ENTRIES = 50;

export interface Supplement {
  id: string;
  name: string;
  /** Dawka zapisana słowami, np. „1 łyżka”. Pusta, gdy nieznana. */
  dose: string;
  when: SupplementWhen;
  created: number;
  /** Godzina codziennego przypomnienia „HH:MM”; brak = bez przypomnienia. */
  remindAt?: string;
  /** Id notatki-przypomnienia (dzienne powtarzanie w Przypomnieniach); brak = nie utworzono. */
  reminderNoteId?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Wejście → odżywka, albo `null` gdy brakuje nazwy, id albo pora jest obca. */
export function cleanSupplement(raw: unknown): Supplement | null {
  const s = raw as Partial<Supplement> | null;
  if (!s || typeof s !== "object") return null;
  if (typeof s.id !== "string" || !s.id || s.id.length > 64) return null;
  if (typeof s.name !== "string" || !s.name.trim()) return null;
  if (!SUPPLEMENT_WHEN.includes(s.when as SupplementWhen)) return null;
  const remindAt = typeof s.remindAt === "string" && TIME_RE.test(s.remindAt) ? s.remindAt : undefined;
  const reminderNoteId = typeof s.reminderNoteId === "string" && s.reminderNoteId && s.reminderNoteId.length <= 64 ? s.reminderNoteId : undefined;
  return {
    id: s.id,
    name: s.name.trim().slice(0, SUPPLEMENT_NAME_MAX),
    dose: typeof s.dose === "string" ? s.dose.trim().slice(0, SUPPLEMENT_DOSE_MAX) : "",
    when: s.when as SupplementWhen,
    created: typeof s.created === "number" && Number.isFinite(s.created) ? s.created : 0,
    ...(remindAt ? { remindAt } : {}),
    ...(reminderNoteId ? { reminderNoteId } : {}),
  };
}

/** Klucz odhaczenia: dzień i odżywka. Znak `|` nie występuje w dniu ani w id, więc klucz jest jednoznaczny. */
export function logKey(day: string, supplementId: string): string {
  return `${day}|${supplementId}`;
}

/** Odwrotność `logKey`; `null` gdy klucz nie ma poprawnego dnia albo id. */
export function parseLogKey(key: string): { day: string; supplementId: string } | null {
  const i = key.indexOf("|");
  if (i < 0) return null;
  const day = key.slice(0, i);
  const supplementId = key.slice(i + 1);
  if (!DAY_RE.test(day) || !supplementId || supplementId.length > 64) return null;
  return { day, supplementId };
}

/** Kolejność na liście: najpierw rano, potem w ciągu dnia, potem wieczorem; w grupie wg czasu dodania. */
export function bySupplementOrder(a: Supplement, b: Supplement): number {
  const w = SUPPLEMENT_WHEN.indexOf(a.when) - SUPPLEMENT_WHEN.indexOf(b.when);
  return w !== 0 ? w : a.created - b.created;
}

/** Ile odżywek z listy jest odhaczonych w danym dniu (tylko te, które jeszcze istnieją). */
export function takenCount(supplements: readonly Supplement[], taken: ReadonlySet<string>, day: string): number {
  return supplements.filter((s) => taken.has(logKey(day, s.id))).length;
}
