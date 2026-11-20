import { Button } from "@/components/ui/button";
import { StatusPanel } from "@/components/StatusPanel";
import { Sketch } from "@/components/art/Sketch";
import { SHIFT_TYPES_GLYPH } from "@/lib/emptyGlyphs";
import { DEFAULT_SHIFT_TYPES } from "@/lib/shifts";

interface NoShiftTypesProps {
  onAdd: () => void;
  onRestore: () => void;
}

/** Grafik bez żadnego rodzaju zmiany: dodaj własny albo przywróć startowe (G3.2). */
export function NoShiftTypes({ onAdd, onRestore }: NoShiftTypesProps) {
  return (
    // W5.4: ten sam pusty stan co w innych działach — szkic, zdanie, jedna akcja główna i jedna zapasowa.
    <section aria-label="Brak rodzajów zmian">
      <StatusPanel size="inline" art={<Sketch paths={SHIFT_TYPES_GLYPH} size="inline" />}
        title="Nie ma żadnego rodzaju zmiany."
        description={`Dodaj własny albo przywróć startowe (${DEFAULT_SHIFT_TYPES.map((t) => t.name).join(", ")}), żeby nanosić je na dni.`}
        actions={<>
          <Button type="button" onClick={onAdd} className="coarse:h-11">Dodaj rodzaj zmiany</Button>
          <Button type="button" onClick={onRestore} variant="outline" className="coarse:h-11">Przywróć startowe</Button>
        </>} />
    </section>
  );
}
