import { TriangleAlert } from "lucide-react";
import { yjsStore } from "@/lib/yjsStore";
import { useDocFormatStatus } from "@/lib/docFormat";

/**
 * D1.3: dane zapisała nowsza wersja aplikacji (wymaganie w mapie `docFormat`). Bez tego starsza wersja mogłaby
 * po cichu gubić to, czego nie rozumie. Obejście „Ignoruj i pisz” jest w Ustawieniach → Diagnostyka.
 */
export function DocFormatBanner() {
  const status = useDocFormatStatus(yjsStore.doc as never);
  if (status.tooNew.length === 0 || status.ignored) return null;
  return (
    <div role="alert" data-testid="doc-format-banner" className="flex items-start gap-2 rounded-card border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        Te dane zapisała nowsza wersja aplikacji. Zaktualizuj aplikację na tym urządzeniu — do tego czasu część danych
        może być tu niewidoczna albo tylko do odczytu.
      </p>
    </div>
  );
}
