import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { amountInput, BILLING_MODES, billingSummary, MODE_LABEL, money, parseAmount, stagesTotal, type BillingMode } from "@/lib/study/billing";
import { setBillingModes, setLump, setPointRate, setStageAmount, useSiteBilling } from "@/lib/study/billingStore";
import { useSitePoints } from "@/lib/study/pointsStore";
import { POINT_TYPES } from "@/lib/study/points";
import { siteStages } from "@/lib/study/stages";
import { setSiteRate } from "@/lib/study/store";
import { SITE_RATE_MAX, type SiteInfo } from "@/lib/study/sites";

/** Pole kwoty: zapis przy wyjściu z pola; pusty tekst usuwa, zły tekst wraca do poprzedniej wartości. */
function AmountField({ label, value, onSave, placeholder, unit = "zł" }: {
  label: string;
  value: number | undefined;
  /** `false` = kwota poza zakresem. */
  onSave: (amount: number | null) => boolean;
  placeholder?: string;
  unit?: string;
}) {
  function commit(input: HTMLInputElement) {
    const n = parseAmount(input.value);
    if (n === (value ?? null)) return;
    if (n === undefined || !onSave(n)) {
      toast.error(`${label}: wpisz kwotę, np. 150 albo 1250,50`);
      input.value = amountInput(value);
    }
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <input
        key={value ?? "none"}
        defaultValue={amountInput(value)}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        inputMode="decimal"
        placeholder={placeholder ?? "—"}
        aria-label={`${label} (${unit})`}
        className="h-9 w-24 shrink-0 rounded-field border border-input bg-background px-2 text-right font-mono text-sm tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
      />
      <span className="w-8 shrink-0 text-xs text-muted-foreground">{unit}</span>
    </label>
  );
}

/**
 * H3.1 Sposób rozliczenia budowy w karcie: godziny (stawka karty), od punktu (stawka domyślna
 * i na typ punktu, H-4) i ryczałt (za całość i za etapy). Sposoby można łączyć. Liczenie
 * należności to H3.2 — tu tylko ustawienia i linia podsumowania w nagłówku.
 */
export function SiteBillingPanel({ site }: { site: SiteInfo }) {
  const billing = useSiteBilling(site.id);
  const { points } = useSitePoints(site.id);
  const [open, setOpen] = useState(false);
  const on = (m: BillingMode) => billing.modes.includes(m);
  // Typy punktów tej budowy, w kolejności listy typów, z liczbą sztuk.
  const used = POINT_TYPES.map((t) => ({ ...t, count: points.filter((p) => p.type === t.id).length })).filter((t) => t.count > 0);
  const stages = siteStages(site);
  const stagesSum = stagesTotal(billing);

  function flip(m: BillingMode) {
    setBillingModes(site.id, on(m) ? billing.modes.filter((x) => x !== m) : [...billing.modes, m]);
    haptic("selection");
  }

  const saveRate = (n: number | null) => {
    if (n !== null && n > SITE_RATE_MAX) return false;
    setSiteRate(site.id, n);
    return true;
  };

  return (
    <section aria-label="Rozliczenie" data-testid="site-billing" className="rounded-card border border-border/60 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`billing-${site.id}`}
        className="pressable flex w-full items-center gap-2 px-3 py-2.5 text-left coarse:min-h-11">
        <Wallet className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-sm font-semibold">Rozliczenie</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground" data-testid="site-billing-summary">{billingSummary(billing, site.rate)}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !open && "-rotate-90")} aria-hidden />
      </button>

      {open && (
        <div id={`billing-${site.id}`} className="space-y-3 border-t border-dashed border-border px-3 pb-3 pt-2.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sposób rozliczenia">
            {BILLING_MODES.map((m) => (
              <button key={m} type="button" onClick={() => flip(m)} aria-pressed={on(m)}
                className={cn("pressable rounded-full border px-3 py-1 text-sm coarse:min-h-11",
                  on(m) ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          {billing.modes.length === 0 && <p className="text-xs text-muted-foreground">Wybierz, jak jesteś rozliczany na tej budowie. Sposoby można łączyć.</p>}

          {on("hours") && (
            <fieldset className="space-y-1.5" data-testid="billing-hours">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{MODE_LABEL.hours}</legend>
              <AmountField label="Stawka godzinowa" unit="zł/h" value={site.rate} onSave={saveRate} placeholder="np. 45" />
            </fieldset>
          )}

          {on("points") && (
            <fieldset className="space-y-1.5" data-testid="billing-points">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{MODE_LABEL.points}</legend>
              <AmountField label="Za punkt (domyślnie)" value={billing.pointRate} onSave={(n) => setPointRate(site.id, null, n)} placeholder="np. 150" />
              {used.map((t) => (
                <AmountField key={t.id} label={`${t.label} ×${t.count}`} value={billing.typeRates[t.id]}
                  onSave={(n) => setPointRate(site.id, t.id, n)} placeholder={billing.pointRate !== undefined ? amountInput(billing.pointRate) : "—"} />
              ))}
              <p className="text-2xs text-muted-foreground">
                {used.length > 0 ? "Puste pole typu = stawka domyślna." : "Stawki na typ (np. WC na stelażu) pojawią się po dodaniu punktów w panelu „Punkty”."}
              </p>
            </fieldset>
          )}

          {on("lump") && (
            <fieldset className="space-y-1.5" data-testid="billing-lump">
              <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{MODE_LABEL.lump}</legend>
              <AmountField label="Za całą budowę" value={billing.lump} onSave={(n) => setLump(site.id, n)} />
              <p className="pt-1 text-xs text-muted-foreground">Albo za etapy — kwota należy się po odhaczeniu etapu:</p>
              {stages.map((s) => (
                <AmountField key={s.id} label={s.name} value={billing.stageAmounts[s.id]} onSave={(n) => setStageAmount(site.id, s.id, n)} />
              ))}
              {stagesSum > 0 && (
                <p className="text-right text-xs text-muted-foreground" data-testid="billing-stages-total">
                  Etapy razem: <span className="font-mono font-semibold tabular-nums text-foreground">{money(Math.round(stagesSum * 100) / 100)}</span>
                </p>
              )}
            </fieldset>
          )}
        </div>
      )}
    </section>
  );
}
