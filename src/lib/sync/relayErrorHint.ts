import type { RelayErrorCode } from "@/lib/sync/relayProvider";

/** Wskazówka dla trwałego błędu przekaźnika: co się stało i co można zrobić. */
export interface RelayErrorHint {
  text: string;
  /** Działanie w aplikacji, które pomaga; `code-change` = panel „Zmiana kodu” w tej samej karcie. */
  action?: { label: string; target: "code-change" };
}

const HINTS: Record<RelayErrorCode, RelayErrorHint> = {
  ROOM_FULL: {
    text:
      "Miejsce na przekaźniku dla tej grupy urządzeń się skończyło. Nowe zmiany z tego urządzenia nie trafiają na przekaźnik, ale są zapisane tutaj i nadal docierają do urządzeń połączonych bezpośrednio. Możesz zmienić kod synchronizacji — grupa dostanie nowe, puste miejsce na przekaźniku. Przedtem możesz pobrać kopię danych w ustawieniach „Kopia i dane”.",
    action: { label: "Przejdź do zmiany kodu", target: "code-change" },
  },
};

export function relayErrorHint(code: RelayErrorCode | undefined): RelayErrorHint | null {
  return code ? HINTS[code] ?? null : null;
}
