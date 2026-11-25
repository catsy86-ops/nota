import { isLocalEndpoint } from "@/lib/net/endpoints";

/**
 * S1.2: znacznik „serwer lokalny” pod polem adresu serwera. Adresów prywatnych nie odrzucamy (ADR-3/ADR-4),
 * tylko mówimy wprost, że poza tą siecią (albo tym komputerem) serwer będzie nieosiągalny.
 */
export function LocalServerNote({ urls }: { urls: readonly string[] }) {
  if (!urls.some((u) => isLocalEndpoint(u.trim()))) return null;
  return (
    <p className="ui-hint" data-testid="local-server-note">
      <span className="mr-1.5 inline-flex items-center rounded-full border border-border px-2 py-0.5 font-semibold text-foreground">
        Serwer lokalny
      </span>
      Działa tylko w tej samej sieci albo na tym komputerze — poza domem połączenie nie dojdzie.
    </p>
  );
}
