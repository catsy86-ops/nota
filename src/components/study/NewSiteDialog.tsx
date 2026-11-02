import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { findSiteByName, siteKey, SITE_FIELD_MAX, SITE_NAME_MAX, type SiteInfo } from "@/lib/study/sites";
import { SITE_PHONE_MAX } from "@/lib/study/contact";
import { saveSiteCard } from "@/lib/study/store";
import { JOB_SCOPE_MAX } from "@/lib/study/jobs";
import { setJobMeta } from "@/lib/study/jobsStore";
import type { SitePackage } from "@/lib/study/sitePackage";
import { readSitePackageFile } from "@/lib/study/sitePackageIo";
import { toast } from "sonner";

interface NewSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Budowy już istniejące — do sprawdzenia nazwy. */
  dir: readonly SiteInfo[];
  /** Po zapisie: id nowej budowy (rodzic otwiera jej kartę, żeby dopisać adres i resztę). */
  onCreated: (id: string) => void;
  /** Otwarcie od razu jako zlecenie własne (fucha). */
  initialJob?: boolean;
  /** H5.2: wczytany plik `.budowa` — rodzic pokazuje podgląd scalenia. */
  onPackage?: (pkg: SitePackage) => void;
}

const EMPTY = { name: "", client: "", phone: "", address: "", scope: "" };

/**
 * „Nowa budowa” bez wpisu: sama nazwa, reszta na karcie. Id to `siteKey(nazwa)`, więc ta sama
 * budowa ma to samo id na każdym urządzeniu. Nazwa zajęta przez inną budowę jest odrzucana.
 * „Zlecenie własne” (H3.4) to ta sama karta z wpisem w mapie zleceń; szybkie założenie: klient,
 * telefon, adres i co zrobić — wycenę dopisuje się na karcie.
 */
export function NewSiteDialog({ open, onOpenChange, dir, onCreated, initialJob = false, onPackage }: NewSiteDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [job, setJob] = useState(initialJob);
  const trimmed = form.name.trim();
  const clash = trimmed ? findSiteByName(dir, trimmed) : undefined;
  const error = !trimmed ? null : clash ? `Jest już budowa „${clash.name}”` : null;
  const field = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function reset() {
    setForm(EMPTY);
    setJob(initialJob);
  }

  async function pickPackage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const r = await readSitePackageFile(file);
    if (!r.ok) { toast.error(r.error); return; }
    reset();
    onOpenChange(false);
    onPackage?.(r.pkg);
  }

  function create() {
    if (!trimmed || error) return;
    const id = siteKey(trimmed);
    const card = job
      ? { name: trimmed, address: form.address.trim(), investor: form.client.trim(), ...(form.phone.trim() ? { phone: form.phone.trim() } : {}) }
      : { name: trimmed, address: "", investor: "" };
    if (!saveSiteCard(id, card)) return;
    if (job) setJobMeta(id, { scope: form.scope.trim() || undefined });
    reset();
    onCreated(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{job ? "Nowe zlecenie" : "Nowa budowa"}</DialogTitle>
          <DialogDescription>
            {job ? "Klient i co zrobić. Wycenę i termin dopiszesz na karcie." : "Wystarczy nazwa. Adres, inwestora i resztę dopiszesz na karcie."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-1 rounded-field border border-border p-0.5" role="group" aria-label="Rodzaj">
          {([[false, "Budowa szefa"], [true, "Zlecenie własne"]] as const).map(([v, label]) => (
            <button key={label} type="button" aria-pressed={job === v} onClick={() => setJob(v)}
              className={cn("pressable rounded-[calc(var(--radius-field)-2px)] px-2 py-1.5 text-sm coarse:min-h-11",
                job === v ? "bg-primary/12 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>
        <form className="space-y-3 pt-1" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="new-site-name">{job ? "Nazwa zlecenia" : "Nazwa budowy"}</Label>
            <Input id="new-site-name" value={form.name} maxLength={SITE_NAME_MAX} autoFocus onChange={field("name")} placeholder={job ? "np. Kowalski — kran" : "np. Lipowa 5"} aria-invalid={!!error} aria-describedby={error ? "new-site-error" : undefined} />
            {error && <p id="new-site-error" role="alert" className="text-xs text-destructive-ink">{error}</p>}
          </div>
          {job && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-job-client">Klient</Label>
                  <Input id="new-job-client" value={form.client} maxLength={SITE_FIELD_MAX} onChange={field("client")} autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-job-phone">Telefon</Label>
                  <Input id="new-job-phone" value={form.phone} maxLength={SITE_PHONE_MAX} onChange={field("phone")} type="tel" inputMode="tel" autoComplete="off" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-job-address">Adres</Label>
                <Input id="new-job-address" value={form.address} maxLength={SITE_FIELD_MAX} onChange={field("address")} autoComplete="off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-job-scope">Co zrobić</Label>
                <textarea id="new-job-scope" value={form.scope} maxLength={JOB_SCOPE_MAX} rows={2} onChange={field("scope")}
                  placeholder="np. Wymiana baterii w kuchni"
                  className="w-full rounded-field border border-input bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm" />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            {onPackage && !job && (
              <>
                <input ref={fileRef} type="file" accept=".budowa,application/json" className="hidden" onChange={(e) => void pickPackage(e)} data-testid="site-package-file" />
                <Button type="button" variant="ghost" className="mr-auto text-muted-foreground" onClick={() => fileRef.current?.click()} title="Plik .budowa od szefa albo pomocnika">
                  <FileUp className="mr-1.5 h-4 w-4" aria-hidden />Z pliku
                </Button>
              </>
            )}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={!trimmed || !!error}>{job ? "Utwórz zlecenie" : "Utwórz budowę"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
