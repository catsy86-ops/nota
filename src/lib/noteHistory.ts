/**
 * Historia otwieranych notatek w tej sesji (nowy plan 5.1): Alt+← / Alt+→ jak w przeglądarce.
 * Czytnik i edytor nie zmieniają adresu, więc przeglądarka tej historii nie zna. Tylko w pamięci —
 * po odświeżeniu zaczyna od zera; trwałe „ostatnio otwierane” jest w `lastOpened.ts`.
 */
const MAX = 50;

export interface NoteHistory {
  /** Otwarcie notatki: ucina „przyszłość” (jak nowa strona po cofnięciu) i dopisuje id. */
  push(id: string): void;
  /** Krok w tył (-1) lub w przód (1) po notatkach, które `exists` uznaje za dostępne; `null` = nie ma dokąd. */
  step(dir: -1 | 1, exists: (id: string) => boolean): string | null;
}

export function createNoteHistory(): NoteHistory {
  let ids: string[] = [];
  let at = -1;
  // Otwarcie wywołane samym krokiem historii nie może jej przepisać.
  let stepping: string | null = null;
  return {
    push(id) {
      if (stepping === id) { stepping = null; return; }
      stepping = null;
      if (ids[at] === id) return;
      ids = [...ids.slice(0, at + 1), id].slice(-MAX);
      at = ids.length - 1;
    },
    step(dir, exists) {
      for (let i = at + dir; i >= 0 && i < ids.length; i += dir) {
        if (!exists(ids[i])) continue;
        at = i;
        stepping = ids[i];
        return ids[i];
      }
      return null;
    },
  };
}

export const noteHistory = createNoteHistory();
