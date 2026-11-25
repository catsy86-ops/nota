import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setTrainingEquipment, useTrainingEquipment } from "@/lib/training/store";
import { parseKg } from "./trainingFormat";

/** C1.2: wydzielone z `TrainingSection.tsx` bez zmian zachowania. */

/** Największy ciężar hantli w domu — używany w ostrzeżeniu przy zapisie serii. */
export function EquipmentForm() {
  const equipment = useTrainingEquipment();
  const [kg, setKg] = useState(equipment.dumbbellMaxKg !== undefined ? String(equipment.dumbbellMaxKg) : "");
  // L4: pole nadąża za zmianą z innego urządzenia (nie tylko za pierwszym renderem).
  useEffect(() => {
    setKg(equipment.dumbbellMaxKg !== undefined ? String(equipment.dumbbellMaxKg) : "");
  }, [equipment.dumbbellMaxKg]);
  const value = parseKg(kg);
  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-field border border-border/60 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        // L3: pusty formularz nie kasuje limitu po cichu — do tego służy osobny przycisk „Usuń limit”.
        if (value === null || value === undefined || value <= 0) return;
        setTrainingEquipment({ dumbbellMaxKg: value });
      }}
    >
      <label className="text-sm">
        Największy ciężar hantli (kg)
        <Input
          inputMode="decimal"
          aria-invalid={value === null}
          value={kg}
          placeholder="np. 24"
          onChange={(e) => setKg(e.target.value)}
          className="ml-2 inline-block w-24 coarse:h-11"
        />
      </label>
      <Button type="submit" variant="outline" size="sm" disabled={value === null || value === undefined || value <= 0} className="coarse:h-11">Zapisz sprzęt</Button>
      {equipment.dumbbellMaxKg !== undefined && (
        <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => setTrainingEquipment({})}>Usuń limit</Button>
      )}
    </form>
  );
}
