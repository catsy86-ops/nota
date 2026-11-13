import { useMemo, useState } from "react";
import { Download, FileCode2, FilePen, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { downloadBlob } from "@/lib/downloadBlob";
import { money } from "@/lib/study/billing";
import { bankAccountStore, companyNameStore } from "@/lib/study/companyPrefs";
import { itemClientPrice, type Job } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";
import { invoiceFileName } from "@/lib/ksef/fa3";
import { computeInvoice, validateInvoice, VAT_RATES, type Invoice, type InvoiceLine, type PriceMode, type VatRate } from "@/lib/ksef/invoice";
import { issueInvoice, useInvoices } from "@/lib/ksef/invoicesStore";
import { findDuplicateNumbers } from "@/lib/ksef/numbering";
import { sellerStore, setSeller, useSeries } from "@/lib/ksef/sellerPrefs";
import { CorrectionDialog } from "./CorrectionDialog";
import { useSiteClient } from "@/lib/clients/store";
import { buyerDiffers, buyerFromClient, createClientFromBuyer, saveBuyerToClient } from "@/lib/clients/siteClient";
import { verifyRecord, type InvoiceRecord } from "@/lib/ksef/yInvoices";

const fieldCls = "h-9 w-full rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const gr = (zl: number) => Math.round(zl * 100);
const fromGrosze = (g: number) => money(g / 100);

const PAYMENT_FORMS: ReadonlyArray<{ id: 1 | 2 | 6 | 7; label: string }> = [
  { id: 6, label: "Przelew" }, { id: 1, label: "Gotówka" }, { id: 2, label: "Karta" }, { id: 7, label: "Płatność mobilna" },
];

/**
 * Pozycje wyceny jako pozycje faktury: cena dla klienta (z marżą przy materiale), ilość w tysięcznych. Rabat z wyceny
 * (`doc.discount`) obniża ceny jednostkowe wszystkich pozycji o ten sam procent, bo faktura (`InvoiceLine`) nie ma osobnej
 * linii rabatu; cena jest zaokrąglana do grosza, więc suma faktury może różnić się od kwoty z wyceny o grosze na pozycję.
 */
export function linesFromJob(job: Pick<Job, "items" | "margin" | "doc">, rate: VatRate): InvoiceLine[] {
  const factor = 1 - (job.doc?.discount ?? 0) / 100;
  return job.items.map((i) => ({
    name: i.name,
    unit: i.unit.trim() || (i.kind === "labor" ? "usł." : "szt."),
    qtyMilli: Math.round(i.qty * 1000),
    unitPrice: gr(itemClientPrice(i, job.margin) * factor),
    rate,
  }));
}

const addDays = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDayKey(d);
};

async function downloadPdf(r: InvoiceRecord) {
  try {
    const [{ buildInvoicePdf, invoicePdfName }, { sharePdf }] = await Promise.all([import("@/lib/ksef/invoicePdf"), import("@/lib/study/pdfWriter")]);
    const blob = await buildInvoicePdf(r);
    if ((await sharePdf(blob, invoicePdfName(r.number))) === "downloaded") toast.success("Pobrano PDF faktury");
  } catch {
    toast.error("Nie udało się zrobić PDF faktury");
  }
}

function download(r: InvoiceRecord) {
  downloadBlob(new Blob([r.xml], { type: "application/xml;charset=utf-8" }), invoiceFileName(r.number));
}

/**
 * KSeF Etap 1 (ADR-6): wystawianie faktury VAT z wyceny zlecenia. Dane sprzedawcy i nabywcy do uzupełnienia, wybór cen
 * (netto/brutto) i stawki VAT; po wystawieniu faktura jest niezmienna, a XML FA(3) do pobrania i wgrania do KSeF
 * (aplikacja niczego nie wysyła). Lista poniżej pokazuje faktury tej budowy ze znacznikiem zgodności skrótu.
 */
