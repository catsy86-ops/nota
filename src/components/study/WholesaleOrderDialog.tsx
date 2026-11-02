import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";
import { metersLabel } from "@/lib/study/pipes";
import { sharedSupplierPhone, wholesaleText, whatsappOrderUrl, type VanBuy, type WholesaleGroup } from "@/lib/study/order";
import { markSiteOrdered, undoSiteOrdered } from "@/lib/study/store";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * H1.4 Jedna lista do hurtowni: braki i materiał od ostatniego zamówienia ze wszystkich budów w toku,
 * w grupach „Na budowę: …”. Jedna wiadomość (kopia albo WhatsApp — numer hurtowni, gdy budowy mają
 * ten sam) i „Oznacz wszystko jako zamówione” z jednym „Cofnij” dla wszystkich budów.
 */
export function WholesaleOrderDialog({ open, onOpenChange, groups, van, dir }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: readonly WholesaleGroup[];
  /** H1.3: pozycje poniżej minimum w aucie. */
  van: readonly VanBuy[];
  dir: readonly SiteInfo[];
}) {
  const text = () => wholesaleText(groups, van);
  const empty = groups.length === 0 && van.length === 0;
  const phone = sharedSupplierPhone(groups.map((g) => dir.find((s) => s.id === g.siteId)?.supplierPhone));

  async function copy() {
    try {
      await navigator.clipboard.writeText(text());
      haptic("tap");
      toast.success("Skopiowano listę do hurtowni");
    } catch {
      toast.error("Nie udało się skopiować", { description: "Przeglądarka nie dała dostępu do schowka." });
    }
  }

  function sendWhatsApp() {
    haptic("tap");
    window.open(whatsappOrderUrl(text(), phone), "_blank", "noopener");
  }

  function markAll() {
    const undos = groups.flatMap((g) => { const u = markSiteOrdered(g.siteId); return u ? [u] : []; });
    if (undos.length === 0) return;
    haptic("success");
    onOpenChange(false);
    toastWithUndo(`Zamówione: ${undos.length} ${pluralPl(undos.length, ["budowa", "budowy", "budów"])}`, () => undos.forEach(undoSiteOrdered));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="wholesale-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Do hurtowni</DialogTitle>
          <DialogDescription>Braki i materiał od ostatniego zamówienia ze wszystkich budów — jedna wiadomość.</DialogDescription>
        </DialogHeader>
        {empty ? (
          <p className="text-sm text-muted-foreground">Nic do zamówienia. Braki dopisujesz w karcie budowy, a kształtki i rury we wpisach.</p>
        ) : (
          <div className="-mx-1 max-h-[55dvh] space-y-3 overflow-y-auto px-1">
            {groups.map((g) => (
              <section key={g.siteId} aria-label={`Na budowę: ${g.siteName}`} data-testid="wholesale-group" className="rounded-field border border-border p-2.5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Na budowę: <span className="normal-case text-foreground">{g.siteName}</span></h3>
                <ul className="space-y-0.5 text-sm">
                  {g.missing.map((s) => (
                    <li key={s.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{s.text} <span className="text-2xs text-muted-foreground">(brak)</span></span>
                      {s.qty && <span className="shrink-0 font-mono tabular-nums">{s.qty}</span>}
                    </li>
                  ))}
                  {g.order.pipes.map((p) => (
                    <li key={`rura-${p.name}`} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="shrink-0 font-mono tabular-nums">{metersLabel(p.cm)}</span>
                    </li>
                  ))}
                  {g.order.items.map((f) => (
                    <li key={f.name} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{f.name}</span>
                      <span className="shrink-0 font-mono tabular-nums">{f.qty} szt.</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {van.length > 0 && (
              <section aria-label="Do auta" data-testid="wholesale-van" className="rounded-field border border-border p-2.5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Do auta</h3>
                <ul className="space-y-0.5 text-sm">
                  {van.map((v) => (
                    <li key={v.name} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{v.name}</span>
                      <span className="shrink-0 font-mono tabular-nums">{v.qty.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} {v.unit}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-2xs text-muted-foreground">Po zakupie dopisz przyjęcie w „Auto”.</p>
              </section>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy} disabled={empty} className="coarse:h-11">
            <Copy className="h-4 w-4" aria-hidden />Kopiuj
          </Button>
          <Button variant="outline" size="sm" onClick={sendWhatsApp} disabled={empty} className="coarse:h-11">
            <MessageCircle className="h-4 w-4" aria-hidden />WhatsApp
          </Button>
          <Button size="sm" onClick={markAll} disabled={groups.length === 0} className="coarse:h-11">
            <Check className="h-4 w-4" aria-hidden />Oznacz wszystko jako zamówione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
