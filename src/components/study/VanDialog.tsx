import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { toastWithUndo } from "@/lib/undoToast";
import { parseVanQty, VAN_NAME_MAX, VAN_UNITS, vanQtyLabel, vanStock, type VanUnit } from "@/lib/study/van";
import { addVanEvent, removeVanEvent, removeVanItem, restoreVanItem, saveVanItem, useVan } from "@/lib/study/vanStore";
import type { JournalEntry } from "@/lib/study/journalEntry";

const fieldCls = "h-9 rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * H1.3 Materiał w aucie: stan każdej pozycji liczony z historii (inwentaryzacja + przyjęcia − zużycie
 * z wpisów „z auta”), minimum i „Do dokupienia”. „Policz” zapisuje inwentaryzację (stan teraz),
 * „+ Przyjęcie” dokupione sztuki albo metry. Dane w mapie `studyVan` (`vanStore.ts`).
 */
export function VanDialog({ open, onOpenChange, journal }: { open: boolean; onOpenChange: (open: boolean) => void; journal: readonly JournalEntry[] }) {
  const van = useVan();
  const stocks = useMemo(() => van.items.map((i) => vanStock(i, van.events, journal)), [van, journal]);
  const toBuy = stocks.filter((s) => s.toBuy > 0);
  const [action, setAction] = useState<{ item: string; kind: "count" | "in" } | null>(null);
  const [qty, setQty] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<VanUnit>("szt.");
  const [min, setMin] = useState("");
  const [start, setStart] = useState("");

  function saveEvent() {
    if (!action) return;
    const n = parseVanQty(qty);
    if (n === undefined || (action.kind === "in" && n === 0)) { toast.error("Ilość: wpisz liczbę, np. 10 albo 2,5"); return; }
    const ev = { id: newId("e"), item: action.item, kind: action.kind, qty: n, at: Date.now() };
    if (!addVanEvent(ev)) return;
    haptic("success");
    setAction(null);
    setQty("");
    toastWithUndo(action.kind === "count" ? "Zapisano stan z inwentaryzacji" : "Dopisano przyjęcie", () => removeVanEvent(ev));
  }

  function addItem() {
    const n = name.trim();
    if (!n) return;
    const m = min.trim() ? parseVanQty(min) : undefined;
    const s = start.trim() ? parseVanQty(start) : undefined;
    if ((min.trim() && m === undefined) || (start.trim() && s === undefined)) { toast.error("Ilość: wpisz liczbę, np. 10 albo 2,5"); return; }
    const at = Date.now();
    const id = newId("v");
    const order = van.items.reduce((o, i) => Math.max(o, i.order + 1), 0);
    if (!saveVanItem({ id, name: n, unit, ...(m ? { min: m } : {}), at, order })) { toast.error("Nie dodano — za dużo pozycji albo pusta nazwa"); return; }
    if (s !== undefined) addVanEvent({ id: newId("e"), item: id, kind: "count", qty: s, at: at + 1 });
    setName(""); setMin(""); setStart("");
    haptic("selection");
  }

  function drop(id: string) {
    const removed = removeVanItem(id);
    if (removed) toastWithUndo(`Usunięto „${removed.item.name}”`, () => restoreVanItem(removed));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setAction(null); onOpenChange(o); }}>
      <ResponsiveDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="van-dialog">
        <div className="pr-8">
          <DialogTitle className="font-display text-lg">Materiał w aucie</DialogTitle>
          <DialogDescription className="text-xs">Stan liczy się sam: inwentaryzacja + przyjęcia − to, co wpisy „z auta” zużyły po niej.</DialogDescription>
        </div>

        {toBuy.length > 0 && (
          <p className="rounded-field bg-warning/10 px-3 py-2 text-sm" data-testid="van-to-buy">
            Do dokupienia: {toBuy.map((s) => `${s.item.name} ${vanQtyLabel(s.toBuy, s.item.unit)}`).join(", ")}
          </p>
        )}

        {stocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Dodaj to, co wozisz w aucie — kształtki w sztukach, rury w metrach. Nazwy jak we wpisach, żeby zużycie się odliczało.</p>
        ) : (
          <ul className="space-y-1.5" aria-label="Pozycje w aucie">
            {stocks.map((s) => (
              <li key={s.item.id} className="rounded-field border border-border px-2.5 py-2" data-testid="van-item">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.item.name}</span>
                  <span className={cn("shrink-0 font-mono text-sm tabular-nums", s.toBuy > 0 ? "font-semibold text-warning-ink" : "text-foreground")} data-testid="van-qty">
                    {vanQtyLabel(s.qty, s.item.unit)}
                  </span>
                  <button type="button" onClick={() => drop(s.item.id)} aria-label={`Usuń ${s.item.name}`}
                    className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground coarse:size-11">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {s.item.min !== undefined && <span>min. {vanQtyLabel(s.item.min, s.item.unit)}</span>}
                  {s.countedAt && <span>· policzone {new Date(s.countedAt).toLocaleDateString("pl-PL")}</span>}
                  {s.qty < 0 && <span className="text-warning-ink">· zużycie większe niż stan — policz</span>}
                  <span className="flex-1" />
                  <Button type="button" size="sm" variant="outline" className="h-7 coarse:h-11" onClick={() => { setAction({ item: s.item.id, kind: "in" }); setQty(""); }}>+ Przyjęcie</Button>
                  <Button type="button" size="sm" variant="outline" className="h-7 coarse:h-11" onClick={() => { setAction({ item: s.item.id, kind: "count" }); setQty(""); }}>Policz</Button>
                </div>
                {action?.item === s.item.id && (
                  <form className="mt-1.5 flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); saveEvent(); }}>
                    <input autoFocus value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal"
                      aria-label={action.kind === "count" ? `Stan teraz: ${s.item.name} (${s.item.unit})` : `Przyjęcie: ${s.item.name} (${s.item.unit})`}
                      placeholder={action.kind === "count" ? "ile jest teraz" : "ile dokupione"} className={cn(fieldCls, "min-w-0 flex-1 text-right font-mono tabular-nums")} />
                    <span className="text-xs text-muted-foreground">{s.item.unit}</span>
                    <Button type="submit" size="sm" className="coarse:h-11">Zapisz</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="space-y-1.5 rounded-field border border-dashed border-border p-2" onSubmit={(e) => { e.preventDefault(); addItem(); }} aria-label="Nowa pozycja w aucie">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={VAN_NAME_MAX} aria-label="Nazwa pozycji w aucie" placeholder="np. Kolano 16 albo Rura PEX 16×2" className={cn(fieldCls, "w-full")} />
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-1" role="group" aria-label="Jednostka">
              {VAN_UNITS.map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}
                  className={cn("pressable rounded-full border px-2.5 py-0.5 text-xs coarse:min-h-11 coarse:px-3",
                    unit === u ? "border-primary bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground")}>
                  {u}
                </button>
              ))}
            </div>
            <input value={start} onChange={(e) => setStart(e.target.value)} inputMode="decimal" aria-label="Stan teraz" placeholder="stan" className={cn(fieldCls, "w-16 text-right font-mono")} />
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" aria-label="Minimum" placeholder="min." className={cn(fieldCls, "w-16 text-right font-mono")} />
            <Button type="submit" size="sm" variant="outline" disabled={!name.trim()} className="ml-auto coarse:h-11"><Plus className="h-4 w-4" aria-hidden />Dodaj</Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
