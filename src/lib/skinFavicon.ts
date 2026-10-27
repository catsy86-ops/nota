import { SKIN_ICON, type Skin } from "@/lib/skinList";

/** Monogram „N” na zaokrąglonym kwadracie, 64×64 (plan motywów 2.6). */
export function faviconSvg(bg: string, fg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${bg}"/><path d="M16 48V16h9l14 19V16h9v32h-9L25 29v19z" fill="${fg}"/></svg>`;
}

/** Adres ikony karty dla stylu: plik marki dla Zeszytu, SVG w data URI dla pozostałych. */
export function faviconHref(skin: Skin): string {
  if (skin === "zeszyt") return "/favicon.png";
  const { bg, fg } = SKIN_ICON[skin];
  return `data:image/svg+xml,${encodeURIComponent(faviconSvg(bg, fg))}`;
}

export function applySkinFavicon(skin: Skin) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  const href = faviconHref(skin);
  if (link.getAttribute("href") === href) return;
  link.type = skin === "zeszyt" ? "image/png" : "image/svg+xml";
  link.href = href;
}
