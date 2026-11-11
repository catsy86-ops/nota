import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { downloadBlob } from "@/lib/downloadBlob";
import { pluralPl } from "@/lib/plural";
import type { SitePackage } from "@/lib/study/sitePackage";
import { applySitePackage, exportSitePackage, importTargets, previewSitePackage } from "@/lib/study/sitePackageIo";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * H5.2 „Wyślij budowę”: plik `.budowa` dla pomocnika (WhatsApp przez systemowe udostępnianie albo
 * pobranie). Zdjęcia domyślnie tak (bez EXIF), kod dostępu domyślnie nie. Ostrzeżenie: adres i zdjęcia.
 */
export function SitePackageExportDialog({ site, open, onOpenChange }: { site: SiteInfo; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [images, setImages] = useState(true);
  const [access, setAccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const r = await exportSitePackage(site.id, { images, access });
      const shareable = typeof navigator.canShare === "function" && navigator.canShare({ files: [r.file] });
      if (shareable) {
        try { await navigator.share({ files: [r.file], title: site.name }); } catch (err) { if ((err as Error)?.name === "AbortError") return; downloadBlob(r.file, r.file.name); }
      } else {
        downloadBlob(r.file, r.file.name);
        toast.success(`Zapisano „${r.file.name}”`, { description: "Wyślij plik pomocnikowi, np. przez WhatsApp." });
      }
      if (r.missingImages > 0) toast.warning(`Bez ${r.missingImages} ${pluralPl(r.missingImages, ["zdjęcia", "zdjęć", "zdjęć"])} — nie ma ich na tym urządzeniu albo są za duże`);
      haptic("success");
      onOpenChange(false);
    } catch {
      toast.error("Nie udało się przygotować pliku budowy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="site-package-export">
        <DialogHeader>
          <DialogTitle className="font-display">Wyślij budowę</DialogTitle>
          <DialogDescription>Plik „{site.name}.budowa” dla pomocnika: etapy, braki, punkty, plan na dziś i wpisy. Bez pieniędzy i telefonów.</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={images} onCheckedChange={(v) => setImages(v === true)} className="mt-0.5" />
          <span>Zdjęcia z wpisów<span className="block text-xs text-muted-foreground">Bez lokalizacji z aparatu. Plik będzie większy.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={access} onCheckedChange={(v) => setAccess(v === true)} className="mt-0.5" />
          <span>Dostęp do budowy<span className="block text-xs text-muted-foreground">Kod do bramy, gdzie klucze — tylko gdy pomocnik ich potrzebuje.</span></span>
        </label>
        <p className="rounded-field bg-warning/10 px-3 py-2 text-xs" role="note">Plik zawiera adres i zdjęcia z wnętrza — wysyłaj tylko pomocnikowi, nie na grupy.</p>
        <Button onClick={send} disabled={busy} className="coarse:h-11"><Send className="h-4 w-4" aria-hidden />{busy ? "Przygotowuję…" : "Wyślij plik"}</Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * H5.2 „Wczytaj budowę”: podgląd paczki od pomocnika — od kogo (niezweryfikowane), do której budowy
 * (wybór, nie po cichu), co dojdzie — i scalenie. Usunięcia nie przechodzą.
 */
export function SitePackageImportDialog({ pkg, onClose, onDone }: { pkg: SitePackage | null; onClose: () => void; onDone: (siteId: string) => void }) {
  const targets = useMemo(() => (pkg ? importTargets(pkg) : null), [pkg]);
  const [pick, setPick] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const index = pick ?? targets?.preferred ?? 0;
  const target = targets?.options[index];
  const plan = useMemo(() => (pkg && target ? previewSitePackage(pkg, target) : null), [pkg, target]);

  async function apply() {
    if (!pkg || !target) return;
    setBusy(true);
    try {
      const r = await applySitePackage(pkg, target);
      haptic("success");
      toast.success(`Wczytano do „${target.name}”: ${r.counts.entries} ${pluralPl(r.counts.entries, ["wpis", "wpisy", "wpisów"])}`,
        r.rejectedImages > 0 ? { description: `Odrzucone zdjęcia: ${r.rejectedImages} (nie obraz albo uszkodzone).` } : undefined);
      setPick(null);
      onDone(target.id);
    } catch {
      toast.error("Nie udało się wczytać budowy");
    } finally {
      setBusy(false);
    }
  }

  const c = plan?.counts;
  const parts = c ? [
    c.entries > 0 && `${c.entries} ${pluralPl(c.entries, ["nowy wpis", "nowe wpisy", "nowych wpisów"])}`,
    c.images > 0 && `${c.images} ${pluralPl(c.images, ["zdjęcie", "zdjęcia", "zdjęć"])}`,
    c.stages > 0 && `etapy: ${c.stages}`,
    c.shortages > 0 && `braki: ${c.shortages}`,
    c.plan > 0 && `plan na dziś: ${c.plan}`,
    c.points > 0 && `punkty: ${c.points}`,
  ].filter(Boolean) : [];

  return (
    <Dialog open={!!pkg} onOpenChange={(o) => { if (!o) { setPick(null); onClose(); } }}>
      <DialogContent className="sm:max-w-md" data-testid="site-package-import">
        <DialogHeader>
          <DialogTitle className="font-display">Wczytaj budowę</DialogTitle>
          <DialogDescription>
            „{pkg?.site.name}” — podpisany jako {pkg?.by ?? "bez imienia"} (niezweryfikowane).
          </DialogDescription>
        </DialogHeader>
        {targets && (
          <fieldset className="space-y-1.5">
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">Scal z</legend>
            {targets.options.map((o, i) => (
              <button key={o.id} type="button" aria-pressed={i === index} onClick={() => setPick(i)}
                className={cn("pressable flex w-full items-center justify-between gap-2 rounded-field border px-3 py-2 text-left text-sm coarse:min-h-11",
                  i === index ? "border-primary bg-primary/10 font-medium" : "border-border text-muted-foreground hover:text-foreground")}>
                <span className="min-w-0 truncate">{o.name}</span>
                <span className="shrink-0 text-xs">{o.exists ? "istniejąca" : "nowa budowa"}</span>
              </button>
            ))}
          </fieldset>
        )}
        <p className="text-sm" data-testid="site-package-summary">{parts.length ? `Dojdzie: ${parts.join(", ")}.` : "Nic nowego — wszystko z pliku już jest."}</p>
        {c && c.dropped > 0 && <p className="text-xs text-warning-ink">Pominięte ponad limity (np. najstarsze wpisy, gdy plik ma ich ponad 500): {c.dropped}.</p>}
        <p className="ui-hint">Pozycje z pliku są podpisane „z pliku”. Usunięcia nie przechodzą — co usunąłeś u siebie, a jest w pliku, wróci.</p>
        <Button onClick={apply} disabled={busy || !parts.length} className="coarse:h-11"><Upload className="h-4 w-4" aria-hidden />{busy ? "Wczytuję…" : "Wczytaj"}</Button>
      </DialogContent>
    </Dialog>
  );
}
