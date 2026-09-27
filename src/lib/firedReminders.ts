import type { Note } from "@/hooks/useNotes";

/**
 * Rejestr już odpalonych, jednorazowych przypomnień — żeby to samo nie
 * wyskakiwało przy każdym otwarciu appki.
 *
 * Rejestr trzyma same `note.id`, więc sam z siebie nie wie nic o terminach.
 * Miało to dwa skutki: przesunięcie odpalonego przypomnienia na przyszłość
 * **nie odpalało się ponownie** (id zostawało w zbiorze na zawsze), a zbiór
 * rósł bez końca, bo nic nie usuwało wpisów po skasowanych notatkach.
 * `reconcileFired` naprawia oba, porównując rejestr z aktualnymi notatkami.
 */

// Nazwa klucza jest zaszłością po szablonie („Dash Notes”). Zmiana zgubiłaby
// stan „już wystrzelone” u wszystkich, więc zostaje do osobnej migracji.
export const FIRED_KEY = "dash-notes-fired-reminders";

export function loadFired(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || "[]");
    return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveFired(set: Set<string>) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set]));
  } catch {
    // Brak miejsca nie może wywrócić appki — najwyżej przypomnienie
    // powtórzy się raz przy następnym otwarciu.
  }
}

/**
 * Nowy rejestr zawierający tylko wpisy, które nadal coś znaczą.
 *
 * Wpis zostaje wyłącznie wtedy, gdy notatka wciąż istnieje i jej termin
 * dalej jest w przeszłości. Przesunięcie terminu w przyszłość, wyczyszczenie
 * go albo usunięcie notatki zdejmuje wpis, więc nowy termin wystrzeli.
 *
 * Zwraca `changed`, żeby nie pisać do `localStorage` przy każdym tyknięciu.
 */
export function reconcileFired(
  fired: Set<string>,
  notes: Note[],
  now: number = Date.now(),
): { next: Set<string>; changed: boolean } {
  if (fired.size === 0) return { next: fired, changed: false };

  const byId = new Map(notes.map((n) => [n.id, n]));
  const next = new Set<string>();
  for (const id of fired) {
    const note = byId.get(id);
    if (note && note.reminder !== null && note.reminder <= now) next.add(id);
  }
  return { next, changed: next.size !== fired.size };
}
