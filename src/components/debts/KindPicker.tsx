import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEBT_KIND_LABEL, DEBT_KINDS, KIND_SIGN, type DebtKind } from "@/lib/debts/model";

/**
 * Wybór rodzaju (1.4): `ToggleGroup` z `ui/` — jeden przystanek Tab, strzałki, 44 px na dotyku.
 * Pieniądze wychodzą od nas (pożyczka, zwrot): strzałka w górę. Wracają (spłata, dług u kogoś): w dół.
 */
export function KindPicker({ value, onChange }: { value: DebtKind; onChange: (k: DebtKind) => void }) {
  return (
    <ToggleGroup value={value} onValueChange={(v) => onChange(v as DebtKind)} aria-label="Rodzaj wpisu" className="grid-flow-row grid-cols-2 @max-[18rem]:grid-cols-1">
      {DEBT_KINDS.map((k) => {
        const Icon = KIND_SIGN[k] > 0 ? ArrowUpRight : ArrowDownLeft;
        return (
          <ToggleGroupItem key={k} value={k} className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Icon className="size-4" aria-hidden />
            {DEBT_KIND_LABEL[k]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
