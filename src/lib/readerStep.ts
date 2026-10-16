/**
 * Krok ←/→ w czytniku: poprzednia i następna notatka z listy, którą użytkownik widzi
 * (w kolejności widoku, bez zwiniętych grup). Notatka spoza listy (np. otwarta z linku
 * albo wyniku z innego widoku) nie ma sąsiadów — krok nic nie robi.
 */
export function readerNeighbors(ids: readonly string[], current: string | null): { prev: string | null; next: string | null } {
  const i = current ? ids.indexOf(current) : -1;
  if (i === -1) return { prev: null, next: null };
  return { prev: i > 0 ? ids[i - 1] : null, next: i < ids.length - 1 ? ids[i + 1] : null };
}
