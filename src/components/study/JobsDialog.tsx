import { useMemo } from "react";
import { Plus, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { money } from "@/lib/study/billing";
import { JOB_STATUS_LABEL, quoteTotals, sortJobs, termLabel, unpaidTotal, type Job } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * Lista „Zlecenia” (H3.4): fuchy od tych, które czekają na termin, przez wyceny, do zapłaconych,
 * z sumą „Niezapłacone” (zrobione, a jeszcze bez zapłaty). Stuknięcie otwiera kartę zlecenia.
 */
export function JobsDialog({ open, onOpenChange, jobs, dir, onOpen, onNew }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: ReadonlyMap<string, Job>;
  dir: readonly SiteInfo[];
  onOpen: (siteId: string) => void;
  onNew: () => void;
}) {
  const rows = useMemo(() => {
    const names = new Map(dir.map((s) => [s.id, s]));
    return sortJobs([...jobs].map(([id, j]) => ({ ...j, id, site: names.get(id) }))).filter((r) => r.site);
  }, [jobs, dir]);
  const unpaid = unpaidTotal(jobs.values());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="jobs-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Zlecenia</DialogTitle>
          <DialogDescription>Twoje fuchy — osobno od budów szefa. Raport do szefa ich nie pokazuje.</DialogDescription>
        </DialogHeader>
        {unpaid > 0 && (
          <p className="rounded-field bg-primary/10 px-3 py-2 text-sm" data-testid="jobs-unpaid">
            Niezapłacone: <span className="font-mono font-semibold tabular-nums">{money(unpaid)}</span>
          </p>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nie masz jeszcze zleceń własnych. Załóż pierwsze — klient, adres i co zrobić.</p>
        ) : (
          <ul className="-mx-1 max-h-[60dvh] space-y-1 overflow-y-auto px-1" aria-label="Lista zleceń">
            {rows.map((r) => {
              const total = quoteTotals(r).total;
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => onOpen(r.id)}
                    className="pressable flex w-full items-center gap-2 rounded-field border border-border px-3 py-2 text-left hover:bg-muted coarse:min-h-11">
                    <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.site!.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.status === "booked" && r.term ? termLabel(r.term) : r.site!.investor || r.scope || "—"}
                      </span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-2xs",
                      r.status === "done" ? "bg-primary/15 font-medium text-primary-ink" : r.status === "paid" ? "text-muted-foreground" : "bg-muted text-foreground")}>
                      {JOB_STATUS_LABEL[r.status]}
                    </span>
                    <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums">{total > 0 ? money(total) : "—"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button type="button" variant="outline" onClick={onNew} className="coarse:h-11"><Plus className="h-4 w-4" aria-hidden />Nowe zlecenie</Button>
      </DialogContent>
    </Dialog>
  );
}
