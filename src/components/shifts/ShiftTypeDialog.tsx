import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SHIFT_COLORS, SHIFT_COLOR_NAMES, deleteShiftType, formatDuration, newShiftId, restoreShiftType, saveShiftType, shiftMinutes, shiftSpan, shiftStore, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { toastWithUndo } from "@/lib/undoToast";

interface ShiftTypeDialogProps {
  /** `null` = nowa zmiana. */
  type: ShiftType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (type: ShiftType) => void;
  onDeleted: () => void;
}

const BLANK: ShiftType = { id: "", name: "", short: "", color: SHIFT_COLORS[3], start: "08:00", end: "16:00", breakMin: 0, kind: "work" };

/**
 * Formularz montuje się z każdym otwarciem (Radix zdejmuje zamknięte
 * `DialogContent`), więc stan startuje od `type` bez efektów, a zmiana
 * danych z zewnątrz nie kasuje tego, co ktoś akurat wpisuje.
 */
export function ShiftTypeDialog({ type, open, onOpenChange, onSaved, onDeleted }: ShiftTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <ShiftTypeForm key={type?.id ?? "new"} type={type} onOpenChange={onOpenChange} onSaved={onSaved} onDeleted={onDeleted} />
      </DialogContent>
    </Dialog>
  );
}

function ShiftTypeForm({ type, onOpenChange, onSaved, onDeleted }: Omit<ShiftTypeDialogProps, "open">) {
  const [draft, setDraft] = useState<ShiftType>(type ?? BLANK);
  const [rate, setRate] = useState(type?.rate ? String(type.rate) : "");
  /** Liczba dni do skasowania, gdy czekamy na drugie kliknięcie „Usuń”. */
  const [confirmDays, setConfirmDays] = useState<number | null>(null);

  const patch = (p: Partial<ShiftType>) => setDraft((d) => ({ ...d, ...p }));
  const valid = draft.name.trim() !== "" && shiftSpan(draft) !== null;
  const parsedRate = parseFloat(rate.replace(",", "."));
  const absence = draft.kind === "absence";

  function remove() {
    if (!type) return;
    const used = Object.values(shiftStore.get().days).filter((e) => e.type === type.id).length;
    // Pierwsze kliknięcie tylko uzbraja przycisk — usuwa się cała historia tego rodzaju.
    if (used > 0 && confirmDays === null) { setConfirmDays(used); return; }
    const removed = deleteShiftType(type.id);
    onDeleted();
    onOpenChange(false);
    if (!removed) return;
    toastWithUndo(`Usunięto „${type.name}”`, () => restoreShiftType(removed), {
      description: used > 0 ? `Razem z ${used} ${pluralPl(used, ["dniem", "dniami", "dniami"])} w grafiku` : undefined,
      icon: "🗑️",
    });
  }

  function save() {
    if (!valid) return;
    const saved: ShiftType = {
      ...draft,
      id: draft.id || newShiftId("s"),
      name: draft.name.trim(),
      short: (draft.short.trim() || draft.name.trim()[0]).slice(0, 3).toUpperCase(),
      breakMin: Math.max(0, Math.round(draft.breakMin) || 0),
      kind: draft.kind ?? "work",
      rate: !absence && Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
    };
    saveShiftType(saved);
    onSaved(saved);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">{type ? "Edytuj rodzaj zmiany" : "Nowy rodzaj zmiany"}</DialogTitle>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-name">Nazwa</Label>
            <Input id="shift-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="np. Ranna" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-short">Skrót</Label>
            <Input id="shift-short" value={draft.short} maxLength={3} onChange={(e) => patch({ short: e.target.value })} placeholder="R" />
          </div>
        </div>
        <div role="radiogroup" aria-label="Rodzaj" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted/60">
          {([["work", "Praca"], ["absence", "Nieobecność"]] as const).map(([kind, label]) => {
            const active = (draft.kind ?? "work") === kind;
            return (
              <button key={kind} type="button" role="radio" aria-checked={active} onClick={() => patch({ kind })}
                className={cn("pressable h-9 coarse:h-11 rounded-lg text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            );
          })}
        </div>
        {absence && (
          <p className="text-xs text-muted-foreground -mt-2">
            Urlop, L4 itp. — nie liczy się do przepracowanych godzin, ale obniża normę miesiąca o czas poniżej.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-start">Od</Label>
            <Input id="shift-start" type="time" value={draft.start} onChange={(e) => patch({ start: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-end">Do</Label>
            <Input id="shift-end" type="time" value={draft.end} onChange={(e) => patch({ end: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-break">Przerwa</Label>
            <Input id="shift-break" type="number" min={0} step={5} inputMode="numeric" value={draft.breakMin}
              onChange={(e) => patch({ breakMin: Number(e.target.value) })} aria-describedby="shift-break-unit" />
            <span id="shift-break-unit" className="sr-only">minut</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {absence ? "Obniża normę o:" : "Czas pracy:"} <span className="font-semibold text-foreground">{formatDuration(shiftMinutes(draft))}</span>
        </p>
        {type && (type.start !== draft.start || type.end !== draft.end || type.breakMin !== draft.breakMin) && (
          <p className="text-xs text-muted-foreground -mt-2">Nowe godziny od dziś — dni wcześniejsze zachowają dotychczasowe.</p>
        )}
        {!absence && <div className="space-y-1.5">
          <Label htmlFor="shift-rate">Stawka za godzinę (opcjonalnie)</Label>
          <Input id="shift-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="jak domyślna" />
        </div>}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Kolor</legend>
          <div className="flex gap-2 flex-wrap pt-1">
            {SHIFT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => patch({ color: c })} aria-label={SHIFT_COLOR_NAMES[c]} aria-pressed={draft.color === c}
                className={cn("pressable w-8 h-8 coarse:w-10 coarse:h-10 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring ring-offset-2 ring-offset-background",
                  draft.color === c && "ring-2 ring-foreground")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </fieldset>
        <DialogFooter className="gap-2 sm:justify-between">
          {type ? (
            <Button type="button" variant={confirmDays === null ? "ghost" : "destructive"}
              className={cn(confirmDays === null && "text-destructive hover:text-destructive")} onClick={remove}>
              {confirmDays === null ? "Usuń rodzaj" : `Usunąć z ${confirmDays} ${pluralPl(confirmDays, ["dniem", "dniami", "dniami"])}?`}
            </Button>
          ) : <span />}
          <Button type="submit" disabled={!valid}>Zapisz rodzaj</Button>
        </DialogFooter>
      </form>
    </>
  );
}
