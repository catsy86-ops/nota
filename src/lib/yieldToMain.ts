/**
 * Oddaje wątek przeglądarce między porcjami długiej pracy (import, przywracanie kopii) — strona odpowiada na dotyk
 * i rysuje postęp. `scheduler.yield()` tam, gdzie jest (wraca przed innymi zadaniami w kolejce), inaczej `setTimeout(0)`.
 */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
