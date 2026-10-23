/**
 * Web Share Target: „Udostępnij → G” z innej aplikacji.
 * Tekst i link: manifest kieruje GET na `/share?title=&text=&url=`; starsze
 * instalacje wysyłają jeszcze `/?share-title=&share-text=&share-url=`, więc
 * obie postacie są obsługiwane. Pliki (obrazy, PDF) idą POST-em do service
 * workera, który odkłada je i przekierowuje na `/share?inbox=<id>` — odbiór
 * w `lib/shareInbox.ts`.
 */

export const SHARE_PATH = "/share";
const DEDUP_KEY = "kaczy.share.last";
const DEDUP_WINDOW_MS = 60_000;

export const MAX_TITLE = 200;
export const MAX_TEXT = 20_000;
export const MAX_URL = 2_000;

export interface SharedNote {
  title: string;
  content: string;
}

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value: string | null, max: number, singleLine = false): string {
  let v = (value ?? "").replace(CONTROL, "").replace(/\r\n?/g, "\n").trim();
  if (singleLine) v = v.replace(/\s+/g, " ");
  return v.length > max ? v.slice(0, max).trimEnd() : v;
}

/** Tylko http(s) — `javascript:` i inne schematy trafiają co najwyżej jako zwykły tekst. */
function safeUrl(value: string): string {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Notatka z parametrów adresu albo `null`, gdy to nie jest udostępnienie.
 * Treść trafia jako zwykły tekst (Markdown), nigdy jako HTML.
 */
export function parseShare(pathname: string, search: string): SharedNote | null {
  const p = new URLSearchParams(search);
  const legacy = p.has("share-title") || p.has("share-text") || p.has("share-url");
  const isSharePath = pathname.replace(/\/+$/, "") === SHARE_PATH;
  if (!legacy && !isSharePath) return null;

  const title = clean(p.get(legacy ? "share-title" : "title"), MAX_TITLE, true);
  const text = clean(p.get(legacy ? "share-text" : "text"), MAX_TEXT);
  const rawUrl = clean(p.get(legacy ? "share-url" : "url"), MAX_URL, true);
  const url = safeUrl(rawUrl);

  const parts: string[] = [];
  if (text) parts.push(text);
  // Android często wkleja link także do `text` — bez dubla.
  if (url && !text.includes(url) && !text.includes(rawUrl)) parts.push(url);
  else if (rawUrl && !url && !text.includes(rawUrl)) parts.push(rawUrl);
  const content = parts.join("\n\n");
  if (!title && !content) return null;
  return { title, content };
}

function fingerprint(s: SharedNote): string {
  return `${s.title}\u0000${s.content}`;
}

/**
 * Czy to udostępnienie jest nowe? Odświeżenie strony `/share?...` w krótkim
 * oknie czasu nie tworzy drugiej notatki. Zapisuje znacznik w `sessionStorage`.
 */
export function claimShare(s: SharedNote, now: number = Date.now(), storage: Storage | null = safeSession()): boolean {
  const key = fingerprint(s);
  try {
    const last = JSON.parse(storage?.getItem(DEDUP_KEY) ?? "null") as { key?: string; at?: number } | null;
    if (last && last.key === key && typeof last.at === "number" && now - last.at < DEDUP_WINDOW_MS) return false;
    storage?.setItem(DEDUP_KEY, JSON.stringify({ key, at: now }));
  } catch {
    // Bez sessionStorage lepiej zapisać, niż zgubić udostępnioną treść.
  }
  return true;
}

function safeSession(): Storage | null {
  try { return typeof sessionStorage === "undefined" ? null : sessionStorage; } catch { return null; }
}
