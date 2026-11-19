import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dismissNewCodeHint, useNewCodeProposal, useSyncState } from "@/lib/yjsSync";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Pierwsze zdanie propozycji — wspólne dla banera i karty w ustawieniach. */
export const NEW_CODE_TITLE = "Zalecamy nowy kod synchronizacji.";

/**
 * Baner na Dziś (S2.6 §2.3, §3.3 p. 5): kod zmieniono na innym urządzeniu (stały, dopóki stan trwa) albo
 * jednorazowa propozycja nowego kodu — „Nie teraz” chowa ją na stałe, karta w ustawieniach zostaje.
 */
export function NewCodeBanner({ onOpenSync }: { onOpenSync: () => void }) {
  const sync = useSyncState();
  const proposal = useNewCodeProposal();
  const rekeyed = sync.status === "rekeyed";
  if (!rekeyed && (!proposal.kind || proposal.dismissed)) return null;

  return (
    <div role="status" data-testid="new-code-banner" className={cn(cardVariant("status", "warning"), "flex items-start gap-2 bg-warning/10 px-3 py-2 text-sm")}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        {rekeyed
          ? "Kod synchronizacji został zmieniony na innym urządzeniu. To urządzenie przestało wysyłać i odbierać zmiany."
          : NEW_CODE_TITLE}
      </p>
      <Button type="button" variant="ghost" size="sm" onClick={onOpenSync} className="shrink-0 coarse:h-11">
        {rekeyed ? "Sparuj ponownie" : "Szczegóły"}
      </Button>
      {!rekeyed && (
        <button type="button" onClick={dismissNewCodeHint} aria-label="Nie teraz — ukryj propozycję nowego kodu"
          className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:bg-muted coarse:size-11">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
