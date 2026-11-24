import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSitePoints } from "@/lib/study/pointsStore";
import { PATTERN_NAME_MAX, patternFromSite, PATTERNS_MAX, saveSitePattern, undoSitePattern } from "@/lib/study/sitePatterns";
import type { SiteInfo } from "@/lib/study/sites";

/** R4.4: „Zapisz jako wzorzec” — nazwa („Łazienka”, „Kotłownia”), potem etapy i pomieszczenia karty bez stanów. */
export function SavePatternDialog({ site, open, onOpenChange }: { site: SiteInfo; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");

  function save() {
    const clean = name.trim();
    if (!clean) return;
    const p = patternFromSite(clean, site, getSitePoints(site.id), Date.now());
    if (!p) { toast.error("Ta budowa nie ma etapów ani pomieszczeń — nie ma czego zapisać"); return; }
    const res = saveSitePattern(p);
    if (!res.ok) { toast.error(`Masz już ${PATTERNS_MAX} wzorców — usuń któryś przy nowej budowie`); return; }
    toast.success(res.replaced ? `Zastąpiono wzorzec „${p.name}”` : `Zapisano wzorzec „${p.name}”`, { action: { label: "Cofnij", onClick: () => undoSitePattern(p.id, res.replaced) } });
    setName("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" data-testid="save-pattern">
        <DialogHeader>
          <DialogTitle className="font-display">Zapisz jako wzorzec</DialogTitle>
          <DialogDescription>Etapy i pomieszczenia z punktami trafią do nowej budowy — bez odhaczeń, wpisów, zdjęć i pieniędzy.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="pattern-name">Nazwa wzorca</Label>
            <Input id="pattern-name" value={name} maxLength={PATTERN_NAME_MAX} autoFocus onChange={(e) => setName(e.target.value)} placeholder="np. Łazienka, Kotłownia" className="coarse:h-11" />
          </div>
          <Button type="submit" disabled={!name.trim()} className="w-full coarse:h-11">Zapisz wzorzec</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
