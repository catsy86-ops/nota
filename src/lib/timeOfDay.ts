/** Najbliższy moment „HH:MM” po `now`: dziś, a jeśli ta godzina minęła — jutro. Czas lokalny. */
export function nextReminderAt(hhmm: string, now: number): number {
  const [h, m] = hhmm.split(":").map(Number);
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  if (t.getTime() <= now) t.setDate(t.getDate() + 1);
  return t.getTime();
}
