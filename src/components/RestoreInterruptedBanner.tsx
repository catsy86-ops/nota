import { useState } from "react";
import { format } from "date-fns";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearRestoreMarker, readRestoreMarker } from "@/lib/restoreMarker";

/**
 * Baner po przerwanym przywracaniu kopii (Z-18.1 audytu 2): bez niego mieszanka danych z kopii i sprzed niej wyglądałaby
 * jak zwykły stan. „Kopia i dane” prowadzi do ponownego wczytania tej samej kopii; „Zostaw, jak jest” zdejmuje znacznik.
 */
export function RestoreInterruptedBanner({ onOpenBackup }: { onOpenBackup: () => void }) {
  const [marker, setMarker] = useState(() => readRestoreMarker());
  if (!marker) return null;

  function keep() {
    clearRestoreMarker();
    setMarker(null);
  }

  return (
    <div role="alert" data-testid="restore-interrupted" className="flex flex-wrap items-start gap-2 rounded-card border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        Przywracanie kopii z {format(marker.exportedAt, "dd.MM")} zostało przerwane. Część danych pochodzi z kopii, część sprzed niej.
        Wczytaj tę samą kopię jeszcze raz.
      </p>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenBackup} className="coarse:h-11">Kopia i dane</Button>
        <Button type="button" variant="ghost" size="sm" onClick={keep} className="coarse:h-11">Zostaw, jak jest</Button>
      </div>
    </div>
  );
}
