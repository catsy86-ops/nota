import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSecurityEvents, type SecurityEvent, type SecurityEventKind } from "@/lib/diagnostics";

/** S6.3: zdarzenia bezpieczeństwa z tego urządzenia, nazwane tym, co widzi użytkownik. Nic nie wychodzi z urządzenia. */
export const SECURITY_KIND_TEXT: Record<SecurityEventKind, string> = {
  "csp-violation": "Przeglądarka zablokowała niedozwolony kod lub zasób",
  "vault-unlock-failed": "Nieudane odblokowanie skarbca",
  "vault-recovery-failed": "Nieudane użycie kodu awaryjnego skarbca",
  "vault-throttled": "Skarbiec wstrzymał próby po serii błędnych haseł",
  "vault-meta-rejected": "Odrzucone podejrzane dane skarbca",
  "rejected-peer-blob": "Odrzucony plik od innego urządzenia",
  "rejected-share-link": "Odrzucony link udostępnienia",
  "rejected-import": "Odrzucony plik importu",
  "rejected-sync-file": "Odrzucony plik synchronizacji",
  "relay-rollback": "Przekaźnik oddał starszy stan niż wcześniej",
  "relay-reset-loop": "Przekaźnik wielokrotnie zaczynał pokój od nowa",
  "relay-split": "Urządzenia widzą na przekaźniku różne stany",
  "peer-limit": "Inne urządzenie przekroczyło limit danych",
  "doc-format-claim": "Dane z nowszej wersji aplikacji",
};

const fmt = (at: number) => new Date(at).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function SecurityLogPanel({ events = getSecurityEvents() }: { events?: readonly SecurityEvent[] }) {
  const [all, setAll] = useState(false);
  if (events.length === 0) {
    return <p className="ui-hint" data-testid="security-log-empty">Brak zdarzeń — na tym urządzeniu nic nie zostało zablokowane ani odrzucone.</p>;
  }
  const newest = [...events].reverse();
  const shown = all ? newest : newest.slice(0, 5);
  return (
    <div className="space-y-2" data-testid="security-log">
      <ul className="space-y-1.5 text-sm">
        {shown.map((e) => (
          <li key={`${e.at}-${e.kind}`} className="grid grid-cols-[auto_1fr] gap-x-3">
            <span className="ui-meta tabular-nums">{fmt(e.at)}</span>
            <span>
              {SECURITY_KIND_TEXT[e.kind] ?? e.kind}
              {e.count > 1 && <span className="ui-meta"> × {e.count}</span>}
              {e.detail && <span className="block break-all font-mono text-xs text-muted-foreground">{e.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {newest.length > 5 && (
        <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setAll((v) => !v)}>
          {all ? "Pokaż ostatnie 5" : `Pokaż wszystkie (${newest.length})`}
        </Button>
      )}
      <p className="ui-hint">Zapis zostaje tylko na tym urządzeniu. Trafia do raportu diagnostycznego, jeśli go wyślesz.</p>
    </div>
  );
}
