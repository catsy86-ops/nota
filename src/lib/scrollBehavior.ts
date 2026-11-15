/**
 * Zachowanie przewijania z kodu: `smooth` tylko, gdy ruch nie jest ograniczony.
 * CSS `prefers-reduced-motion` nie wyłącza jawnego `behavior: "smooth"`, więc czytamy
 * atrybut `data-motion` z <html> (ustawia go `useMotionPref` z uwzględnieniem systemu).
 */
export function smoothBehavior(): ScrollBehavior {
  if (typeof document === "undefined") return "auto";
  const attr = document.documentElement.getAttribute("data-motion");
  if (attr === "reduced") return "auto";
  if (attr === "full") return "smooth";
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
