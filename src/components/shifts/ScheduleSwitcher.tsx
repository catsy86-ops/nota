import { useState } from "react";
import { Plus, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MAIN_SCHEDULE_ID } from "@/lib/shifts/yShifts";
import { SCHEDULE_NAME_MAX } from "@/lib/shifts/schedules";
import { createSchedule, removeSchedule, renameSchedule, setActiveSchedule, useActiveScheduleId, useSchedules } from "@/lib/shifts/store";

/**
 * Wybór grafiku (np. praca główna i dorobek). Dane każdego grafiku są osobne; tu wybieramy, który
 * widać i do którego trafiają zmiany. Grafik główny nie da się usunąć.
 */
export function ScheduleSwitcher({ overlayId = null, onOverlayChange }: { overlayId?: string | null; onOverlayChange?: (id: string | null) => void } = {}) {
  const schedules = useSchedules();
  const activeId = useActiveScheduleId();
  const [mode, setMode] = useState<"none" | "add" | "rename" | "delete">("none");
  const [name, setName] = useState("");
  const active = schedules.find((s) => s.id === activeId) ?? schedules[0];
  const isMain = active.id === MAIN_SCHEDULE_ID;

  const close = () => { setMode("none"); setName(""); };

  const submitAdd = () => {
    const s = createSchedule(name);
    if (!s) { toast.error("Nie udało się dodać grafiku", { description: "Podaj nazwę albo sprawdź limit grafików." }); return; }
    setActiveSchedule(s.id);
    toast.success(`Dodano grafik: ${s.name}`);
    close();
  };

  const submitRename = () => {
    if (!renameSchedule(active.id, name)) { toast.error("Nie udało się zmienić nazwy"); return; }
    toast.success("Zmieniono nazwę grafiku");
    close();
  };

  const confirmDelete = () => {
    const removedName = active.name;
    if (!removeSchedule(active.id)) return;
    toast.success(`Usunięto grafik: ${removedName}`);
    close();
  };

  return (
    <div role="group" aria-label="Grafik" className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Wybierz grafik"
        value={active.id}
        onChange={(e) => { setActiveSchedule(e.target.value); close(); }}
        className="h-10 coarse:h-11 min-w-0 max-w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
      >
        {schedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {onOverlayChange && (
        <select
          aria-label="Nakładka grafiku"
          value={overlayId ?? ""}
          onChange={(e) => onOverlayChange(e.target.value || null)}
          className="h-10 coarse:h-11 min-w-0 max-w-full rounded-control border border-input bg-background px-3 text-sm"
        >
          <option value="">Bez nakładki</option>
          {schedules.filter((s) => s.id !== active.id).map((s) => <option key={s.id} value={s.id}>Nakładka: {s.name}</option>)}
        </select>
      )}
      {mode === "none" && (
        <>
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => { setName(""); setMode("add"); }}>
            <Plus className="h-4 w-4" aria-hidden /> Nowy grafik
          </Button>
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => { setName(active.name); setMode("rename"); }} aria-label={`Zmień nazwę grafiku ${active.name}`}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          {!isMain && (
            <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => setMode("delete")} aria-label={`Usuń grafik ${active.name}`}>
              <Trash className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </>
      )}
      {(mode === "add" || mode === "rename") && (
        <form className="flex w-full flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (mode === "add") submitAdd(); else submitRename(); }}>
          <Input
            aria-label={mode === "add" ? "Nazwa nowego grafiku" : "Nowa nazwa grafiku"}
            placeholder="np. Dorobek"
            maxLength={SCHEDULE_NAME_MAX}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 coarse:h-11 w-48"
          />
          <Button type="submit" size="sm" disabled={!name.trim()} className="coarse:h-11">{mode === "add" ? "Dodaj" : "Zapisz"}</Button>
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={close}>Anuluj</Button>
        </form>
      )}
      {mode === "delete" && (
        <div role="alertdialog" aria-label="Usuwanie grafiku" className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-destructive/40 p-3 text-sm">
          <span>Usunąć grafik „{active.name}” razem z jego zmianami, cyklami i premiami? Tego nie cofniemy.</span>
          <Button type="button" variant="destructive" size="sm" className="coarse:h-11" onClick={confirmDelete}>Usuń grafik</Button>
          <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={close}>Anuluj</Button>
        </div>
      )}
    </div>
  );
}
