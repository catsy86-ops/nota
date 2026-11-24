import { useMemo, useState } from "react";
import { FileArchive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { downloadBlob } from "@/lib/downloadBlob";
import { useInvoices } from "@/lib/ksef/invoicesStore";
import { pluralPl } from "@/lib/plural";
import { accountantPasswordOk, accountantPlan, accountantZipName, buildAccountantZip } from "@/lib/study/accountantExport";
import { monthKeyOf } from "@/lib/study/quoteReview";
import { useMileage } from "@/lib/study/companyPrefs";
import type { SiteInfo } from "@/lib/study/sites";
import { passwordStrength } from "@/lib/vault";

/** Domyślnie poprzedni miesiąc — księgowa rozlicza miesiąc po jego końcu. */
function previousMonth(now = new Date()): string {
  return monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
}

/**
 * R3.5 „Dla księgowej”: wybór miesiąca i hasła, potem jeden ZIP (AES-256) z fakturami XML i PDF, rejestrem
 * faktur i kilometrówką. Generator PDF i biblioteka ZIP ładują się dopiero po stuknięciu „Zapisz”.
 */
export function AccountantExportDialog({ open, onOpenChange: setOpen, dir }: { open: boolean; onOpenChange: (o: boolean) => void; dir: readonly SiteInfo[] }) {
  const invoices = useInvoices();
  const mileage = useMileage();
  const [monthKey, setMonthKey] = useState(previousMonth);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);
  // Hasło nie zostaje w pamięci okna po zamknięciu.
  const onOpenChange = (o: boolean) => { if (!o) setPassword(""); setOpen(o); };
  // Ten sam plan liczy liczniki w oknie i pliki w ZIP-ie — nie mogą się rozjechać.
  const plan = useMemo(() => {
    const names = new Map(dir.map((s) => [s.id, s.name]));
    return accountantPlan({ monthKey, invoices, mileage: mileage.entries, siteName: (id) => names.get(id) ?? id });
  }, [monthKey, invoices, mileage, dir]);
  const count = plan?.invoices.length ?? 0;
  const trips = plan?.trips.length ?? 0;

  async function save() {
    setBusy(true);
    try {
      const { buildInvoicePdf } = await import("@/lib/ksef/invoicePdf");
      const zip = await buildAccountantZip(plan!, password, async (r) => new Uint8Array(await (await buildInvoicePdf(r)).arrayBuffer()));
      downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), accountantZipName(monthKey));
      toast.success("Zapisano paczkę dla księgowej", { description: "Hasło przekaż osobno, np. telefonicznie." });
      onOpenChange(false);
    } catch {
      toast.error("Nie udało się przygotować paczki");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="accountant-export">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <FileArchive className="size-5 shrink-0 text-primary-ink" aria-hidden />Dla księgowej
          </DialogTitle>
          <DialogDescription className="text-xs">Faktury (XML i PDF), rejestr faktur i kilometrówka za miesiąc w jednym ZIP-ie z hasłem.</DialogDescription>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            Miesiąc
            <Input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} className="w-40 coarse:h-11" data-testid="accountant-month" />
          </label>
          <p className="text-sm" role="status" data-testid="accountant-count">
            {!plan ? "W tym miesiącu nie ma faktur ani kilometrówki." : `${count} ${pluralPl(count, ["faktura", "faktury", "faktur"])} · ${trips} ${pluralPl(trips, ["dzień", "dni", "dni"])} w kilometrówce`}
          </p>
          <div className="space-y-1">
            <Label htmlFor="accountant-pw" className="text-xs text-muted-foreground">
              Hasło do ZIP-a: co najmniej „Dobre” (14+ znaków, małe i duże litery, cyfry lub znaki). ZIP otworzy 7-Zip albo WinRAR; hasła nie da się odzyskać.
            </Label>
            <Input id="accountant-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Hasło do paczki" className="coarse:h-11" />
            {password && <p className="ui-hint" role="status">{strength.label}</p>}
          </div>
        </div>
        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 px-5 pb-5">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="pressable coarse:h-11">Anuluj</Button>
          <Button type="button" disabled={busy || !plan || !accountantPasswordOk(password)} onClick={() => void save()} data-testid="accountant-save" className="pressable coarse:h-11">
            {busy ? "Przygotowuję…" : "Zapisz ZIP"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
