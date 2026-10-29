import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { toastWithUndo } from "@/lib/undoToast";
import { cleanKit, KIT_NAME_MAX, kitSummary, type Kit } from "@/lib/study/kits";
import { removeKit, restoreKit, saveKit, useKits } from "@/lib/study/kitsStore";
import type { Fitting } from "@/lib/study/fittings";
import type { Pipe } from "@/lib/study/pipes";
import { FittingsFields } from "./FittingsFields";
import { PipesFields } from "./PipesFields";

const newKit = (): Kit => ({ id: `kit-${crypto.randomUUID()}`, name: "", fittings: [], pipes: [] });

/**
 * Zestawy materiału (H1.2): lista z edycją. Pozycje zestawu edytuje się tymi samymi polami co we wpisie
 * (kształtki, rury z katalogiem). Usunięcie z „Cofnij”.
 */
export function KitsDialog({ open, onOpenChange, fittingHistory, pipeHistory }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fittingHistory: readonly (readonly Fitting[] | undefined)[];
  pipeHistory: readonly (readonly Pipe[] | undefined)[];
}) {
  const { kits, own } = useKits();
  const [editing, setEditing] = useState<Kit | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (kit: Kit) => { setEditing(structuredClone(kit)); setError(null); };
  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError("Wpisz nazwę zestawu."); return; }
    if (!cleanKit(editing)) { setError("Dodaj co najmniej jedną kształtkę albo rurę z długością."); return; }
    if (!saveKit(editing)) { setError("Za dużo zestawów — usuń któryś."); return; }
    setEditing(null);
  };
  const remove = (kit: Kit) => {
    const removed = removeKit(kit.id);
    if (removed) toastWithUndo(`Usunięto zestaw „${removed.name}”`, () => restoreKit(removed), { id: `kit-remove-${kit.id}` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEditing(null); onOpenChange(o); }}>
      <ResponsiveDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl" data-testid="kits-dialog" data-reminder-sheet>
        <div className="pr-8">
          <DialogTitle className="font-display text-lg">Zestawy materiału</DialogTitle>
          <DialogDescription className="text-xs">
            Jedno stuknięcie w zestaw dopisuje do wpisu wszystkie kształtki i rury.{!own && " Na start są przykłady — zmień je pod swoją robotę."}
          </DialogDescription>
        </div>

        {editing ? (
          <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} data-testid="kit-form">
            <div className="space-y-1">
              <Label htmlFor="kit-name">Nazwa</Label>
              <Input id="kit-name" value={editing.name} maxLength={KIT_NAME_MAX} placeholder="np. Podejście umywalki"
                onChange={(e) => { setEditing({ ...editing, name: e.target.value }); setError(null); }} />
            </div>
            <div className="rounded-card border border-border p-2">
              <FittingsFields value={editing.fittings} history={fittingHistory} onChange={(fittings) => { setEditing({ ...editing, fittings }); setError(null); }} />
            </div>
            <div className="rounded-card border border-border p-3">
              <PipesFields value={editing.pipes} history={pipeHistory} onChange={(pipes) => { setEditing({ ...editing, pipes }); setError(null); }} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} className="coarse:h-11">Anuluj</Button>
              <Button type="submit" className="coarse:h-11">Zapisz zestaw</Button>
            </div>
          </form>
        ) : (
          <>
            <ul className="space-y-2" aria-label="Zestawy">
              {kits.map((kit) => (
                <li key={kit.id} className="flex items-center gap-2 rounded-card border border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{kit.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{kitSummary(kit)}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(kit)} aria-label={`Zmień zestaw ${kit.name}`} className="coarse:size-11">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(kit)} aria-label={`Usuń zestaw ${kit.name}`} className="coarse:size-11">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
            {kits.length === 0 && <p className="text-sm text-muted-foreground">Nie masz zestawów. Dodaj pierwszy — np. podejście, które robisz najczęściej.</p>}
            <Button type="button" variant="outline" onClick={() => startEdit(newKit())} className="coarse:h-11">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />Nowy zestaw
            </Button>
          </>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}
