import { useMemo } from "react";
import { PackageCheck, Copy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { markSiteOrdered, undoSiteOrdered, useStudy } from "@/lib/study/store";
import { toastWithUndo } from "@/lib/undoToast";
import type { SiteInfo } from "@/lib/study/sites";
import { siteOrder, supplierOrderText, whatsappOrderUrl } from "@/lib/study/order";
import { orderLogLine } from "@/lib/study/shortages";

/**
 * „Do zamówienia” w karcie budowy: kształtki zużyte od ostatniego zamówienia i braki „Brakuje” w jednej
 * wiadomości do hurtowni (kopia albo WhatsApp na numer z karty) oraz zaznaczenie zamówienia — lista
 * kształtek zaczyna się od zera, a braki przechodzą na „Zamówione”; w toaście „Cofnij” (1.7 planu Praca).
 * Zmienia się `orderedAt` karty, historia zamówień (`orders`) i statusy braków.
 */
export function SiteOrderPanel({ site }: { site: SiteInfo }) {
  const study = useStudy();
  const order = useMemo(() => siteOrder(study.journal, site.id, site.orderedAt), [study.journal, site.id, site.orderedAt]);
  const missing = (site.shortages ?? []).filter((x) => x.status === "missing").length;
  const empty = order.items.length === 0 && missing === 0;
  const text = () => supplierOrderText(site.name, order, site.shortages ?? []);
  const since = site.orderedAt
    ? `od ${new Date(site.orderedAt).toLocaleDateString("pl-PL")} (od ostatniego zamówienia)`
    : "od początku budowy";

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      haptic("tap");
      toast.success("Skopiowano listę zamówienia");
    } catch {
      toast.error("Nie udało się skopiować", { description: "Przeglądarka nie dała dostępu do schowka." });
    }
  }

  function sendWhatsApp() {
    haptic("tap");
    window.open(whatsappOrderUrl(text(), site.supplierPhone), "_blank", "noopener");
  }

  function markOrdered() {
    haptic("success");
    const undo = markSiteOrdered(site.id);
    if (!undo) return;
    const what = [order.items.length > 0 && "kształtki", missing > 0 && `${missing} ${missing === 1 ? "brak" : "braki"}`].filter(Boolean).join(" i ");
    toastWithUndo(`Zamówione: ${what}`, () => undoSiteOrdered(undo));
  }

  return (
    <section aria-label="Do zamówienia" data-testid="site-order" className="space-y-2 rounded-xl border border-border bg-card p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <PackageCheck className="h-3.5 w-3.5" aria-hidden />
        Do zamówienia
      </h3>
      {missing > 0 && (
        <p className="text-sm" data-testid="site-order-missing">
          + braki do zamówienia: <span className="font-mono tabular-nums">{missing}</span>
          <span className="text-muted-foreground"> (lista w „Braki materiału”)</span>
        </p>
      )}
      {order.items.length === 0 ? (
        missing === 0 && <p className="text-sm text-muted-foreground">Nic do zamówienia {site.orderedAt ? "od ostatniego zamówienia" : "— na budowie nie zużyto kształtek"}.</p>
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
