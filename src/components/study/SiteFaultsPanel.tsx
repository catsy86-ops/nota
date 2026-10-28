import { useState } from "react";
import { Camera, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { cn } from "@/lib/utils";
import { dayKeyOf } from "@/lib/study/report";
import { daysToDue, faultStatus, openFaults } from "@/lib/study/faults";
import { setProblemFault } from "@/lib/study/store";
import type { JournalEntry } from "@/lib/study/yStudy";
import type { SiteInfo } from "@/lib/study/sites";
import { pluralPl } from "@/lib/plural";
import { photoSaveFailed } from "@/components/study/useJournalPhotoEdits";

/** Ile dni do terminu, po polsku: „za 3 dni”, „dziś”, „po terminie 2 dni”. */
function dueText(n: number | null): string {
  if (n === null) return "bez terminu";
  if (n === 0) return "termin dziś";
  if (n > 0) return `termin za ${n} ${pluralPl(n, ["dzień", "dni", "dni"])}`;
  return `po terminie ${-n} ${pluralPl(-n, ["dzień", "dni", "dni"])}`;
}

/**
 * P2.3 Usterki w karcie budowy: otwarte problemy z odpowiedzialnym, terminem i zdjęciami przed (wpis)
 * i po naprawie. Termin po terminie jest czerwony. Zmiany zapisują się od razu (bez „Zapisz”).
 */
/** `journal` z rodzica (karta ma już stan Nauki) — bez własnej subskrypcji, bo ta psuła kolejny widok w teście. */
export function SiteFaultsPanel({ site, journal }: { site: SiteInfo; journal: JournalEntry[] }) {
  const today = dayKeyOf(Date.now());
  const faults = openFaults(journal, site.id);
  const [busy, setBusy] = useState<string | null>(null);

  async function addAfterPhoto(id: string, file: File, current: string[] | undefined) {
    setBusy(id);
    try {
      const prepared = await prepareImage(file);
      if (!prepared) { toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB"); return; }
      const ref = await imageStore.putBlob(prepared);
      setProblemFault(id, { after: [...(current ?? []), ref] });
      toast.success("Zdjęcie po naprawie dodane");
    } catch {
      photoSaveFailed();
    } finally {
      setBusy(null);
    }
  }

  if (faults.length === 0) return null;

  return (
    <section aria-label="Usterki budowy" data-testid="site-faults" className="space-y-2 rounded-card border border-border/60 bg-card p-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Wrench className="h-4 w-4" aria-hidden />Usterki ({faults.length})</h3>
      <ul className="space-y-2.5">
        {faults.map((f) => {
          const status = faultStatus(f, today);
          const n = daysToDue(f.due, today);
          const title = f.text.trim().split("\n")[0] || "bez opisu";
          const before = f.images.length;
          const after = f.after?.length ?? 0;
          return (
            <li key={f.id} className="space-y-2 rounded-field border border-border/50 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-medium">{title}</p>
                <span className={cn("shrink-0 rounded-control px-2 py-0.5 text-2xs font-semibold", status === "overdue" ? "bg-destructive/10 text-destructive-ink" : "bg-muted text-muted-foreground")}>
                  {dueText(n)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`fault-owner-${f.id}`} className="text-xs text-muted-foreground">Odpowiedzialny</Label>
                  <Input id={`fault-owner-${f.id}`} defaultValue={f.owner ?? ""} maxLength={60} placeholder="np. Marek"
                    onBlur={(e) => { if (e.target.value.trim() !== (f.owner ?? "")) setProblemFault(f.id, { owner: e.target.value }); }} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`fault-due-${f.id}`} className="text-xs text-muted-foreground">Termin</Label>
                  <Input id={`fault-due-${f.id}`} type="date" defaultValue={f.due ?? ""}
                    onChange={(e) => setProblemFault(f.id, { due: e.target.value || null })} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">Przed: {before} · po naprawie: {after}</span>
                <label className={cn("pressable inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-border/60 px-2.5 text-xs font-medium hover:bg-muted coarse:h-11", busy === f.id && "pointer-events-none opacity-60")}>
                  <Camera className="h-4 w-4" aria-hidden />{busy === f.id ? "Zapisuję…" : "Zdjęcie po naprawie"}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy !== null}
                    onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void addAfterPhoto(f.id, file, f.after); }} />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
