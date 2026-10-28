import { useState } from "react";
import { ChevronDown, Copy, FileSpreadsheet, Package2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/downloadBlob";
import { materialCsv, materialText, materialUsage, priceOf } from "@/lib/study/materialUsage";
import { setFittingPrice, usePrices } from "@/lib/study/materialPrices";
import type { SiteInfo } from "@/lib/study/sites";
import type { JournalEntry } from "@/lib/study/yStudy";

const zl = (n: number) => `${n.toFixed(2).replace(".", ",")} zł`;

/**
 * P2.6 Zużycie materiału w karcie budowy: kształtki z wpisów per miesiąc i dostarczone braki,
 * opcjonalna cena za sztukę (na urządzeniu) i wartość. „Kopiuj” daje tekst, „CSV” plik do arkusza.
 * Zwinięte domyślnie; bez kształtek i dostaw sekcji nie ma.
 */
export function SiteMaterialPanel({ site, journal }: { site: SiteInfo; journal: JournalEntry[] }) {
  const prices = usePrices();
  const [open, setOpen] = useState(false);
  const usage = materialUsage(journal, site.id, site.shortages, prices);
  if (usage.months.length === 0) return null;
  const pieces = usage.total.reduce((s, f) => s + f.qty, 0);

  async function copy() {
    try {
      await navigator.clipboard.writeText(materialText(usage, site.name, prices));
      toast.success("Skopiowano zużycie materiału");
    } catch {
      toast.error("Nie udało się skopiować");
    }
  }

  function csv() {
    downloadBlob(new Blob([materialCsv(usage, prices)], { type: "text/csv;charset=utf-8" }), `Material - ${site.name}.csv`);
  }

  function savePrice(name: string, raw: string) {
    const t = raw.trim().replace(",", ".");
    if (t === "") { setFittingPrice(name, null); return; }
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) setFittingPrice(name, n);
  }

  return (
    <section aria-label="Zużycie materiału" data-testid="site-material" className="rounded-card border border-border/60 bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="site-material-body"
        className="pressable flex w-full items-center gap-2 px-3 py-2.5 text-left coarse:min-h-11">
        <Package2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-sm font-semibold">Zużycie materiału</span>
        <span className="text-xs tabular-nums text-muted-foreground">{pieces} szt.{usage.cost !== null ? ` · ${zl(usage.cost)}` : ""}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div id="site-material-body" className="space-y-3 border-t border-border px-3 py-3">
          {usage.months.map((m) => (
            <div key={m.month} className="space-y-1.5">
              <h4 className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="capitalize">{m.label}</span>
                {m.cost !== null && <span className="tabular-nums normal-case">{zl(m.cost)}{m.unpriced ? ` (+${m.unpriced} bez ceny)` : ""}</span>}
              </h4>
              <ul className="space-y-1">
                {m.fittings.map((f) => {
                  const p = priceOf(prices, f.name);
                  return (
                    <li key={f.name} className="flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="tabular-nums text-muted-foreground">{f.qty} szt.</span>
                      <Input aria-label={`Cena za sztukę: ${f.name}`} inputMode="decimal" placeholder="zł/szt." className="h-8 w-20 text-right tabular-nums coarse:h-11"
                        key={`${f.name}-${p ?? ""}`} defaultValue={p !== undefined ? String(p).replace(".", ",") : ""}
                        onBlur={(e) => savePrice(f.name, e.target.value)} />
                    </li>
                  );
                })}
                {m.delivered.map((d, i) => (
                  <li key={`d-${i}`} className="text-sm text-muted-foreground">Dostarczone: {d.text}{d.qty ? ` — ${d.qty}` : ""}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-2xs text-muted-foreground">Ceny są wspólne dla wszystkich budów i zostają na tym urządzeniu.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copy()} className="coarse:h-11"><Copy className="mr-1.5 h-4 w-4" aria-hidden />Kopiuj</Button>
            <Button type="button" variant="outline" size="sm" onClick={csv} className="coarse:h-11"><FileSpreadsheet className="mr-1.5 h-4 w-4" aria-hidden />CSV</Button>
          </div>
        </div>
      )}
    </section>
  );
}
