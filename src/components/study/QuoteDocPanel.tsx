import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Hash, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { localDayKey } from "@/lib/dayDone";
import { amountInput, dmyKey, money, parseAmount } from "@/lib/study/billing";
import { useQuoteTerms } from "@/lib/study/companyPrefs";
import { quoteSummary, type Job } from "@/lib/study/jobs";
import { receiveDeposit, revertDeposit } from "@/lib/study/quoteDeposit";
import { ensureQuoteNumber, getJobs, setQuoteDoc } from "@/lib/study/jobsStore";
import {
  cleanDiscount, effectiveValidUntil, QUOTE_NOTES_MAX, QUOTE_STATE_LABEL, QUOTE_VAT_RATES, quoteStamp, quoteState, sinceLabel,
  type QuoteVatMode, type QuoteVatRate,
} from "@/lib/study/quoteDoc";

const fieldCls = "h-9 rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";

/** Kwota albo procent do pola tekstowego: pusty tekst, gdy nie ustawiono. */
const numText = (n?: number): string => (n === undefined ? "" : amountInput(n));

/** Pole nieskontrolowane z zapisem przy wyjściu; zdalna zmiana wartości nie kasuje pisanego tekstu (jak w `SiteJobPanel`). */
function useFieldKey(remote: string) {
  const focused = useRef(false);
  const [shown, setShown] = useState(remote);
  useEffect(() => { if (!focused.current) setShown(remote); }, [remote]);
  return { key: shown, onFocus: () => { focused.current = true; }, onBlurKey: () => { focused.current = false; setShown(remote); } };
}

/**
 * Dokument wyceny dla klienta (plan wycen i klientów, 3.1–3.3, 3.5, 3.6): numer i daty, rabat, VAT, uwagi i warunki, stan
 * (wysłana, przyjęta, odrzucona) oraz akceptacja podpisem. Zapis w `q␁budowa` mapy `studyJobs` (`setQuoteDoc`).
 */
