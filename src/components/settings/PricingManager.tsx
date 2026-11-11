import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { CompanyPricing } from "@/lib/pricing";
import { addPricingItem, removePricingItem } from "@/lib/pricing";

interface PricingManagerProps {
  pricing: CompanyPricing;
  onUpdate: (pricing: CompanyPricing) => void;
}

export function PricingManager({ pricing, onUpdate }: PricingManagerProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [pointType, setPointType] = useState("H-4");

  function add() {
    if (!name.trim() || !price || parseFloat(price) < 0) {
      toast.error("Wpisz nazwę pozycji i cenę");
      return;
    }

    const updated = addPricingItem(pricing, name.trim(), parseFloat(price), pointType);
    onUpdate(updated);
    setName("");
    setPrice("");
    toast.success("Pozycja dodana");
  }

  function remove(id: string) {
    const updated = removePricingItem(pricing, id);
    onUpdate(updated);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Input
          placeholder="Np. WC podwieszane"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className="text-sm"
        />
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Cena (zł)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          min="0"
          step="10"
          className="text-sm"
        />
        <select
          value={pointType}
          onChange={(e) => setPointType(e.target.value)}
          className="rounded-field border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="H-4">H-4 (hydraulika)</option>
          <option value="E-4">E-4 (elektryka)</option>
          <option value="G-4">G-4 (CO)</option>
          <option value="sanitarny">Sanitarny</option>
          <option value="ogólny">Ogólny</option>
        </select>
      </div>

      <Button onClick={add} size="sm" className="w-full coarse:h-11">
        <Plus className="mr-1 h-4 w-4" aria-hidden />
        Dodaj pozycję
      </Button>

      {pricing.items.length > 0 && (
        <ul className="space-y-2 rounded-card border border-border p-2 bg-muted/30">
          {pricing.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-card bg-background px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.price} zł · {item.pointType}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
