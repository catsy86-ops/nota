import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileCheck, FileText, PenLine, Plus, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { toastWithUndo } from "@/lib/undoToast";
import { amountInput, money, parseAmount } from "@/lib/study/billing";
import { companyNameStore } from "@/lib/study/companyPrefs";
import {
  itemClientTotal, JOB_SCOPE_MAX, JOB_STATUS_LABEL, JOB_STATUSES, parseMargin, parseQty, QUOTE_KIND_LABEL, QUOTE_KINDS,
  QUOTE_NAME_MAX, QUOTE_UNIT_MAX, quoteTotals, signatureValidFor, type Job, type QuoteKind,
} from "@/lib/study/jobs";
import { removeJob, removeQuoteItem, restoreJob, saveQuoteItem, setJobMeta } from "@/lib/study/jobsStore";
import type { SiteInfo } from "@/lib/study/sites";

const fieldCls = "h-9 rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const qtyText = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const newItemId = () => `q-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * H3.4 Zlecenie własne (fucha) w karcie budowy: status (wycena → umówione → zrobione → zapłacone),
 * zakres prac, termin (widoczny w Kalendarzu), wycena z robocizną i materiałem z marżą, PDF „Wycena”.
 * Dane w mapie `studyJobs` (`jobsStore.ts`), nie w karcie — pieniądze zostają przy Tobie.
 */
