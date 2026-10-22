import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findSiteByName, siteKey, SITE_NAME_MAX, type SiteInfo } from "@/lib/study/sites";
import { saveSiteCard } from "@/lib/study/store";

interface NewSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Budowy już istniejące — do sprawdzenia nazwy. */
  dir: readonly SiteInfo[];
  /** Po zapisie: id nowej budowy (rodzic otwiera jej kartę, żeby dopisać adres i resztę). */
  onCreated: (id: string) => void;
}

/**
 * „Nowa budowa” bez wpisu: sama nazwa, reszta na karcie. Id to `siteKey(nazwa)`, więc ta sama
 * budowa ma to samo id na każdym urządzeniu. Nazwa zajęta przez inną budowę jest odrzucana.
 */
export function NewSiteDialog({ open, onOpenChange, dir, onCreated }: NewSiteDialogProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const clash = trimmed ? findSiteByName(dir, trimmed) : undefined;
  const error = !trimmed ? null : clash ? `Jest już budowa „${clash.name}”` : null;

  function create() {
    if (!trimmed || error) return;
    const id = siteKey(trimmed);
    if (!saveSiteCard(id, { name: trimmed, address: "", investor: "" })) return;
    setName("");
    onCreated(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setName(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Nowa budowa</DialogTitle>
          <DialogDescription>Wystarczy nazwa. Adres, inwestora i resztę dopiszesz na karcie.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3 pt-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="new-site-name">Nazwa budowy</Label>
            <Input id="new-site-name" value={name} maxLength={SITE_NAME_MAX} autoFocus onChange={(e) => setName(e.target.value)} placeholder="np. Lipowa 5" aria-invalid={!!error} aria-describedby={error ? "new-site-error" : undefined} />
            {error && <p id="new-site-error" role="alert" className="text-xs text-destructive-ink">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={!trimmed || !!error}>Utwórz budowę</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
