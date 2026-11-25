import { notePath, viewPath } from "@/lib/viewRoute";

/**
 * Q3.7: linki `web+notatnik:` (tag NFC, skrót na ekranie głównym, link z innej aplikacji). Manifest rejestruje
 * protokół z adresem `/?link=%s`; przed startem `protocolLinkPath` zamienia go na adres w aplikacji.
 * Tylko znane kształty — nic z linku nie trafia do adresu dosłownie, więc nie da się nim wyjść poza aplikację:
 * - `web+notatnik:notatka/<id>` → `/notatka/<id>`,
 * - `web+notatnik:budowa/<id>` → `/praca?budowa=<id>`,
 * - `web+notatnik:<widok>` (np. `dzis`, `kalendarz`, `dlugi`) → `/<widok>`.
 */

export const PROTOCOL = "web+notatnik";
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const VIEWS = ["dzis", "tydzien", "kalendarz", "grafik", "dlugi", "cwiczenia", "praca", "przypomnienia", "skrzynka", "archiwum"] as const;

/** Adres w aplikacji z wartości `?link=` albo `null`, gdy link jest obcy lub nieznany. */
export function protocolLinkPath(raw: string | null): string | null {
  if (!raw || raw.length > 300) return null;
  const m = /^web\+notatnik:(?:\/\/)?(.*)$/i.exec(raw.trim());
  if (!m) return null;
  let rest: string;
  try { rest = decodeURIComponent(m[1]); } catch { return null; }
  const [head, arg, extra] = rest.replace(/^\/+|\/+$/g, "").split("/");
  if (extra !== undefined) return null;
  if (head === "notatka" && arg && ID.test(arg)) return notePath(arg);
  if (head === "budowa" && arg && ID.test(arg)) return `/praca?budowa=${encodeURIComponent(arg)}`;
  if (!arg && (VIEWS as readonly string[]).includes(head)) return `/${head}`;
  if (!head && !arg) return viewPath("notes");
  return null;
}

/** Przed pierwszym renderem: `/?link=web+notatnik:…` → właściwy adres (bez nowego wpisu w historii). */
export function applyProtocolLink(loc: Location = location, hist: History = history): void {
  const raw = new URLSearchParams(loc.search).get("link");
  if (raw === null) return;
  hist.replaceState(hist.state, "", protocolLinkPath(raw) ?? "/");
}
