import { DEFAULT_SHIFT_TYPES } from "@/lib/shifts";

interface NoShiftTypesProps {
  onAdd: () => void;
  onRestore: () => void;
}

/** Grafik bez żadnego rodzaju zmiany: dodaj własny albo przywróć startowe (G3.2). */
export function NoShiftTypes({ onAdd, onRestore }: NoShiftTypesProps) {
  return (
    <section aria-label="Brak rodzajów zmian" className="rounded-card border border-dashed border-border p-4 space-y-3">
      <p className="text-sm">
        <span className="font-display font-bold">Nie ma żadnego rodzaju zmiany.</span>{" "}
        <span className="text-muted-foreground">Dodaj własny albo przywróć startowe ({DEFAULT_SHIFT_TYPES.map((t) => t.name).join(", ")}), żeby nanosić je na dni.</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAdd}
          className="pressable h-10 coarse:h-11 px-4 rounded-control bg-primary text-primary-foreground text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          Dodaj rodzaj zmiany
        </button>
        <button type="button" onClick={onRestore}
          className="pressable h-10 coarse:h-11 px-4 rounded-card border border-border/60 hover:bg-muted text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          Przywróć startowe
        </button>
      </div>
    </section>
  );
}
