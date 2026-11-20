import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NoteImage } from "@/components/NoteImage";
import { attachDebtProof, setDebtProof } from "@/lib/debts/store";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Zdjęcie dowodu przy wpisie długu (L4.3): paragon, przelew, zdjęcie umowy. Przy ukrytych kwotach miniatura i podgląd
 * są rozmyte — zdjęcie przelewu pokazałoby kwotę, którą użytkownik schował.
 */
export function DebtProofThumb({ proofRef, hidden, label }: { proofRef: string; hidden: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Zdjęcie dowodu: ${label}`}
        data-testid="debt-proof-thumb"
        className="pressable size-10 shrink-0 overflow-hidden rounded-field border border-border/60 coarse:size-11"
      >
        <NoteImage imageRef={proofRef} thumb className={cn("size-full object-cover", hidden && "blur-sm")} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-3">
          <DialogTitle className="sr-only">Zdjęcie dowodu</DialogTitle>
          <DialogDescription className="sr-only">{label}{hidden ? " — rozmyte, bo kwoty są ukryte" : ""}</DialogDescription>
          <NoteImage imageRef={proofRef} loading="eager" alt={`Dowód: ${label}`} className={cn("max-h-media w-full rounded-field object-contain", hidden && "blur-xl")} />
          {hidden && <p className="ui-hint text-center">Kwoty są ukryte — zdjęcie też. Pokaż kwoty, żeby je obejrzeć.</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Wiersz w formularzu edycji: dodanie, zamiana i usunięcie (z „Cofnij”). Zapis od razu, niezależnie od „Zapisz zmiany”. */
export function DebtProofField({ entryId, proofRef, hidden }: { entryId: string; proofRef: string | undefined; hidden: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const prev = proofRef ?? null;
      const result = await attachDebtProof(entryId, file);
      if (result === "too-big") { toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB"); return; }
      if (result === "failed") { toast.error("Nie zapisano zdjęcia — wpis mógł zostać usunięty"); return; }
      haptic("tap");
      toast.success(prev ? "Zamieniono zdjęcie dowodu" : "Dodano zdjęcie dowodu", { action: { label: "Cofnij", onClick: () => undo(prev) } });
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki." });
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!proofRef) return;
    setDebtProof(entryId, null);
    toast("Usunięto zdjęcie dowodu", { action: { label: "Cofnij", onClick: () => undo(proofRef) } });
  }

  function undo(ref: string | null) {
    if (!setDebtProof(entryId, ref)) toast.error("Nie da się cofnąć — wpis został usunięty");
  }

  return (
    <div className="flex items-center gap-2" data-testid="debt-proof-field">
      {proofRef && <DebtProofThumb proofRef={proofRef} hidden={hidden} label="ten wpis" />}
      <input ref={input} type="file" accept="image/*" className="hidden" data-testid="debt-proof-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
      <Button type="button" variant="outline" size="sm" className="h-11 gap-1.5" disabled={busy} onClick={() => input.current?.click()}>
        <Camera className="size-4" aria-hidden />
        {busy ? "Zapisuję…" : proofRef ? "Zmień zdjęcie dowodu" : "Zdjęcie dowodu"}
      </Button>
      {proofRef && (
        <Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Usuń zdjęcie dowodu" onClick={remove}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
