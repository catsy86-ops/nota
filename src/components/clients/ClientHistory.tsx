import { useMemo } from "react";
import { ChevronRight, HandCoins } from "lucide-react";
import { pluralPl } from "@/lib/plural";
import { dmyKey, money } from "@/lib/study/billing";
import { JOB_STATUS_LABEL } from "@/lib/study/jobs";
import { useJobs } from "@/lib/study/jobsStore";
import { useSiteDirectory } from "@/lib/study/studyProjection";
import { foldName } from "@/lib/study/siteKey";
import { useInvoices } from "@/lib/ksef/invoicesStore";
import { balances, formatAmount } from "@/lib/debts/model";
import { useDebts } from "@/lib/debts/store";
import { clientHistory } from "@/lib/clients/history";
import type { Client } from "@/lib/clients/model";


/**
 * Historia klienta (plan wycen i klientów, 2.3–2.4): budowy i zlecenia z wyceną, faktury, otwarte zgłoszenia serwisowe,
 * gwarancja i — tylko do odczytu — saldo z Długów, gdy osoba o tej samej nazwie jest w Długach. Wszystko liczone
 * z danych, które aplikacja już ma; nic nowego nie jest zapisywane.
 */
export function ClientHistory({ client, siteIds, onOpenSite, onOpenDebts }: {
  client: Client;
  siteIds: readonly string[];
  onOpenSite?: (siteId: string) => void;
  onOpenDebts?: () => void;
}) {
  const dir = useSiteDirectory();
  const jobs = useJobs();
  const invoices = useInvoices();
  const debts = useDebts();
  const history = useMemo(() => clientHistory(siteIds, dir, jobs, invoices), [siteIds, dir, jobs, invoices]);
  const person = useMemo(() => {
    const key = foldName(client.name);
    return key ? balances(debts).find((p) => foldName(p.name) === key) : undefined;
  }, [debts, client.name]);

  if (history.rows.length === 0 && !person) {
    return <p className="ui-hint" data-testid="client-history-empty">Brak budów tego klienta. Wybierz go w polu „Inwestor” na karcie budowy albo przy nowym zleceniu.</p>;
  }

  return (
    <section className="space-y-2" aria-label="Historia klienta" data-testid="client-history">
      {history.rows.length > 0 && (
        <>
          <p className="ui-meta flex flex-wrap gap-x-3 gap-y-1" data-testid="client-history-summary">
            {history.unpaid > 0 && <span>Niezapłacone: <span className="font-mono font-semibold tabular-nums text-foreground">{money(history.unpaid)}</span></span>}
            <span>{history.invoiceCount} {pluralPl(history.invoiceCount, ["faktura", "faktury", "faktur"])}</span>
            {history.openService > 0 && <span>Serwis otwarty: {history.openService}</span>}
          </p>
          <ul className="space-y-1" aria-label="Budowy klienta">
            {history.rows.map((r) => {
              const bits = [
                r.job && `${JOB_STATUS_LABEL[r.job.status]}${r.job.total > 0 ? ` ${money(r.job.total)}` : ""}`,
                r.invoices.length > 0 && `${r.invoices.length} ${pluralPl(r.invoices.length, ["faktura", "faktury", "faktur"])} (${r.invoices[0].number})`,
                r.warranty && `gwarancja do ${dmyKey(r.warranty)}`,
                r.openService > 0 && `serwis: ${r.openService}`,
                r.archived && "archiwum",
              ].filter(Boolean).join(" · ");
              const body = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    {bits && <span className="block truncate text-xs text-muted-foreground">{bits}</span>}
                  </span>
                  {onOpenSite && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                </>
              );
              const cls = "flex w-full items-center gap-2 rounded-field border border-border px-3 py-2 text-left";
              return (
                <li key={r.siteId} data-testid="client-history-row">
                  {onOpenSite
                    ? <button type="button" onClick={() => onOpenSite(r.siteId)} className={`${cls} pressable hover:bg-muted coarse:min-h-11`}>{body}</button>
                    : <div className={cls}>{body}</div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {person && (
        <div className="flex flex-wrap items-center gap-2 rounded-field bg-muted/60 px-3 py-2 text-sm" data-testid="client-debt">
          <HandCoins className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            {person.balance > 0 ? <>W Długach winien Ci <span className="font-mono font-semibold tabular-nums">{formatAmount(person.balance)}</span></>
              : person.balance < 0 ? <>W Długach jesteś winien <span className="font-mono font-semibold tabular-nums">{formatAmount(-person.balance)}</span></>
                : "W Długach: rozliczone"}
          </span>
          {onOpenDebts && <button type="button" onClick={onOpenDebts} className="pressable text-xs underline underline-offset-2 hover:text-foreground coarse:min-h-11">Otwórz Długi</button>}
        </div>
      )}
    </section>
  );
}
