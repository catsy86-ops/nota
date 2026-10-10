/**
 * Wklejony pojedynczy adres http(s) -> `{ url, title }`, gdzie tytuł to domena
 * (bez „www.”). Bez sieci. Zwraca null dla tekstu, który nie jest samym URL-em.
 */
export function parsePastedUrl(text: string): { url: string; title: string } | null {
  const trimmed = text.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./i, "");
  if (!host) return null;
  return { url: trimmed, title: host };
}
