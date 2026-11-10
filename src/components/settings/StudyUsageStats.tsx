import { useState } from "react";
import { readUsage, usageRows, USAGE_KEY } from "@/lib/study/usage";
import { Button } from "@/components/ui/button";

const LABEL: Record<string, string> = {
  "karta-budowy": "Karta budowy",
  wpis: "Wpis z budowy",
  raport: "Raport dnia / tygodnia",
  kalkulatory: "Kalkulatory",
  wysokosci: "Wysokości podejść",
  auto: "Materiał w aucie",
  "zamowienie-hurtownia": "Zamówienie do hurtowni",
  "zdjecia-z-dnia": "Zdjęcia z dnia",
  zlecenia: "Zlecenia własne",
  "paczka-budowy": "Wyślij budowę",
  "podpis-klienta": "Podpis klienta",
  "zakladka-site": "Zakładka Budowa",
  "zdjecie-budowa": "Zdjęcie z ekranu Budowa",
  "wpis-glosem-budowa": "Wpis głosem z ekranu Budowa",
  "brak-budowa": "Brak z ekranu Budowa",
  "zakladka-quiz": "Zakładka Quiz",
  "zakladka-board": "Zakładka Tablica",
  "zakladka-list": "Zakładka Lista",
  "zakladka-journal": "Zakładka Dziennik",
  "zakladka-plans": "Zakładka Plany",
};

/** Plan Pracy na budowie, B0.1: co w Pracy jest używane, a co nie. Dane tylko z tego telefonu. */
export function StudyUsageStats() {
  const [rows, setRows] = useState(() => usageRows(readUsage()));
  return (
    <details className="rounded-card border border-border/60 bg-muted/30 px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold coarse:min-h-11">Użycie funkcji Pracy</summary>
      <p className="ui-hint mt-1">Liczone tylko na tym telefonie, bez treści wpisów. Pokazuje, co warto wysunąć, a co schować.</p>
      {rows.length === 0 ? (
        <p className="ui-hint mt-2">Jeszcze nic nie zliczono.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.feature} className="flex justify-between gap-3">
              <span>{LABEL[r.feature] ?? r.feature}</span>
              <span className="ui-meta shrink-0">{r.n}× · {new Date(r.last).toLocaleDateString("pl-PL")}{r.idle ? " · nieużywane od 30 dni" : ""}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => { try { localStorage.removeItem(USAGE_KEY); } catch { /* bez zapisu */ } setRows([]); }}>
          Wyzeruj licznik
        </Button>
      )}
    </details>
  );
}