export function QuoteDocPanel({ siteId, job, signed, onSign }: {
  siteId: string;
  job: Job;
  /** Podpis klienta z karty jest ważny dla obecnej treści wyceny (`signatureValidFor`). */
  signed: boolean;
  onSign: () => void;
}) {
  const doc = job.doc;
  const state = quoteState(doc);
  const terms = useQuoteTerms();
  const discountField = useFieldKey(numText(doc?.discount));
  const notesField = useFieldKey(doc?.notes ?? "");
  const depositField = useFieldKey(numText(doc?.deposit));
  const payable = quoteSummary(job).payable;
  const validUntil = effectiveValidUntil(doc);
  const vatMode = doc?.vatMode;

  function giveNumber() {
    const d = ensureQuoteNumber(siteId);
    if (d?.number) { haptic("selection"); toast.success(`Numer wyceny: ${d.number}`); }
  }

  function saveDiscount(input: HTMLInputElement) {
    const raw = input.value.replace(/\s/g, "").replace(/%$/, "").replace(",", ".");
    if (raw === "" || raw === "0") { if (doc?.discount !== undefined) setQuoteDoc(siteId, { discount: undefined }); return; }
    const v = /^\d+(\.\d{1,2})?$/.test(raw) ? cleanDiscount(Number(raw)) : undefined;
    if (v === undefined) {
      toast.error("Rabat: wpisz procent od 0 do 100, np. 10");
      input.value = numText(doc?.discount);
      return;
    }
    if (v !== doc?.discount) setQuoteDoc(siteId, { discount: v });
  }

  /** Zaliczka żądana od klienta: kwota w zł, nie większa niż kwota do zapłaty; pusta zdejmuje. */
  function saveDeposit(input: HTMLInputElement) {
    const v = parseAmount(input.value);
    const restore = () => { input.value = numText(doc?.deposit); };
    if (v === undefined) { toast.error("Zaliczka: wpisz kwotę, np. 500 albo 250,50"); restore(); return; }
    if (v !== null && v > payable) { toast.error(`Zaliczka nie może być większa niż kwota do zapłaty (${money(payable)})`); restore(); return; }
    if ((v ?? undefined) !== doc?.deposit) setQuoteDoc(siteId, { deposit: v ?? undefined });
  }

  function receive() {
    // Wpłata ma numer wyceny w opisie, więc numer powstaje przed nią (jak przy PDF-ie).
    ensureQuoteNumber(siteId);
    const fresh = getJobs().get(siteId) ?? job;
    if (receiveDeposit(siteId, fresh, localDayKey())) { haptic("success"); toast.success(`Zapisano wpłatę zaliczki: ${money(fresh.doc?.deposit ?? 0)}`); }
    else toast.error("Nie udało się zapisać wpłaty zaliczki");
  }

  function setVat(mode: QuoteVatMode | undefined) {
    if (mode === vatMode) return;
    setQuoteDoc(siteId, mode ? { vatMode: mode, vatRate: doc?.vatRate ?? 23 } : { vatMode: undefined, vatRate: undefined });
    haptic("selection");
  }

  function mark(patch: { acceptedAt?: number; rejectedAt?: number; sentAt?: number }) {
    // Dokument ma numer i datę, zanim dostanie stan — tak samo jak przy PDF-ie.
    ensureQuoteNumber(siteId);
    setQuoteDoc(siteId, patch);
    haptic("selection");
  }

  /** Podpis składa się pod wyceną z numerem i datą; podpis złożony przed nadaniem numeru byłby unieważniony zmianą treści. */
  function sign() {
    ensureQuoteNumber(siteId);
    onSign();
  }

  return (
    <div className="space-y-3 border-t border-dashed border-border pt-2.5" data-testid="quote-doc">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground">Dokument wyceny</h4>
        <span
          className={cn("rounded-full px-2 py-0.5 text-2xs", state === "accepted" ? "bg-primary/15 font-medium text-primary-ink" : state === "rejected" ? "bg-destructive/10 text-destructive-ink" : "bg-muted text-foreground")}
          data-testid="quote-state"
        >
          {QUOTE_STATE_LABEL[state]}
          {state !== "draft" && ` ${sinceLabel(quoteStamp(doc))}`}
        </span>
        {doc?.number ? (
          <span className="ml-auto font-mono text-xs tabular-nums" data-testid="quote-number">{doc.number}{doc.issued ? ` · ${dmyKey(doc.issued)}` : ""}</span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={giveNumber} className="ml-auto coarse:h-11" data-testid="quote-give-number">
            <Hash className="h-4 w-4" aria-hidden />Nadaj numer
          </Button>
        )}
      </div>

      {doc?.issued && (
        <label className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">Ważna do</span>
          <input type="date" value={validUntil ?? ""} min={doc.issued} aria-label="Wycena ważna do"
            onChange={(e) => { const v = e.currentTarget.value; if (v) setQuoteDoc(siteId, { validUntil: v }); }}
            className={cn(fieldCls, "w-auto shrink-0 font-mono tabular-nums")} />
        </label>
      )}

      <label className="flex items-center gap-2 text-sm">
        <span className="min-w-0 flex-1">Rabat na całość</span>
        <input
          key={discountField.key}
          defaultValue={numText(doc?.discount)}
          onFocus={discountField.onFocus}
          onBlur={(e) => { saveDiscount(e.currentTarget); discountField.onBlurKey(); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          inputMode="decimal" placeholder="0" aria-label="Rabat na całość (%)"
          className={cn(fieldCls, "w-20 shrink-0 text-right font-mono tabular-nums")}
        />
        <span className="w-8 shrink-0 text-xs text-muted-foreground">%</span>
      </label>

      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="VAT na wycenie">
          {([[undefined, "Bez VAT"], ["net", "Netto + VAT"], ["gross", "Brutto"]] as const).map(([m, label]) => (
            <button key={label} type="button" onClick={() => setVat(m)} aria-pressed={vatMode === m}
              className={cn("pressable min-w-0 truncate rounded-field border px-1.5 py-1.5 text-xs coarse:min-h-11 sm:text-sm",
                vatMode === m ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        {vatMode && (
          <label className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1">{vatMode === "net" ? "Ceny pozycji są netto — VAT dochodzi" : "Ceny pozycji zawierają VAT"}</span>
            <select value={doc?.vatRate ?? 23} aria-label="Stawka VAT"
              onChange={(e) => setQuoteDoc(siteId, { vatRate: Number(e.currentTarget.value) as QuoteVatRate })}
              className={cn(fieldCls, "w-24 shrink-0")}>
              {QUOTE_VAT_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="space-y-1" data-testid="quote-deposit">
        <label className="flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1">Zaliczka przed rozpoczęciem prac</span>
          <input
            key={depositField.key}
            defaultValue={numText(doc?.deposit)}
            onFocus={depositField.onFocus}
            onBlur={(e) => { saveDeposit(e.currentTarget); depositField.onBlurKey(); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            inputMode="decimal" placeholder="0" aria-label="Zaliczka (zł)"
            className={cn(fieldCls, "w-24 shrink-0 text-right font-mono tabular-nums")}
          />
          <span className="w-8 shrink-0 text-xs text-muted-foreground">zł</span>
        </label>
        {doc && (doc.deposit !== undefined || doc.depositPaid !== undefined) && (
          <div className="flex flex-wrap items-center gap-2">
            {doc.depositPaid !== undefined ? (
              <>
                <span className="text-xs" data-testid="deposit-paid">Wpłynęła zaliczka: <span className="font-mono tabular-nums">{money(doc.depositPaid)}</span></span>
                <button type="button" onClick={() => revertDeposit(siteId)} data-testid="deposit-revert"
                  className="pressable text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground coarse:min-h-11">Cofnij wpłatę</button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={receive} className="coarse:h-11" data-testid="deposit-receive">Wpłynęła zaliczka</Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <label htmlFor={`quote-notes-${siteId}`} className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">Uwagi i warunki</label>
          {terms && !doc?.notes && (
            <button type="button" onClick={() => setQuoteDoc(siteId, { notes: terms })} data-testid="quote-terms-insert"
              className="pressable text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground coarse:min-h-11">
              Wstaw domyślne warunki
            </button>
          )}
        </div>
        <textarea
          id={`quote-notes-${siteId}`}
          key={notesField.key}
          defaultValue={doc?.notes ?? ""}
          onFocus={notesField.onFocus}
          maxLength={QUOTE_NOTES_MAX}
          rows={3}
          placeholder="np. Termin realizacji: 5 dni roboczych. Zaliczka 30% przed rozpoczęciem prac."
          onBlur={(e) => { const v = e.currentTarget.value.trim(); if (v !== (doc?.notes ?? "")) setQuoteDoc(siteId, { notes: v || undefined }); notesField.onBlurKey(); }}
          className="w-full rounded-field border border-input bg-background px-2.5 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm"
        />
      </div>

      {job.items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="quote-actions">
          <Button type="button" variant="outline" size="sm" onClick={sign} className="coarse:h-11" data-testid="quote-sign">
            <PenLine className="h-4 w-4" aria-hidden />{signed ? "Podpisana przez klienta" : "Podpis klienta"}
          </Button>
          {state !== "accepted" && (
            <Button type="button" variant="outline" size="sm" onClick={() => mark({ acceptedAt: Date.now() })} className="coarse:h-11" data-testid="quote-accept">
              {signed ? "Oznacz jako przyjętą" : "Klient przyjął"}
            </Button>
          )}
          {state !== "rejected" && state !== "draft" && (
            <Button type="button" variant="outline" size="sm" onClick={() => mark({ rejectedAt: Date.now() })} className="coarse:h-11" data-testid="quote-reject">Klient odrzucił</Button>
          )}
        </div>
      )}
    </div>
  );
}
