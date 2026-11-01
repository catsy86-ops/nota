import { useCallback, useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { NoteImage } from "@/components/NoteImage";
import { imageStore } from "@/lib/imageStore";
import { setSiteSignature } from "@/lib/study/store";
import { SIGNATURE_NAME_MAX, type SiteSignature } from "@/lib/study/signature";
import type { SiteInfo } from "@/lib/study/store";
import { toastWithUndo } from "@/lib/undoToast";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

const longDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

/**
 * P2.4: podpis klienta na protokole odbioru. Klient podpisuje palcem na telefonie wykonawcy; obraz
 * idzie do `imageStore`, karta budowy dostaje klucz, imię i moment (`setSiteSignature`). Gotowy podpis
 * można obejrzeć, złożyć od nowa albo usunąć (z „Cofnij” — bajty zostają do sprzątania, najpóźniej 7 dni od zapisu).
 */
export function SiteSignatureDialog({ site, open, onOpenChange }: { site: SiteInfo; open: boolean; onOpenChange: (open: boolean) => void }) {
  const current = site.signature;
  const [redo, setRedo] = useState(false);
  const [name, setName] = useState("");
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const signing = !current || redo;

  // Każde otwarcie zaczyna od czystego pola; imię podpowiada inwestor z karty (albo poprzedni podpisujący).
  useEffect(() => {
    if (!open) return;
    setRedo(false);
    setEmpty(true);
    setName(current?.name || site.investor);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- tylko przy otwarciu

  const onPadChange = useCallback((e: boolean) => setEmpty(e), []);

  async function save() {
    const blob = await pad.current?.toBlob();
    if (!blob) return;
    setSaving(true);
    try {
      const image = await imageStore.putBlob(blob);
      setSiteSignature(site.id, { image, name: name.trim(), at: Date.now() });
      toast.success("Zapisano podpis — jest na protokole");
      onOpenChange(false);
    } catch {
      toast.error("Nie udało się zapisać podpisu — brak miejsca na urządzeniu?");
    } finally {
      setSaving(false);
    }
  }

  function remove(sig: SiteSignature) {
    setSiteSignature(site.id, null);
    onOpenChange(false);
    toastWithUndo("Usunięto podpis z protokołu", () => setSiteSignature(site.id, sig));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-md" data-testid="site-signature">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <PenLine className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />Podpis klienta
          </DialogTitle>
          <DialogDescription className="text-xs">
            Podpis trafia na protokół odbioru „{site.name}” (wydruk i PDF). Zostaje w karcie budowy i w kopii danych, nie w paczce ZIP. Usunięcie zdejmie go z protokołu na wszystkich urządzeniach, ale nie z kopii danych ani PDF-ów zapisanych wcześniej.
          </DialogDescription>
        </div>

        {signing ? (
          <form className="space-y-3 px-5 py-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Imię i nazwisko podpisującego</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, SIGNATURE_NAME_MAX))}
                autoComplete="off"
                placeholder="np. Jan Kowalski"
                className="h-10 w-full rounded-field border border-border bg-background px-3 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
              />
            </label>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium" id="signature-pad-hint">Podpis</span>
                <button type="button" onClick={() => pad.current?.clear()} disabled={empty}
                  className="relative rounded-control px-1.5 py-0.5 text-xs font-medium text-primary-ink hover:bg-primary/10 disabled:text-muted-foreground disabled:hover:bg-transparent outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:after:absolute coarse:after:-inset-2 coarse:after:content-['']">
                  Wyczyść
                </button>
              </div>
              <SignaturePad ref={pad} onChange={onPadChange} label="Pole podpisu — podpisz palcem albo myszą nad linią" />
              <p className="text-xs text-muted-foreground">Podaj telefon klientowi — podpisuje palcem nad linią.</p>
            </div>
            <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 pt-1 sm:grid sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => (redo ? setRedo(false) : onOpenChange(false))} disabled={saving} className="pressable coarse:h-11">
                {redo ? "Wróć" : "Anuluj"}
              </Button>
              <Button type="submit" disabled={empty || saving} className="pressable coarse:h-11">
                {saving ? "Zapisuję…" : "Zapisz podpis"}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <figure className="rounded-card border border-border/70 bg-white px-4 pb-2 pt-3" data-testid="site-signature-current">
              <NoteImage imageRef={current.image} loading="eager" alt={`Podpis: ${current.name || "inwestor"}`}
                className="mx-auto h-24 w-auto max-w-full object-contain" placeholderClassName="h-24" />
              <figcaption className="border-t border-[#1f2a44]/35 pt-1 text-center text-xs text-[#3a4358]">
                {current.name || "Inwestor"} · {longDate(current.at)}
              </figcaption>
            </figure>
            <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 sm:grid sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => remove(current)} className="pressable coarse:h-11">Usuń podpis</Button>
              <Button type="button" onClick={() => setRedo(true)} className="pressable coarse:h-11">Podpisz od nowa</Button>
            </ResponsiveDialogFooter>
          </div>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}
