/**
 * Szef, któremu idzie raport z budowy — imię i numer WhatsApp. Aplikacja nie ma
 * serwera: „Wyślij szefowi” otwiera czat WhatsApp (`wa.me`) z gotowym tekstem,
 * a wysyła już użytkownik w komunikatorze.
 */
export interface Boss {
  name: string;
  /** Numer w formacie międzynarodowym, same cyfry („48600100200”). */
  phone: string;
}

export const BOSS_NAME_MAX = 60;
/** Tekst w linku `wa.me` — dłuższe adresy potrafią się nie otworzyć na telefonie. */
export const WHATSAPP_TEXT_MAX = 3500;

/**
 * Numer wpisany po ludzku → cyfry z kierunkowym: „+48 600-100-200”, „0048…” i
 * polski numer bez kierunkowego (9 cyfr) dają „48600100200”. `null` = nie numer.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (/^\d{9}$/.test(digits)) digits = `48${digits}`;
  return /^\d{10,15}$/.test(digits) ? digits : null;
}

/** „48600100200” → „+48 600 100 200” (do pokazania). */
export function formatPhone(phone: string): string {
  if (phone.startsWith("48") && phone.length === 11) return `+48 ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  return `+${phone}`;
}

/** Dowolne wejście (peer, kopia) → kontakt albo `null`. */
export function cleanBoss(raw: unknown): Boss | null {
  const b = raw as Partial<Boss> | null;
  if (!b || typeof b !== "object" || typeof b.phone !== "string") return null;
  const phone = normalizePhone(b.phone);
  if (!phone) return null;
  return { name: typeof b.name === "string" ? b.name.trim().slice(0, BOSS_NAME_MAX) : "", phone };
}

/** Link otwierający czat z szefem z gotowym tekstem; za długi tekst jest przycinany z dopiskiem. */
export function whatsappUrl(phone: string, text: string): string {
  const body = text.length > WHATSAPP_TEXT_MAX
    ? `${text.slice(0, WHATSAPP_TEXT_MAX).replace(/\n[^\n]*$/, "")}\n…\n(raport skrócony — reszta w aplikacji)`
    : text;
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

/**
 * Grupa WhatsApp (np. brygada albo budowa). `wa.me` nie otwiera grup z tekstem,
 * więc raport idzie systemowym „Udostępnij” (z wyborem grupy, razem ze zdjęciami);
 * link zaproszenia służy do otwarcia czatu grupy, gdy udostępniania nie ma.
 */
export interface WaGroup {
  name: string;
  /** Link zaproszenia `https://chat.whatsapp.com/…`; pusty = brak. */
  link: string;
}

const GROUP_LINK_RE = /^https:\/\/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]{10,40})$/;

/** Link zaproszenia w dowolnej postaci (bez `https://`, z parametrami) → kanoniczny; `null` = nie link grupy. */
export function normalizeGroupLink(raw: string): string | null {
  let s = raw.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  s = s.replace(/^http:\/\//i, "https://");
  const m = s.match(GROUP_LINK_RE);
  return m ? `https://chat.whatsapp.com/${m[1]}` : null;
}

/** Dowolne wejście → grupa albo `null` (musi mieć nazwę; link opcjonalny, ale poprawny). */
export function cleanGroup(raw: unknown): WaGroup | null {
  const g = raw as Partial<WaGroup> | null;
  if (!g || typeof g !== "object" || typeof g.name !== "string" || !g.name.trim()) return null;
  const link = typeof g.link === "string" && g.link ? normalizeGroupLink(g.link) : "";
  return { name: g.name.trim().slice(0, BOSS_NAME_MAX), link: link ?? "" };
}
