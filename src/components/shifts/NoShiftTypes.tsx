import { Button } from "@/components/ui/button";
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
        <Button type="button" onClick={onAdd}
          className="coarse:h-11">
          Dodaj rodzaj zmiany
        </Button>
        <Button type="button" onClick={onRestore}
          variant="outline" className="coarse:h-11">
          Przywróć startowe
        </Button>
      </div>
    </section>
  );
}
