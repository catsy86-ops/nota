import { useMemo } from "react";
import { toast } from "sonner";
import { Hammer, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { useSiteBilling } from "@/lib/study/billingStore";
import { newQuoteItemId, QUOTE_ITEMS_MAX, type Job } from "@/lib/study/jobs";
import { removeQuoteItem, saveQuoteItem } from "@/lib/study/jobsStore";
import { useSitePoints } from "@/lib/study/pointsStore";
import { usePrices } from "@/lib/study/pricingStore";
import { itemsFromPoints, itemsFromUsage, type QuoteProposal } from "@/lib/study/quoteFromSite";
import type { SiteInfo } from "@/lib/study/sites";
import { useSiteMaterialUsage } from "@/lib/study/useSiteMaterialUsage";

/**
 * Pozycje wyceny z danych budowy (plan wycen i klientów, 4.4): „Z punktów” (punkty wodne × stawka za punkt z rozliczenia)
 * i „Z zużytego materiału” (kształtki i rury × cena z cennika). Przyciski pokazują się, gdy jest co dopisać; dopisanie ma
 * „Cofnij”, a pozycje bez stawki lub ceny są wymienione w komunikacie, nie wstawiane po cichu z zerem.
 */
export function QuoteFromSite({ site, job }: { site: SiteInfo; job: Job }) {
  const { points } = useSitePoints(site.id);
  const billing = useSiteBilling(site.id);
  const prices = usePrices();
  const fromPoints = useMemo(() => itemsFromPoints(points, billing, job.items), [points, billing, job.items]);
  const usage = useSiteMaterialUsage(site);
  const fromUsage = useMemo(() => itemsFromUsage(usage, prices, job.items), [usage, prices, job.items]);

  function add(p: QuoteProposal, label: string) {
    const room = QUOTE_ITEMS_MAX - job.items.length;
    let order = job.items.reduce((m, i) => Math.max(m, i.order + 1), 0);
    const added: string[] = [];
    const fits = p.items.slice(0, Math.max(0, room));
    for (const item of fits) {
      const id = newQuoteItemId();
      if (saveQuoteItem(site.id, { ...item, id, order: order++ })) added.push(id);
    }
    haptic("selection");
    const skipped = [
      p.noPrice.length > 0 && `bez ${label === "punktów" ? "stawki" : "ceny"}: ${p.noPrice.join(", ")}`,
      p.existing.length > 0 && `już w wycenie: ${p.existing.join(", ")}`,
      fits.length < p.items.length && `ponad limit ${QUOTE_ITEMS_MAX} pozycji: ${p.items.length - fits.length}`,
    ].filter(Boolean).join(" · ");
    if (added.length === 0) { toast.info(skipped ? `Nic nie dodano — ${skipped}` : "Nic nie dodano"); return; }
    toastWithUndo(`Dodano z ${label}: ${added.length} ${pluralPl(added.length, ["pozycja", "pozycje", "pozycji"])}`, () => { for (const id of added) removeQuoteItem(site.id, id); },
      { description: skipped || undefined });
  }

  const pointsAvailable = points.length > 0;
  const usageAvailable = usage.total.length > 0 || usage.totalPipes.length > 0;
  if (!pointsAvailable && !usageAvailable) return null;

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="quote-from-site">
      {pointsAvailable && (
        <Button type="button" size="sm" variant="outline" onClick={() => add(fromPoints, "punktów")} className="coarse:h-11" data-testid="quote-from-points">
          <Hammer className="h-4 w-4" aria-hidden />Z punktów{fromPoints.items.length > 0 ? ` (${fromPoints.items.length})` : ""}
        </Button>
      )}
      {usageAvailable && (
        <Button type="button" size="sm" variant="outline" onClick={() => add(fromUsage, "materiału")} className="coarse:h-11" data-testid="quote-from-usage">
          <Package2 className="h-4 w-4" aria-hidden />Z zużytego materiału{fromUsage.items.length > 0 ? ` (${fromUsage.items.length})` : ""}
        </Button>
      )}
    </div>
  );
}