export function SiteJobPanel({ site, job, onSign }: { site: SiteInfo; job: Job; /** Okno podpisu klienta (ten sam podpis co na protokole, P2.4). */ onSign: () => void }) {
  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState<QuoteKind>("labor");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const totals = quoteTotals(job);
  /** Podpis z karty złożony po ostatniej zmianie wyceny (H3.5). */
  const signed = signatureValidFor(job, site.signature);

  function setStatus(status: Job["status"]) {
    if (status === job.status) return;
    setJobMeta(site.id, { status });
    haptic(status === "paid" ? "success" : "selection");
  }

  function addItem() {
    const n = parseQty(qty);
    const p = price.trim() === "" ? null : parseAmount(price);
    if (!name.trim()) return;
    if (n === undefined) { toast.error("Ilość: wpisz liczbę, np. 1 albo 2,5"); return; }
    if (p === undefined) { toast.error("Cena: wpisz kwotę, np. 150 albo 49,90"); return; }
    const order = job.items.reduce((m, i) => Math.max(m, i.order + 1), 0);
    if (!saveQuoteItem(site.id, { id: newItemId(), kind, name, qty: n, unit, price: p ?? 0, order })) {
      toast.error("Nie dodano pozycji — sprawdź nazwę i kwoty");
      return;
    }
    setName("");
    setQty("1");
    setPrice("");
    haptic("selection");
  }

  function dropItem(id: string) {
    const removed = removeQuoteItem(site.id, id);
    if (removed) toastWithUndo(`Usunięto „${removed.name}”`, () => saveQuoteItem(site.id, removed));
  }

  function saveMargin(input: HTMLInputElement) {
    const m = parseMargin(input.value);
    if (m === undefined) {
      toast.error("Marża: wpisz procent, np. 15");
      input.value = job.margin === undefined ? "" : amountInput(job.margin);
      return;
    }
    if ((m ?? undefined) !== job.margin) setJobMeta(site.id, { margin: m ?? undefined });
  }

  async function sendPdf() {
    try {
      const [{ buildJobPdf, jobPdfName }, { sharePdf }] = await Promise.all([import("@/lib/study/jobPdf"), import("@/lib/study/pdfWriter")]);
      const blob = await buildJobPdf(job, site, { company: companyNameStore.get(), today: localDayKey() });
      if ((await sharePdf(blob, jobPdfName(site.name))) === "downloaded") toast.success("Pobrano PDF wyceny");
    } catch {
      toast.error("Nie udało się zrobić PDF-u wyceny");
    }
  }

  /** H3.5: potwierdzenie wykonania z podpisem klienta z karty. */
  async function sendDonePdf() {
    try {
      const [{ buildJobDonePdf, jobDonePdfName }, { sharePdf, signatureDataUrl }] = await Promise.all([import("@/lib/study/jobPdf"), import("@/lib/study/pdfWriter")]);
      const dataUrl = signed ? await signatureDataUrl(site.signature) : undefined;
      if (site.signature && !signed) toast.warning("Podpis jest sprzed zmiany wyceny — podpisz ponownie, bo w PDF zostanie puste miejsce");
      else if (signed && !dataUrl) toast.warning("Obraz podpisu jeszcze nie dotarł na to urządzenie — w PDF jest tylko imię i data");
      const blob = await buildJobDonePdf(job, site, { company: companyNameStore.get(), today: localDayKey(), signatureDataUrl: dataUrl });
      if ((await sharePdf(blob, jobDonePdfName(site.name))) === "downloaded") toast.success("Pobrano potwierdzenie wykonania");
    } catch {
      toast.error("Nie udało się zrobić PDF-u potwierdzenia");
    }
  }

  function unmark() {
    const removed = removeJob(site.id);
    if (removed) toastWithUndo(`„${site.name}” to znowu zwykła budowa`, () => restoreJob(site.id, removed));
  }

  return (
    <section aria-label="Zlecenie własne" data-testid="site-job" className="rounded-card border border-primary/40 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`job-${site.id}`}
        className="pressable flex w-full items-center gap-2 px-3 py-2.5 text-left coarse:min-h-11">
        <Wrench className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />
        <span className="text-sm font-semibold">Zlecenie własne</span>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground" data-testid="site-job-summary">
          {JOB_STATUS_LABEL[job.status]}{totals.total > 0 && ` · ${money(totals.total)}`}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !open && "-rotate-90")} aria-hidden />
      </button>

      {open && (
        <div id={`job-${site.id}`} className="space-y-3 border-t border-dashed border-border px-3 pb-3 pt-2.5">
          <div className="grid grid-cols-4 gap-1" role="group" aria-label="Status zlecenia">
            {JOB_STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={job.status === s}
                className={cn("pressable min-w-0 truncate rounded-field border px-1.5 py-1.5 text-xs coarse:min-h-11 sm:text-sm",
                  job.status === s ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                {JOB_STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-xs font-semibold text-muted-foreground">Co zrobić</span>
            <textarea
              key={job.scope ?? ""}
              defaultValue={job.scope ?? ""}
              maxLength={JOB_SCOPE_MAX}
              rows={2}
              placeholder="np. Wymiana baterii w kuchni, przeciek pod zlewem"
              onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v !== (job.scope ?? "")) setJobMeta(site.id, { scope: v || undefined }); }}
              className="w-full rounded-field border border-input bg-background px-2.5 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">Termin <span className="text-xs text-muted-foreground">(w Kalendarzu)</span></span>
            <input
              type="datetime-local"
              value={job.term ?? ""}
              onChange={(e) => setJobMeta(site.id, { term: e.currentTarget.value || undefined, ...(e.currentTarget.value && job.status === "quote" ? { status: "booked" as const } : {}) })}
              aria-label="Termin zlecenia"
              className={cn(fieldCls, "w-auto shrink-0 font-mono tabular-nums")}
            />
          </label>

          <h4 className="border-t border-dashed border-border pt-2.5 text-xs font-semibold text-muted-foreground">Wycena</h4>
          {job.items.length === 0 ? (
            <p className="ui-hint">Dodaj robociznę i materiał — z nich powstanie PDF dla klienta.</p>
          ) : (
            <ul className="space-y-1" data-testid="job-items">
              {job.items.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm" data-testid="job-item">
                  <span className={cn("shrink-0 rounded-full px-1.5 text-2xs", i.kind === "labor" ? "bg-primary/12 text-primary-ink" : "bg-muted text-muted-foreground")}>
                    {i.kind === "labor" ? "R" : "M"}<span className="sr-only">{QUOTE_KIND_LABEL[i.kind]}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{i.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{qtyText(i.qty)} {i.unit} × {money(i.price)}</span>
                  <span className="w-20 shrink-0 text-right font-mono text-xs font-semibold tabular-nums">{money(itemClientTotal(i, job.margin))}</span>
                  <button type="button" onClick={() => dropItem(i.id)} aria-label={`Usuń pozycję ${i.name}`}
                    className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground coarse:size-11">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="space-y-1.5 rounded-field border border-dashed border-border p-2" onSubmit={(e) => { e.preventDefault(); addItem(); }} aria-label="Nowa pozycja wyceny">
            <div className="flex gap-1" role="group" aria-label="Rodzaj pozycji">
              {QUOTE_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                  className={cn("pressable rounded-full border px-2.5 py-0.5 text-xs coarse:min-h-11 coarse:px-3 coarse:text-sm",
                    kind === k ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  {QUOTE_KIND_LABEL[k]}
                </button>
              ))}
            </div>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={QUOTE_NAME_MAX} aria-label="Nazwa pozycji"
              placeholder={kind === "labor" ? "np. Wymiana baterii" : "np. Bateria zlewozmywakowa"} className={cn(fieldCls, "w-full")} />
            <div className="flex items-center gap-1.5">
              <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" aria-label="Ilość" className={cn(fieldCls, "w-16 text-right font-mono tabular-nums")} />
              <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={QUOTE_UNIT_MAX} aria-label="Jednostka"
                placeholder={kind === "labor" ? "usł." : "szt."} className={cn(fieldCls, "w-16")} />
              <span className="text-xs text-muted-foreground" aria-hidden>×</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" aria-label="Cena za jednostkę (zł)"
                placeholder="cena" className={cn(fieldCls, "min-w-0 flex-1 text-right font-mono tabular-nums")} />
              <span className="text-xs text-muted-foreground">zł</span>
              <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} className="shrink-0 coarse:h-11">
                <Plus className="h-4 w-4" aria-hidden />Dodaj
              </Button>
            </div>
          </form>

          <label className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">Marża na materiał</span>
            <input
              key={job.margin ?? "none"}
              defaultValue={job.margin === undefined ? "" : amountInput(job.margin)}
              onBlur={(e) => saveMargin(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              inputMode="decimal"
              placeholder="0"
              aria-label="Marża na materiał (%)"
              className={cn(fieldCls, "w-20 shrink-0 text-right font-mono tabular-nums")}
            />
            <span className="w-8 shrink-0 text-xs text-muted-foreground">%</span>
          </label>

          <dl className="space-y-0.5 border-t border-dashed border-border pt-2 text-sm" data-testid="job-totals">
            <div className="flex justify-between"><dt className="text-muted-foreground">Robocizna</dt><dd className="font-mono tabular-nums">{money(totals.labor)}</dd></div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Materiał{totals.marginAmount > 0 && ` (+ marża ${money(totals.marginAmount)})`}</dt>
              <dd className="font-mono tabular-nums">{money(Math.round((totals.material + totals.marginAmount) * 100) / 100)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold"><dt>Razem dla klienta</dt><dd className="font-mono tabular-nums" data-testid="job-total">{money(totals.total)}</dd></div>
          </dl>

          {(job.status === "done" || job.status === "paid") && (
            <div className="flex flex-wrap items-center gap-2 rounded-field bg-muted/40 p-2" data-testid="job-done">
              <Button type="button" variant="outline" size="sm" onClick={onSign} className="coarse:h-11" data-testid="job-sign">
                <PenLine className="h-4 w-4" aria-hidden />{signed ? "Podpisane" : site.signature ? "Podpisz ponownie" : "Podpis klienta"}
              </Button>
              <Button type="button" size="sm" onClick={sendDonePdf} className="coarse:h-11"><FileCheck className="h-4 w-4" aria-hidden />Potwierdzenie wykonania</Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={sendPdf} className="coarse:h-11"><FileText className="h-4 w-4" aria-hidden />PDF wyceny</Button>
            <button type="button" onClick={unmark} className="pressable text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">
              To nie jest fucha
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
