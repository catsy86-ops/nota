import { useMemo, useState } from "react";
import { FileCode2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { money } from "@/lib/study/billing";
import { computeInvoice, VAT_RATES, type InvoiceLine, type VatRate } from "@/lib/ksef/invoice";
import { issueCorrection } from "@/lib/ksef/invoicesStore";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";

const fieldCls = "h-9 w-full rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const fromGrosze = (g: number) => money(g / 100);
/** „12,5” albo „12.5” → liczba; puste lub błędne → NaN. */
const parseNum = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(",", ".")));

/**
 * Faktura korygująca (KSeF, ADR-6): z zapisanej faktury powstaje nowa, z pozycjami „przed” (z oryginału) i „po”
 * (edytowane tutaj). Oryginał się nie zmienia. Pusta lista pozycji po korekcie = anulowanie całości.
 */
export function CorrectionDialog({ record, onClose }: { record: InvoiceRecord | null; onClose: () => void }) {
  return (
    <Dialog open={record !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      {record && <CorrectionForm key={record.id} record={record} onClose={onClose} />}
    </Dialog>
  );
}

function CorrectionForm({ record, onClose }: { record: InvoiceRecord; onClose: () => void }) {
  const inv = record.invoice;
  /** `uid` utrzymuje pola formularza przy usuwaniu pozycji (klucz nie może być indeksem). */
  const [rows, setRows] = useState(() => inv.lines.map((l, uid) => ({ uid, line: { ...l } })));
  const lines: InvoiceLine[] = useMemo(() => rows.map((r) => r.line), [rows]);
  const [reason, setReason] = useState("");
  const [type, setType] = useState<1 | 2>(1);
  const [ksef, setKsef] = useState("");
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const totals = useMemo(() => computeInvoice({ lines, priceMode: inv.priceMode, correction: { originalNumber: "", originalIssueDate: "", reason: "", type, linesBefore: inv.lines } }), [lines, inv.priceMode, inv.lines, type]);
  const patch = (i: number, p: Partial<InvoiceLine>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, line: { ...r.line, ...p } } : r)));

  async function issue() {
    setBusy(true);
    setProblems([]);
    try {
      const res = await issueCorrection(record, { lines, reason, type, ksefNumber: ksef, issueDate: localDayKey() });
      if (!res.ok) { setProblems(res.problems.map((p) => p.message)); haptic("warn"); return; }
      haptic("success");
      toast.success(`Wystawiono korektę ${res.record.number}`);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="correction-dialog">
      <DialogHeader>
        <DialogTitle className="font-display">Korekta faktury {record.number}</DialogTitle>
        <DialogDescription>
          Zmień pozycje tak, jak mają wyglądać po korekcie. Faktura {record.number} zostaje bez zmian; powstaje nowa faktura korygująca z różnicą.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-muted-foreground">Pozycje po korekcie ({inv.priceMode === "gross" ? "ceny brutto" : "ceny netto"})</legend>
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Brak pozycji — korekta anuluje całą fakturę.</p>}
        <ul className="space-y-2">
          {rows.map(({ uid, line: l }, i) => (
            <li key={uid} className="space-y-1 rounded-field border border-border p-2" data-testid="correction-line">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))} className="coarse:h-11" aria-label={`Usuń pozycję ${i + 1}`}>
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-0.5 text-xs text-muted-foreground">Ilość ({l.unit})
                  <input inputMode="decimal" defaultValue={String(l.qtyMilli / 1000)} aria-label={`Ilość pozycji ${i + 1}`} onChange={(e) => { const n = parseNum(e.target.value); if (Number.isFinite(n)) patch(i, { qtyMilli: Math.round(n * 1000) }); }} className={cn(fieldCls, "font-mono")} />
                </label>
                <label className="space-y-0.5 text-xs text-muted-foreground">Cena (zł)
                  <input inputMode="decimal" defaultValue={String(l.unitPrice / 100)} aria-label={`Cena pozycji ${i + 1}`} onChange={(e) => { const n = parseNum(e.target.value); if (Number.isFinite(n)) patch(i, { unitPrice: Math.round(n * 100) }); }} className={cn(fieldCls, "font-mono")} />
                </label>
                <label className="space-y-0.5 text-xs text-muted-foreground">VAT
                  <select value={l.rate} aria-label={`Stawka VAT pozycji ${i + 1}`} onChange={(e) => patch(i, { rate: Number(e.target.value) as VatRate })} className={fieldCls}>
                    {VAT_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "0%" : `${r}%`}</option>)}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
        <dl className="space-y-0.5 border-t border-dashed border-border pt-1 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Różnica netto</dt><dd className="font-mono tabular-nums">{fromGrosze(totals.net)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Różnica VAT</dt><dd className="font-mono tabular-nums">{fromGrosze(totals.vat)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Różnica brutto</dt><dd className="font-mono tabular-nums" data-testid="correction-gross">{fromGrosze(totals.gross)}</dd></div>
        </dl>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-muted-foreground">Powód i skutek</legend>
        <input aria-label="Przyczyna korekty" placeholder="Przyczyna korekty, np. rabat, błąd w cenie" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={256} className={fieldCls} />
        <label className="space-y-1 text-xs text-muted-foreground">Skutek w ewidencji VAT
          <select aria-label="Skutek korekty" value={type} onChange={(e) => setType(Number(e.target.value) as 1 | 2)} className={fieldCls}>
            <option value={1}>W dacie faktury pierwotnej (np. błąd)</option>
            <option value={2}>W dacie korekty (np. rabat po sprzedaży)</option>
          </select>
        </label>
        <input aria-label="Numer KSeF faktury korygowanej" placeholder="Numer KSeF faktury korygowanej (jeśli wgrana)" value={ksef} onChange={(e) => setKsef(e.target.value.trim())} className={cn(fieldCls, "font-mono")} />
      </fieldset>

      {problems.length > 0 && (
        <div className="rounded-field border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive-ink" role="alert" data-testid="correction-problems">
          <ul className="space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <Button type="button" onClick={() => void issue()} disabled={busy} className="w-full coarse:h-11" data-testid="correction-issue">
        <FileCode2 className="h-4 w-4" aria-hidden />Wystaw korektę
      </Button>
    </DialogContent>
  );
}
