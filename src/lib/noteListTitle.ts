/**
 * Plan Dziś 1.2: tytuł notatki w wierszach list (Dziś, Terminy jako lista). Prywatna notatka nie ma jawnego
 * tytułu ani treści w projekcji — „Notatka prywatna” zamiast mylącego „Bez tytułu”. Bez tytułu: pierwsza
 * niepusta linia treści.
 */
export function noteListTitle(n: { title: string; content: string; locked?: boolean }): string {
  if (n.locked) return "Notatka prywatna";
  if (n.title.trim()) return n.title.trim();
  const first = n.content.split(String.fromCharCode(10)).find((l) => l.trim());
  return first?.trim() || "Bez tytułu";
}
