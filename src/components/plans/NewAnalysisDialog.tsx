import { useEffect, useRef, useState } from "react";
import { ImageUp, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { importPlanFile, PlanImportError, type ImportedPlan } from "@/lib/plans/imageImport";
import { PLAN_FILE_BYTES_MAX, PLAN_NAME_MAX } from "@/lib/plans/model";
import { createPlan } from "@/lib/plans/plansStore";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp";
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB`;

/**
 * Nowa analiza: wybór pliku albo przeciągnięcie zrzutu z DWG FastView, podgląd, nazwa. Walidacja po
 * bajtach (`imageSniff.ts`) z czytelnym błędem; „Inny plik” zaczyna od nowa. Obraz trafia do magazynu
 * już przy imporcie — bez „Utwórz” zostaje bez odnośnika i sprząta go `collectGarbage`.
 */
export function NewAnalysisDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (pid: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImportedPlan | null>(null);
  const [name, setName] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) return;
    setPicked((p) => { if (p) URL.revokeObjectURL(p.previewUrl); return null; });
    setError(null);
    setName("");
  }, [open]);

  async function take(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importPlanFile(file);
      setPicked((p) => { if (p) URL.revokeObjectURL(p.previewUrl); return result; });
      setName((n) => n || file.name.replace(/\.[a-z0-9]{2,5}$/i, "").slice(0, PLAN_NAME_MAX));
    } catch (e) {
      setError(e instanceof PlanImportError ? e.message : "Nie udało się wczytać pliku.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function create() {
    if (!picked) return;
    const project = createPlan(name.trim() || "Plan bez nazwy", picked.image, picked.work);
    if (!project) { toast.error("Osiągnięto limit 50 analiz — usuń starsze, żeby dodać nową"); return; }
    onOpenChange(false);
    onCreated(project.id);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-lg" data-testid="plan-new">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="font-display text-lg">Nowa analiza planu</DialogTitle>
          <DialogDescription className="text-xs">
            Zrzut ekranu z DWG FastView (PNG, JPG albo WebP, do {mb(PLAN_FILE_BYTES_MAX)}). Plik zostaje na urządzeniu — nic nie jest wysyłane do zewnętrznych usług.
          </DialogDescription>
        </div>
        <form className="space-y-3 px-5 py-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
          {picked ? (
            <figure className="space-y-1">
              <img src={picked.previewUrl} alt="Podgląd planu" className="max-h-56 w-full rounded-card border border-border/60 bg-white object-contain" />
              <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">{picked.image.w}×{picked.image.h} px · {mb(picked.image.size)}{picked.work ? " · kopia robocza do synchronizacji" : ""}</span>
                <button type="button" onClick={() => input.current?.click()} className="rounded-control px-1.5 py-0.5 font-medium text-primary-ink hover:bg-primary/10 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                  Inny plik
                </button>
              </figcaption>
            </figure>
          ) : (
            <label
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
              className={cn(
                "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-4 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
                over ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              {busy ? <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden /> : <ImageUp className="h-6 w-6 text-muted-foreground" aria-hidden />}
              <span className="font-medium">{busy ? "Wczytuję obraz…" : "Wybierz zrzut planu albo przeciągnij go tutaj"}</span>
              <span className="text-xs text-muted-foreground">Im większa rozdzielczość, tym dokładniejsze pomiary i odczyt opisów.</span>
              <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void take(e.target.files?.[0])} data-testid="plan-file" />
            </label>
          )}
          {picked && <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void take(e.target.files?.[0])} />}
          {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nazwa analizy</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, PLAN_NAME_MAX))}
              placeholder="np. Parter — instalacja wod-kan"
              className="h-10 w-full rounded-field border border-border bg-background px-3 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
            />
          </label>
          <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 pt-1 sm:grid sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy} className="pressable coarse:h-11">Anuluj</Button>
            <Button type="submit" disabled={!picked || busy} className="pressable coarse:h-11">Utwórz analizę</Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
