import { useMemo } from "react";
import { PackageCheck, Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { markSiteOrdered, useStudy } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";
import { orderText, siteOrder, whatsappOrderUrl } from "@/lib/study/order";
import { orderLogLine } from "@/lib/study/shortages";

/**
 * „Do zamówienia” w karcie budowy: kształtki zużyte od ostatniego zamówienia, kopia tekstu
 * do wysłania dostawcy i zaznaczenie zamówienia (od tej chwili lista zaczyna się od zera).
 * Dane tylko do odczytu z wpisów; zmienia się `orderedAt` karty i historia zamówień (`orders`).
 */
export function SiteOrderPanel({ site }: { site: SiteInfo }) {
  const study = useStudy();
  const order = useMemo(() => siteOrder(study.journal, site.id, site.orderedAt), [study.journal, site.id, site.orderedAt]);
  const empty = order.items.length === 0;
  const since = site.orderedAt
    ? `od ${new Date(site.orderedAt).toLocaleDateString("pl-PL")} (od ostatniego zamówienia)`
    : "od początku budowy";

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderText(site.name, order));
      haptic("tap");
      toast.success("Skopiowano listę zamówienia");
    } catch {
      toast.error("Nie udało się skopiować", { description: "Przeglądarka nie dała dostępu do schowka." });
    }
  }

  function sendWhatsApp() {
    haptic("tap");
    window.open(whatsappOrderUrl(orderText(site.name, order)), "_blank", "noopener");
  }

  function markOrdered() {
    haptic("success");
    markSiteOrdered(site.id);
    toast.success("Zapisano: kształtki zamówione");
  }

  return (
    <section aria-label="Do zamówienia" data-testid="site-order" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <PackageCheck className="h-3.5 w-3.5" aria-hidden />
        Do zamówienia
      </h3>
      {empty ? (
        <p className="text-sm text-muted-foreground">Nic do zamówienia {site.orderedAt ? "od ostatniego zamówienia" : "— na budowie nie zużyto kształtek"}.</p>
      ) : (
        <ul className="space-y-1 text-sm" data-testid="site-order-items">
          {order.items.map((f) => (
            <li key={f.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="shrink-0 font-mono tabular-nums">{f.qty} szt.</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-2xs text-muted-foreground">Liczone {since}{order.entries > 0 && ` · ${order.entries} ${order.entries === 1 ? "wpis" : "wpisów"}`}.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy} disabled={empty} className="coarse:h-11">
          <Copy className="mr-1.5 h-4 w-4" aria-hidden />Kopiuj listę
        </Button>
        <Button variant="outline" size="sm" onClick={sendWhatsApp} disabled={empty} className="coarse:h-11">
          <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden />WhatsApp
        </Button>
        <Button size="sm" onClick={markOrdered} disabled={empty} className="coarse:h-11">
          <Check className="mr-1.5 h-4 w-4" aria-hidden />Oznacz jako zamówione
        </Button>
      </div>
      {site.orders && site.orders.length > 0 && (
        <details className="text-xs text-muted-foreground" data-testid="site-order-history">
          <summary className="cursor-pointer select-none py-1 coarse:py-2">Poprzednie zamówienia ({site.orders.length})</summary>
          <ul className="mt-1 space-y-0.5">
            {[...site.orders].reverse().map((o) => <li key={o.at} className="font-mono tabular-nums">{orderLogLine(o)}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
