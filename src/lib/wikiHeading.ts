/**
 * Linki `[[tytuł#nagłówek]]`: klik otwiera notatkę w czytniku i przewija do
 * nagłówka. Prośba o nagłówek jest krótkotrwała — czytnik może jeszcze nie
 * istnieć w chwili kliknięcia, więc zostaje w module do odebrania.
 */

let pending: { heading: string; at: number } | null = null;
const listeners = new Set<() => void>();

/** Prośba starsza niż to jest porzucana — inaczej nieodebrana przewinęłaby „cudzą” notatkę. */
const PENDING_TTL_MS = 3000;

export function requestHeading(heading: string) {
  pending = { heading, at: Date.now() };
  listeners.forEach((l) => l());
}

export function takePendingHeading(now: number = Date.now()): string | null {
  const p = pending;
  pending = null;
  return p && now - p.at <= PENDING_TTL_MS ? p.heading : null;
}

export function onHeadingRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Nagłówek h1–h6 o tym tekście (bez względu na wielkość liter); w drugiej kolejności zaczynający się od niego. */
export function findHeading(root: ParentNode, heading: string): HTMLElement | null {
  const want = norm(heading);
  if (!want) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"));
  return all.find((h) => norm(h.textContent ?? "") === want)
    ?? all.find((h) => norm(h.textContent ?? "").startsWith(want))
    ?? null;
}

/**
 * Akapit z blokiem `^id` (`data-block-id` ustawia renderer). Cel `^id` z `[[notatka#^id]]`
 * przewija do akapitu, nie do nagłówka.
 */
export function findBlockElement(root: ParentNode, blockId: string): HTMLElement | null {
  const id = blockId.trim();
  if (!id) return null;
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
  return all.find((el) => el.dataset.blockId?.toLowerCase() === id.toLowerCase()) ?? null;
}

/** Przewija do nagłówka (albo, dla `^id`, do bloku); `false`, gdy go (jeszcze) nie ma w treści. */
export function scrollToHeading(root: ParentNode | null, heading: string): boolean {
  if (!root) return false;
  const el = heading.startsWith("^") ? findBlockElement(root, heading.slice(1)) : findHeading(root, heading);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("note-flash");
  window.setTimeout(() => el.classList.remove("note-flash"), 1600);
  return true;
}
