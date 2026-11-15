import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceDialog } from "@/components/study/InvoiceDialog";
import { useStudyReady } from "@/lib/study/data";
import { useJobs } from "@/lib/study/jobsStore";
import { useSiteDirectory } from "@/lib/study/studyProjection";
import { jobsToInvoice } from "@/lib/study/toInvoice";
import { useInvoices } from "@/lib/ksef/invoicesStore";
import { pluralPl } from "@/lib/plural";

/** R3.3: zlecenia „zrobione” bez faktury, z przyciskiem „Wystaw fakturę” (pozycje z wyceny przenosi okno faktury). */
export function TodayInvoiceDue() {
  const ready = useStudyReady();
  const jobs = useJobs();
  const invoices = useInvoices();
  const dir = useSiteDirectory();
  const [openId, setOpenId] = useState<string | null>(null);
  const due = useMemo(() => jobsToInvoice(jobs, invoices), [jobs, invoices]);
  if (!ready || due.length === 0) return null;
  const open = openId ? due.find((d) => d.siteId === openId) : undefined;
  const site = open ? dir.find((s) => s.id === open.siteId) : undefined;
  return (
    <section aria-label="Do wystawienia" className="rounded-card border border-border bg-card p-4" data-testid="today-invoice-due">
      <h2 className="mb-2 flex items-center gap-1.5 font-display text-base">
        <FileText className="h-4 w-4 text-primary-ink" aria-hidden />Do wystawienia
        <span className="text-xs font-normal text-muted-foreground">{due.length} {pluralPl(due.length, ["zlecenie", "zlecenia", "zleceń"])} bez faktury</span>
      </h2>
      <ul className="space-y-1.5">
        {due.map(({ siteId }) => {
          const name = dir.find((s) => s.id === siteId)?.name ?? siteId;
          return (
            <li key={siteId} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">{name}</span>
              <Button type="button" size="sm" variant="outline" className="pressable shrink-0 coarse:h-11" onClick={() => setOpenId(siteId)}>Wystaw fakturę</Button>
            </li>
          );
        })}
      </ul>
      {open && site && <InvoiceDialog open onOpenChange={(o) => { if (!o) setOpenId(null); }} site={site} job={open.job} />}
    </section>
  );
}
