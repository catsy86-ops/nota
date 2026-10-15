/**
 * `data-hidden` na `<html>`, gdy karta jest w tle (`document.hidden`). CSS w `index.css`
 * wstrzymuje wtedy wszystkie animacje CSS (`animation-play-state: paused`) — zapętlone
 * poświaty, pulsy i szkielety nie liczą się w tle, a po powrocie ruszają od miejsca,
 * w którym stanęły. Animacje framer-motion jadą na `requestAnimationFrame`, który
 * przeglądarka w tle i tak zatrzymuje.
 */
export function installPageHidden(doc: Document = document): () => void {
  const root = doc.documentElement;
  const sync = () => root.toggleAttribute("data-hidden", doc.hidden);
  sync();
  doc.addEventListener("visibilitychange", sync);
  return () => doc.removeEventListener("visibilitychange", sync);
}
