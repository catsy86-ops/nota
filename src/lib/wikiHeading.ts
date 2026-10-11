/**
 * Linki `[[tytuł#nagłówek]]`: klik otwiera notatkę w czytniku i przewija do
 * nagłówka. Prośba o nagłówek jest krótkotrwała — czytnik może jeszcze nie
 * istnieć w chwili kliknięcia, więc zostaje w module do odebrania.
 */

let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestHeading(heading: string) {
  pending = heading;
  listeners.forEach((l) => l());
}

export function takePendingHeading(): string | null {
  const h = pending;
  pending = null;
  return h;
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

/** Przewija do nagłówka; `false`, gdy go (jeszcze) nie ma w treści. */
export function scrollToHeading(root: ParentNode | null, heading: string): boolean {
  if (!root) return false;
  const el = findHeading(root, heading);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("note-flash");
  window.setTimeout(() => el.classList.remove("note-flash"), 1600);
  return true;
}
