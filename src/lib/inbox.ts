/**
 * Skrzynka: notatki „do posortowania” — bez folderu, bez etykiet i nie będące podnotatką.
 * Bez osobnego pola w danych: skrzynka to reguła nad istniejącymi notatkami, więc
 * sortowanie (przeniesienie do folderu albo nadanie etykiety) od razu ją opróżnia.
 */
/** „Odłożona” (S-1): termin odłożenia jeszcze nie minął, więc notatki nie ma w Skrzynce. */
export function isSnoozed(n: { snoozedUntil?: number }, now: number = Date.now()): boolean {
  return n.snoozedUntil !== undefined && n.snoozedUntil > now;
}

/**
 * Notatka prywatna (zablokowana) nigdy nie jest w skrzynce: ani na liście, ani w liczniku.
 * Odłożona (S-1) też nie, aż do swojego terminu.
 */
export function isInboxNote(n: { folderId?: string | null; labels: readonly string[]; parentId?: string | null; locked?: boolean; snoozedUntil?: number }): boolean {
  return !n.locked && !n.folderId && n.labels.length === 0 && !n.parentId && !isSnoozed(n);
}

export const INBOX_TITLE_MAX = 120;

/**
 * Tekst z pola przechwytywania → tytuł (pierwsza linia) i treść (reszta).
 * Jednolinijkowy wpis nie dubluje się w treści. `null` = pusty tekst.
 */
export function captureParts(raw: string): { title: string; content: string } | null {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const first = (lines[0] ?? "").trim();
  const rest = lines.slice(1).join("\n").trim();
  if (!first && !rest) return null;
  if (!first) return { title: rest.slice(0, INBOX_TITLE_MAX), content: rest.slice(INBOX_TITLE_MAX) };
  // Za długa pierwsza linia: tytuł to początek, reszta idzie do treści — nic nie przepada.
  const head = first.slice(0, INBOX_TITLE_MAX);
  const tail = first.slice(INBOX_TITLE_MAX).trim();
  const content = [tail, rest].filter(Boolean).join("\n");
  return { title: head, content };
}

/**
 * 1.3: notatka bez tytułu pokazuje pierwszą niepustą linię treści (jak kafel), reszta idzie do podglądu.
 * Bez treści — „Bez tytułu”.
 */
const NL = String.fromCharCode(10);

export function triageHeadline(note: { title: string; content: string }): { title: string; preview: string } {
  const content = note.content.trim();
  if (note.title.trim()) return { title: note.title.trim(), preview: content.slice(0, 300) };
  // Linie po NL; ewentualne CR znika przy trim().
  const lines = content.split(NL);
  const first = lines.findIndex((l) => l.trim());
  if (first < 0) return { title: "Bez tytułu", preview: "" };
  return { title: lines[first].trim().slice(0, 120), preview: lines.slice(first + 1).join(NL).trim().slice(0, 300) };
}

/**
 * 2.4: w polu sam adres http(s) → tytuł „domena/ścieżka” (bez `www.`, końcowego `/` i parametrów), adres w treści.
 * Tytułu strony nie pobieramy (brak serwera; CSP i CORS i tak by nie pozwoliły). `null` = to nie jest sam link.
 */
export function linkCapture(raw: string): { title: string; content: string } | null {
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  let u: URL;
  try { u = new URL(text); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  let path = u.pathname.replace(/\/+$/, "");
  try { path = decodeURIComponent(path); } catch { /* zły zapis % — zostaje jak jest */ }
  const title = (u.hostname.replace(/^www\./, "") + path).slice(0, INBOX_TITLE_MAX);
  return { title, content: text };
}

/** Po tylu dniach notatka w Skrzynce dostaje dyskretny znacznik (plan Skrzynki 4.3). */
export const INBOX_STALE_DAYS = 14;

/** Pełne dni kalendarzowe od zapisu do dziś (zmiana czasu nie przesuwa wyniku). */
export function inboxAgeDays(createdAt: number, now: number = Date.now()): number {
  const a = new Date(createdAt); a.setHours(12, 0, 0, 0);
  const b = new Date(now); b.setHours(12, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

/** Wiek notatki na kaflu w Skrzynce: „dziś”, „od wczoraj”, „od 3 dni” — ile czeka na posortowanie. */
export function inboxAgeLabel(createdAt: number, now: number = Date.now()): string {
  const d = inboxAgeDays(createdAt, now);
  if (d === 0) return "dziś";
  if (d === 1) return "od wczoraj";
  return `od ${d} dni`;
}
