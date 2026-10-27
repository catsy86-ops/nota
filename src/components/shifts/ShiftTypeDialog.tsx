import { useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ABSENCE_KINDS, DEFAULT_SHIFT_TYPES, NEW_SHIFT_COLORS, SHIFT_COLORS, SHIFT_COLOR_NAMES, absenceKindOf, breakOffset, deleteShiftType, formatDuration, newShiftId, restoreShiftType, saveShiftType, shiftMinutes, shiftSpan, shiftStore, type AbsenceKind, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { IS_TOUCH } from "@/lib/platform";
import { toastWithUndo } from "@/lib/undoToast";

interface ShiftTypeDialogProps {
  /** `null` = nowa zmiana. */
  type: ShiftType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (type: ShiftType) => void;
  onDeleted: () => void;
}

const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = { leave: "Urlop", sick: "L4", other: "Inna" };

/** Zmiana dłuższa niż to, zwykle to pomyłka w godzinach — pokazujemy ostrzeżenie w oknie rodzaju. */
const LONG_SHIFT_MINUTES = 16 * 60;

const BLANK: ShiftType = { id: "", name: "", short: "", color: SHIFT_COLORS[3], start: "08:00", end: "16:00", breakMin: 0, kind: "work" };

/**
 * Formularz montuje się z każdym otwarciem (Radix zdejmuje zamknięte
 * `DialogContent`), więc stan startuje od `type` bez efektów, a zmiana
 * danych z zewnątrz nie kasuje tego, co ktoś akurat wpisuje.
 */
export function ShiftTypeDialog({ type, open, onOpenChange, onSaved, onDeleted }: ShiftTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-sm">
        <ShiftTypeForm key={type?.id ?? "new"} type={type} onOpenChange={onOpenChange} onSaved={onSaved} onDeleted={onDeleted} />
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function ShiftTypeForm({ type, onOpenChange, onSaved, onDeleted }: Omit<ShiftTypeDialogProps, "open">) {
  const [draft, setDraft] = useState<ShiftType>(type ?? BLANK);
  const [rate, setRate] = useState(type?.rate ? String(type.rate) : "");
  /** Liczba dni do skasowania, gdy czekamy na drugie kliknięcie „Usuń”. */
  const [confirmDays, setConfirmDays] = useState<number | null>(null);

  const patch = (p: Partial<ShiftType>) => setDraft((d) => ({ ...d, ...p }));
  // Godzina przerwy liczy się tylko przy przerwie dłuższej niż 0 i musi mieścić się w zmianie.
  const placedBreak = draft.kind !== "absence" && draft.breakMin > 0 && !!draft.breakAt;
  const breakOutside = placedBreak && breakOffset(draft) === null;
  // Ta sama godzina na początku i końcu to nie zmiana 24 h — zapis wymaga różnych godzin.
  const sameHours = draft.kind !== "absence" && draft.start === draft.end;
  const valid = draft.name.trim() !== "" && shiftSpan(draft) !== null && !breakOutside && !sameHours;
  const parsedRate = parseFloat(rate.replace(",", "."));
  const absence = draft.kind === "absence";
  // Nowy rodzaj: gotowe rodzaje startowe, których nie ma w grafiku (np. usunięte albo „Budowa” z nowszej wersji).
  const presets = type ? [] : DEFAULT_SHIFT_TYPES.filter((p) => !shiftStore.get().types.some((t) => t.id === p.id));

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
      breakAt: placedBreak ? draft.breakAt : undefined,
      kind: draft.kind ?? "work",
      absenceKind: absence ? absenceKindOf({ ...draft, kind: "absence" }) : undefined,
      rate: !absence && Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
      alarmMin: !absence && draft.alarmMin !== undefined ? draft.alarmMin : undefined,
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
        {presets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Gotowe</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p.id} type="button" onClick={() => { setDraft({ ...p }); setRate(""); }}
                  className="pressable flex items-center gap-1.5 h-8 coarse:h-11 px-2.5 rounded-field border border-border/60 bg-card hover:bg-muted text-xs font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                  <span className="text-muted-foreground tabular-nums">{p.kind === "absence" ? "nieobecność" : `${p.start}–${p.end}`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-[1fr_5rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="shift-name">Nazwa</Label>
            <Input id="shift-name" value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="np. Ranna" autoFocus={!IS_TOUCH} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift-short">Skrót</Label>
            <Input id="shift-short" value={draft.short} maxLength={3} onChange={(e) => patch({ short: e.target.value })} placeholder="R" />
          </div>
        </div>
        <ToggleGroup aria-label="Rodzaj" value={draft.kind ?? "work"} onValueChange={(v) => patch({ kind: v as "work" | "absence" })}>
          <ToggleGroupItem value="work">Praca</ToggleGroupItem>
          <ToggleGroupItem value="absence">Nieobecność</ToggleGroupItem>
        </ToggleGroup>
        {absence && (
          <ToggleGroup
            aria-label="Rodzaj nieobecności"
            value={absenceKindOf({ ...draft, kind: "absence" }) ?? ""}
            onValueChange={(v) => patch({ absenceKind: v as (typeof ABSENCE_KINDS)[number] })}
          >
            {ABSENCE_KINDS.map((k) => (
              <ToggleGroupItem key={k} value={k}>{ABSENCE_KIND_LABELS[k]}</ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
        {absence && (
          <p className="text-xs text-muted-foreground">
            Nie liczy się do przepracowanych godzin, ale obniża normę miesiąca o czas poniżej. Urlop trafia też do licznika urlopu.
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
        {!absence && draft.breakMin > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="shift-break-at">Przerwa od (opcjonalnie)</Label>
            <Input id="shift-break-at" type="time" value={draft.breakAt ?? ""} className="w-32"
              onChange={(e) => patch({ breakAt: e.target.value || undefined })}
              aria-invalid={breakOutside} aria-describedby="shift-break-at-hint" />
            <p id="shift-break-at-hint" className={cn("text-xs", breakOutside ? "text-destructive-ink" : "text-muted-foreground")}>
              {breakOutside
                ? "Przerwa musi się zmieścić w godzinach zmiany."
                : "Z godziną przerwa nie liczy się do pory nocnej i dokładniej wyznacza nadgodziny. Bez niej skraca koniec zmiany."}
            </p>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {absence ? "Obniża normę o:" : "Czas pracy:"} <span className="font-semibold text-foreground">{formatDuration(shiftMinutes(draft))}</span>
          {!absence && draft.end < draft.start && <span className="text-foreground"> · koniec następnego dnia (+1 dzień)</span>}
        </p>
        {!absence && shiftMinutes(draft) > LONG_SHIFT_MINUTES && (
          <p className="text-xs text-destructive-ink">Zmiana dłuższa niż 16 h — sprawdź godziny (koniec mógł być wpisany tego samego dnia zamiast następnego).</p>
        )}
        {type && (type.start !== draft.start || type.end !== draft.end || type.breakMin !== draft.breakMin || (type.breakAt ?? "") !== (placedBreak ? draft.breakAt : "")) && (
          <p className="text-xs text-muted-foreground">Nowe godziny od dziś — dni wcześniejsze zachowają dotychczasowe.</p>
        )}
        {!absence && <div className="space-y-1.5">
          <Label htmlFor="shift-alarm">Alarm w kalendarzu (.ics)</Label>
          <select id="shift-alarm" value={draft.alarmMin ?? ""} onChange={(e) => patch({ alarmMin: e.target.value === "" ? undefined : Number(e.target.value) })}
            className="w-full h-10 coarse:h-11 rounded-field border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">Domyślny (60 min przed)</option>
            <option value={0}>Bez alarmu</option>
            {[15, 30, 60, 90, 120, 180, 720].map((m) => (
              <option key={m} value={m}>{m >= 60 ? `${m / 60} h przed` : `${m} min przed`}</option>
            ))}
          </select>
        </div>}
        {!absence && <div className="space-y-1.5">
          <Label htmlFor="shift-rate">Stawka za godzinę (opcjonalnie)</Label>
          <Input id="shift-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="jak domyślna" />
        </div>}
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Kolor</legend>
          <div className="flex gap-2 flex-wrap pt-1">
            {(type ? SHIFT_COLORS : NEW_SHIFT_COLORS).map((c) => (
              <button key={c} type="button" onClick={() => patch({ color: c })} aria-label={SHIFT_COLOR_NAMES[c]} aria-pressed={draft.color === c}
                className={cn("pressable w-8 h-8 coarse:w-10 coarse:h-10 rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring ring-offset-2 ring-offset-background",
                  draft.color === c && "ring-2 ring-foreground")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </fieldset>
        {!valid && !breakOutside && (
          <p role="alert" className="text-xs text-destructive-ink">
            {draft.name.trim() === "" ? "Podaj nazwę rodzaju zmiany." : "Godzina rozpoczęcia i końca muszą się różnić — zmiana 24 h nie jest zapisywana po cichu."}
          </p>
        )}
        <ResponsiveDialogFooter className="gap-2 sm:justify-between">
          {type ? (
            <Button type="button" variant={confirmDays === null ? "ghost" : "destructive"}
              className={cn(confirmDays === null && "text-destructive-ink hover:text-destructive-ink")} onClick={remove}>
              {confirmDays === null ? "Usuń rodzaj" : `Usunąć z ${confirmDays} ${pluralPl(confirmDays, ["dniem", "dniami", "dniami"])}?`}
            </Button>
          ) : <span />}
          <Button type="submit" disabled={!valid}>Zapisz rodzaj</Button>
        </ResponsiveDialogFooter>
      </form>
    </>
  );
}
