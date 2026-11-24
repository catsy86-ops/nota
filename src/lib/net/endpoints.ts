/**
 * S1.2 (plan bezpieczeństwa, wariant A): jedyne miejsce, z którego aplikacja łączy się z serwerami wpisanymi przez
 * użytkownika (przekaźnik, serwer powiadomień, serwery sygnalizacyjne) i z własnymi plikami (`sameOriginFetch`).
 * Reguła ESLint (`no-restricted-globals`) zakazuje `fetch`, `WebSocket` i `EventSource` poza tym modułem.
 *
 * Zasada: szyfrowane `https:`/`wss:` do dowolnego hosta; nieszyfrowane `http:`/`ws:` tylko do pętli zwrotnej
 * (serwer na tym samym komputerze, ADR-3/ADR-4). Adresów prywatnych nie odrzucamy — dostają znacznik „serwer lokalny”.
 * CSP zostaje `connect-src 'self' https: wss:`, bo adresy wpisuje użytkownik. To chroni przed pomyłką w kodzie
 * i przed `ws://` do obcego hosta, nie przed atakującym po XSS (WebRTC i nawigacja są poza `connect-src`,
 * `docs/model-zagrozen.md` §1a).
 */

export type EndpointKind = "http" | "ws";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Komputer użytkownika (pętla zwrotna) — tylko tu wolno bez szyfrowania. */
export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK.has(hostname.toLowerCase());
}

/** Pętla zwrotna, sieć prywatna IPv4 (10/8, 172.16/12, 192.168/16, 169.254/16), IPv6 ULA/link-local albo `*.local`. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (isLoopbackHost(h) || h.endsWith(".local")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (v4) {
    const a = Number(v4[1]), b = Number(v4[2]);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  return /^\[f[cd][0-9a-f]{2}:/.test(h) || /^\[fe[89ab][0-9a-f]:/.test(h);
}

/** Czy adres wolno użyć dla danego rodzaju połączenia. */
export function allowedEndpoint(u: URL, kind: EndpointKind): boolean {
  if (!u.host || u.username || u.password) return false;
  const [secure, plain] = kind === "http" ? ["https:", "http:"] : ["wss:", "ws:"];
  return u.protocol === secure || (u.protocol === plain && isLoopbackHost(u.hostname));
}

/** Znacznik „serwer lokalny” w ustawieniach: adres w sieci prywatnej albo na tym komputerze. */
export function isLocalEndpoint(raw: string): boolean {
  try {
    return isPrivateHost(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function checked(url: string, kind: EndpointKind): string {
  let u: URL;
  try { u = new URL(url); } catch { throw new TypeError("Nieprawidłowy adres serwera"); }
  if (!allowedEndpoint(u, kind)) throw new TypeError(`Adres serwera odrzucony: ${u.protocol}//${u.host}`);
  return url;
}

/** `fetch` do serwera użytkownika; adres spoza zasady rzuca `TypeError` (jak błąd sieci). */
export function endpointFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const s = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
  try {
    checked(s, "http");
  } catch (e) {
    return Promise.reject(e);
  }
  return fetch(url, init);
}

/** `WebSocket` do serwera użytkownika (kanał przekaźnika). */
export function endpointSocket(url: string): WebSocket {
  return new WebSocket(checked(url, "ws"));
}

/** `fetch` własnych plików aplikacji (np. silnik OCR z `public/`); inne źródło rzuca `TypeError`. */
export function sameOriginFetch(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url, location.href);
  if (u.origin !== location.origin) return Promise.reject(new TypeError(`Adres spoza aplikacji: ${u.origin}`));
  return fetch(u, init);
}