export function InvoiceDialog({ open, onOpenChange, site, job }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: SiteInfo;
  job: Job;
}) {
  const series = useSeries();
  const all = useInvoices();
  const mine = useMemo(() => all.filter((r) => r.siteId === site.id), [all, site.id]);
  const duplicates = useMemo(() => new Set(findDuplicateNumbers(all.map((r) => r.number))), [all]);
  const today = localDayKey();

  const [seller, setSellerState] = useState(() => {
    const s = sellerStore.get();
    return { ...s, name: s.name || companyNameStore.get() };
  });
  // Nabywca z kartoteki klientów (plan wycen i klientów, 2.2); bez klienta — jak dawniej z karty budowy, NIP do wpisania.
  const client = useSiteClient(site.id);
  const [buyer, setBuyer] = useState(() => (client ? buyerFromClient(client) : { name: site.investor || site.name, nip: "", address1: site.address, address2: "" }));
  // Tryb cen i stawka z wyceny (3.2): „Ceny netto + VAT” → netto, „brutto” albo bez VAT → brutto jak dotąd.
  const [priceMode, setPriceMode] = useState<PriceMode>(job.doc?.vatMode === "net" ? "net" : "gross");
  const [rate, setRate] = useState<VatRate>(job.doc?.vatRate ?? 23);
  /** Stawki ustawione osobno dla pozycji (indeks → stawka); zmiana stawki ogólnej je zeruje. */
  const [overrides, setOverrides] = useState<Record<number, VatRate>>({});
  const [form, setForm] = useState<1 | 2 | 6 | 7>(6);
  const [due, setDue] = useState(() => addDays(today, 14));
  const [saleDate, setSaleDate] = useState(() => localDayKey(new Date(job.statusAt)));
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [correcting, setCorrecting] = useState<InvoiceRecord | null>(null);
  const [okMap, setOkMap] = useState<Record<string, boolean>>({});

  const lines = useMemo(() => linesFromJob(job, rate).map((l, i) => (overrides[i] === undefined ? l : { ...l, rate: overrides[i] })), [job, rate, overrides]);
  const draft: Omit<Invoice, "number"> = useMemo(() => ({
    issueDate: today, saleDate, seller, buyer, priceMode, lines,
    payment: { form, ...(form === 6 || form === 2 ? { dueDate: due } : {}), ...(form === 6 && bankAccountStore.get().trim() ? { account: bankAccountStore.get().trim() } : {}) },
  }), [today, saleDate, seller, buyer, priceMode, lines, form, due]);
  const totals = useMemo(() => computeInvoice({ lines, priceMode }), [lines, priceMode]);

  async function issue() {
    setBusy(true);
    setProblems([]);
    try {
      const res = await issueInvoice(site.id, draft);
      if (!res.ok) { setProblems(res.problems.map((p) => p.message)); haptic("warn"); return; }
      setSeller(seller);
      haptic("success");
      toast.success(`Wystawiono fakturę ${res.record.number}`, { action: { label: "Pobierz XML", onClick: () => download(res.record) } });
    } finally {
      setBusy(false);
    }
  }

  async function check(r: InvoiceRecord) {
    setOkMap((m) => ({ ...m, [r.id]: false }));
    const ok = await verifyRecord(r);
    setOkMap((m) => ({ ...m, [r.id]: ok }));
    if (!ok) toast.error(`Faktura ${r.number}: skrót XML się nie zgadza — dane zostały zmienione po wystawieniu`);
    else toast.success(`Faktura ${r.number}: skrót zgodny`);
  }

  const set = (k: "name" | "nip" | "address1" | "address2") => (e: React.ChangeEvent<HTMLInputElement>) => setSellerState((s) => ({ ...s, [k]: e.target.value }));
  const setB = (k: "name" | "nip" | "address1" | "address2") => (e: React.ChangeEvent<HTMLInputElement>) => setBuyer((s) => ({ ...s, [k]: e.target.value }));
  const FIELD_NAME = { name: "nazwę", nip: "NIP", address: "adres" } as const;
  function saveBuyer() {
    if (!client) return;
    const r = saveBuyerToClient(client.id, buyer);
    if (r.ok) toast.success(`Zapisano dane nabywcy u klienta: ${client.name}`);
    else toast.error(`Nie zapisano u klienta: sprawdź ${FIELD_NAME[r.field]}`);
  }
  function addBuyerToClients() {
    const c = createClientFromBuyer(site.id, buyer);
    if (c) toast.success(`Dodano klienta: ${c.name}`);
    else toast.error("Nie dodano klienta: sprawdź nazwę i NIP", { description: "Nazwa nie może być pusta, a NIP musi mieć poprawną sumę kontrolną." });
  }
  const quickProblems = validateInvoice({ ...draft, number: "FV/A/2026/001" }).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="invoice-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Faktura dla „{site.name}”</DialogTitle>
          <DialogDescription>
            Pozycje z wyceny. Po wystawieniu faktury nie da się zmienić — poprawia ją tylko korekta (przycisk „Koryguj” przy fakturze). Aplikacja zapisuje plik XML (FA(3)),
            który wgrasz do KSeF albo przekażesz księgowej; niczego sama nie wysyła.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted-foreground">Sprzedawca (seria numeracji tego telefonu: {series})</legend>
          <input aria-label="Nazwa sprzedawcy" placeholder="Nazwa firmy" value={seller.name} onChange={set("name")} className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="NIP sprzedawcy" placeholder="NIP" inputMode="numeric" value={seller.nip} onChange={set("nip")} className={cn(fieldCls, "font-mono")} />
            <input aria-label="Adres sprzedawcy" placeholder="Ulica i numer" value={seller.address1} onChange={set("address1")} className={fieldCls} />
          </div>
          <input aria-label="Kod i miejscowość sprzedawcy" placeholder="Kod pocztowy i miejscowość" value={seller.address2 ?? ""} onChange={set("address2")} className={fieldCls} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted-foreground">Nabywca</legend>
          <input aria-label="Nazwa nabywcy" placeholder="Imię i nazwisko albo firma" value={buyer.name} onChange={setB("name")} className={fieldCls} />
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="NIP nabywcy" placeholder="NIP (puste = konsument)" inputMode="numeric" value={buyer.nip} onChange={setB("nip")} className={cn(fieldCls, "font-mono")} />
            <input aria-label="Adres nabywcy" placeholder="Adres" value={buyer.address1} onChange={setB("address1")} className={fieldCls} />
          </div>
          <input aria-label="Kod i miejscowość nabywcy" placeholder="Kod pocztowy i miejscowość" value={buyer.address2} onChange={setB("address2")} className={fieldCls} />
          {client ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="buyer-client">
              <span>Z kartoteki: {client.name}</span>
              {buyerDiffers(buyer, client) && (
                <>
                  <button type="button" onClick={() => setBuyer(buyerFromClient(client))} className="pressable underline underline-offset-2 hover:text-foreground coarse:min-h-11">Przywróć dane klienta</button>
                  <button type="button" onClick={saveBuyer} className="pressable underline underline-offset-2 hover:text-foreground coarse:min-h-11" data-testid="buyer-save">Zapisz u klienta</button>
                </>
              )}
            </div>
          ) : buyer.name.trim() ? (
            <button type="button" onClick={addBuyerToClients} className="pressable text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground coarse:min-h-11" data-testid="buyer-add">Dodaj nabywcę do klientów</button>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted-foreground">Ceny i VAT</legend>
          {job.doc?.discount !== undefined && (
            <p className="ui-hint" data-testid="invoice-discount">Rabat z wyceny ({job.doc.discount}%) jest wliczony w ceny pozycji.</p>
          )}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Ceny w wycenie są">
            {(["gross", "net"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={priceMode === m} onClick={() => setPriceMode(m)}
                className={cn("pressable rounded-full border px-3 py-1 text-sm coarse:min-h-11", priceMode === m ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground")}>
                {m === "gross" ? "Ceny brutto" : "Ceny netto"}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-sm">
              Stawka VAT dla wszystkich
              <select aria-label="Stawka VAT dla wszystkich" value={rate} onChange={(e) => { setRate(Number(e.target.value) as VatRate); setOverrides({}); }} className={cn(fieldCls, "w-auto")}>
                {VAT_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "0% (krajowa)" : `${r}%`}</option>)}
              </select>
            </label>
          </div>
          <ul className="space-y-1 text-sm" aria-label="Pozycje faktury">
            {lines.map((l, i) => (
              <li key={i} className="flex items-baseline gap-2" data-testid="invoice-line">
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{l.qtyMilli / 1000} {l.unit}</span>
                <select aria-label={`Stawka VAT pozycji ${i + 1}`} value={l.rate} onChange={(e) => setOverrides((o) => ({ ...o, [i]: Number(e.target.value) as VatRate }))} className={cn(fieldCls, "h-8 w-auto shrink-0 px-1 coarse:h-11")}>
                  {VAT_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "0%" : `${r}%`}</option>)}
                </select>
                <span className="shrink-0 font-mono tabular-nums">{fromGrosze(totals.lines[i].gross)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-0.5 border-t border-dashed border-border pt-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Netto</dt><dd className="font-mono tabular-nums">{fromGrosze(totals.net)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">VAT</dt><dd className="font-mono tabular-nums">{fromGrosze(totals.vat)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Brutto</dt><dd className="font-mono tabular-nums" data-testid="invoice-gross">{fromGrosze(totals.gross)}</dd></div>
          </dl>
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-xs font-semibold text-muted-foreground">Płatność i data</legend>
          <label className="space-y-1 text-xs text-muted-foreground">Forma płatności
            <select aria-label="Forma płatności" value={form} onChange={(e) => setForm(Number(e.target.value) as 1 | 2 | 6 | 7)} className={fieldCls}>
              {PAYMENT_FORMS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">Termin płatności
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} disabled={form === 1 || form === 7} className={fieldCls} />
          </label>
          <label className="col-span-2 space-y-1 text-xs text-muted-foreground">Data wykonania usługi
            <input type="date" value={saleDate} max={today} onChange={(e) => setSaleDate(e.target.value)} className={fieldCls} />
          </label>
        </fieldset>

        {problems.length > 0 && (
          <div className="rounded-field border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive-ink" role="alert" data-testid="invoice-problems">
            <ul className="space-y-0.5">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}

        <Button type="button" onClick={() => void issue()} disabled={busy || lines.length === 0} className="w-full coarse:h-11" data-testid="invoice-issue">
          <FileCode2 className="h-4 w-4" aria-hidden />Wystaw fakturę{quickProblems > 0 && " (uzupełnij dane)"}
        </Button>

        {mine.length > 0 && (
          <section aria-label="Wystawione faktury tej budowy" className="space-y-1 border-t border-dashed border-border pt-2" data-testid="invoice-list">
            <h4 className="text-xs font-semibold text-muted-foreground">Wystawione</h4>
            <ul className="space-y-1 text-sm">
              {mine.map((r) => (
                <li key={r.id} className="flex items-center gap-2" data-testid="invoice-item">
                  <span className="min-w-0 flex-1">
                    <span className="font-mono">{r.number}</span>
                    {r.invoice.correction && <span className="ml-1 text-xs text-muted-foreground">korekta do {r.invoice.correction.originalNumber}</span>}
                    {duplicates.has(r.number) && <span className="ml-1 text-xs text-warning-ink">powtórzony numer</span>}
                    {okMap[r.id] === true && <span className="ml-1 text-xs text-success-ink">skrót zgodny</span>}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums">{fromGrosze(computeInvoice(r.invoice).gross)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void check(r)} className="coarse:h-11">Sprawdź</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCorrecting(r)} className="coarse:h-11" aria-label={`Koryguj fakturę ${r.number}`} data-testid="invoice-correct">
                    <FilePen className="h-4 w-4" aria-hidden />Koryguj
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void downloadPdf(r)} className="coarse:h-11" aria-label={`Pobierz PDF faktury ${r.number}`}>
                    <FileText className="h-4 w-4" aria-hidden />PDF
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => download(r)} className="coarse:h-11" aria-label={`Pobierz XML faktury ${r.number}`}>
                    <Download className="h-4 w-4" aria-hidden />XML
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
      <CorrectionDialog record={correcting} onClose={() => setCorrecting(null)} />
    </Dialog>
  );
}
