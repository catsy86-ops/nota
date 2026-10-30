import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, MessageCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { downloadBlob } from "@/lib/downloadBlob";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { billingCsv, billingStatement, billingText, money, parseAmount, PAYMENT_NOTE_MAX, type SiteBilling } from "@/lib/study/billing";
import { addPayment, removePayment } from "@/lib/study/billingStore";
import { companyNameStore } from "@/lib/study/companyPrefs";
import { pointStage, pointType, POINT_STEPS, type WaterPoint } from "@/lib/study/points";
import { siteStages } from "@/lib/study/stages";
import type { SiteInfo } from "@/lib/study/sites";

const dmy = (key: string) => key.split("-").reverse().join(".");
const newPaymentId = () => `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fieldCls = "h-9 rounded-field border border-input bg-background px-2 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11";

/**
 * H3.2 Należności budowy: naliczone pozycje (z włączonych sposobów), wpłaty z datą i „Zostało do zapłaty”
 * podkreślone podwójnie jak suma w zeszycie. Wysyłka szefowi: tekst (WhatsApp), PDF, CSV.
 */
export function SiteBillingDues({ site, billing, hours, points }: {
  site: SiteInfo;
  billing: SiteBilling;
  /** Godziny budowy do dziś z karty (`siteMinutesInRange`); brak = jeszcze nie policzone. */
  hours?: { minutes: number; unsplit: number };
  points: readonly WaterPoint[];
}) {
  const today = localDayKey();
  const st = useMemo(() => billingStatement({
    billing, rate: site.rate, minutes: hours?.minutes ?? 0, unsplit: hours?.unsplit ?? 0,
    points: points.map((p) => ({ type: p.type, done: pointStage(p) === POINT_STEPS.length })),
    stages: siteStages(site), typeLabel: (id) => pointType(id).label,
  }), [billing, site, hours, points]);
  const [adding, setAdding] = useState(false);

  function savePayment(form: HTMLFormElement) {
    const data = new FormData(form);
    const amount = parseAmount(String(data.get("amount") ?? ""));
    const day = String(data.get("day") ?? "") || today;
    if (typeof amount !== "number") { toast.error("Wpłata: wpisz kwotę, np. 2000 albo 1250,50"); return; }
    const note = String(data.get("note") ?? "");
    if (!addPayment(site.id, { id: newPaymentId(), day, amount, ...(note.trim() ? { note } : {}) })) { toast.error("Nie udało się zapisać wpłaty — sprawdź datę"); return; }
    haptic("success");
    setAdding(false);
  }

  function remove(id: string) {
    const p = st.payments.find((x) => x.id === id);
    if (!p) return;
    removePayment(site.id, id);
    toast(`Usunięto wpłatę ${money(p.amount)}`, { action: { label: "Cofnij", onClick: () => addPayment(site.id, p) } });
  }

  async function sendText() {
    const outcome = await shareOrCopy({ title: `Rozliczenie — ${site.name}`, text: billingText(site.name, st, today) });
    if (outcome === "copied") toast.success("Skopiowano — wklej szefowi na WhatsAppie");
    else if (outcome === "failed") toast.error("Nie udało się udostępnić ani skopiować");
  }

  async function sendPdf() {
    try {
      const [{ buildBillingPdf, billingPdfName }, { sharePdf }] = await Promise.all([import("@/lib/study/billingPdf"), import("@/lib/study/pdfWriter")]);
      const blob = await buildBillingPdf(site.name, st, { company: companyNameStore.get(), today });
      if ((await sharePdf(blob, billingPdfName(site.name))) === "downloaded") toast.success("Pobrano PDF rozliczenia");
    } catch {
      toast.error("Nie udało się zrobić PDF");
    }
  }

  const csv = () => downloadBlob(new Blob([billingCsv(st)], { type: "text/csv;charset=utf-8" }), `Rozliczenie - ${site.name} - ${today}.csv`);

  return (
    <div className="space-y-2" data-testid="billing-dues">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Należności</h4>

      <ul className="space-y-1 text-sm" aria-label="Naliczone">
        {st.lines.length === 0 && <li className="text-xs text-muted-foreground">Nic jeszcze nie naliczone — wpisz stawki niżej, a pozycje pojawią się tutaj.</li>}
        {st.lines.map((l, i) => (
          <li key={`${l.kind}-${i}`} className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1"><span className="font-medium">{l.label}</span> <span className="text-xs text-muted-foreground">{l.detail}</span></span>
            <span className="shrink-0 font-mono tabular-nums">{money(l.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between border-t border-dashed border-border pt-1 text-sm">
        <span className="text-muted-foreground">Naliczone</span>
        <span className="font-mono font-semibold tabular-nums" data-testid="billing-accrued">{money(st.accrued)}</span>
      </p>

      <ul className="space-y-1 text-sm" aria-label="Wpłaty">
        {st.payments.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs tabular-nums">{dmy(p.day)}</span>{p.note && <span className="text-muted-foreground"> · {p.note}</span>}</span>
            <span className="shrink-0 font-mono tabular-nums">−{money(p.amount)}</span>
            <button type="button" onClick={() => remove(p.id)} aria-label={`Usuń wpłatę ${money(p.amount)} z ${dmy(p.day)}`}
              className="pressable -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground coarse:h-11 coarse:w-11">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={(e) => { e.preventDefault(); savePayment(e.currentTarget); }} className="grid grid-cols-2 gap-2 rounded-field bg-muted/40 p-2" aria-label="Nowa wpłata">
          <input name="amount" inputMode="decimal" placeholder="Kwota, zł" aria-label="Kwota wpłaty (zł)" autoFocus className={cn(fieldCls, "text-right font-mono tabular-nums")} />
          <input name="day" type="date" defaultValue={today} max={today} aria-label="Dzień wpłaty" className={fieldCls} />
          <input name="note" maxLength={PAYMENT_NOTE_MAX} placeholder="Notatka, np. zaliczka gotówką" aria-label="Notatka do wpłaty" className={cn(fieldCls, "col-span-2")} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Anuluj</Button>
          <Button type="submit" size="sm">Zapisz wpłatę</Button>
        </form>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="w-full"><Plus className="h-4 w-4" aria-hidden />Wpłata (zaliczka)</Button>
      )}

      {/* Suma jak w zeszycie: podwójna kreska pod kwotą. */}
      <p className="flex items-baseline justify-between pt-1" data-testid="billing-due">
        <span className="text-sm font-semibold">{st.due >= 0 ? "Zostało do zapłaty" : "Nadpłata"}</span>
        <span className={cn("border-b-[3px] border-double pb-0.5 font-mono text-lg font-bold tabular-nums", st.due > 0 ? "border-primary text-foreground" : "border-border text-muted-foreground")}>
          {money(Math.abs(st.due))}
        </span>
      </p>
      {st.warnings.length > 0 && (
        <ul className="space-y-0.5 text-2xs text-muted-foreground" aria-label="Uwagi do rozliczenia" data-testid="billing-warnings">
          {st.warnings.map((w) => <li key={w}>• {w}</li>)}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-1.5 pt-1" role="group" aria-label="Wyślij rozliczenie">
        <Button type="button" variant="outline" size="sm" onClick={sendText}><MessageCircle className="h-4 w-4" aria-hidden />Tekst</Button>
        <Button type="button" variant="outline" size="sm" onClick={sendPdf}><FileText className="h-4 w-4" aria-hidden />PDF</Button>
        <Button type="button" variant="outline" size="sm" onClick={csv}><FileSpreadsheet className="h-4 w-4" aria-hidden />CSV</Button>
      </div>
    </div>
  );
}
