import { useEffect, useState } from "react";
import { Check, RotateCcw, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAppearanceValues, resetAppearance } from "@/lib/appearanceCode";
import { applyValues, isPresetActive, PRESETS, readSlot, SLOT_COUNT, slotSummary } from "@/lib/appearancePresets";
import { PRESET_ICON } from "./presetIcons";
import { toastWithUndo } from "@/lib/undoToast";
import { QUICK_PRESETS_EVENT } from "@/lib/quickPresets";



/**
 * Szybkie zestawy wyglądu (plan motywów 1.3, druga część): przytrzymanie przełącznika jasności w nagłówku
 * albo kafelka „Tryb ciemny” w „Więcej” otwiera to okienko. Budowa, Noc, Czytanie, Oszczędny, własne Mój 1–3
 * (z opisem, co zapisano) i domyślny wygląd, każdy z „Cofnij”. Włączony zestaw ma ptaszek.
 * Zapis własnych zestawów jest w Ustawieniach → Wygląd.
 */
export function QuickPresetsHost() {
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<(Record<string, string> | null)[]>([]);

  useEffect(() => {
    const on = () => { setSlots(Array.from({ length: SLOT_COUNT }, (_, i) => readSlot(i + 1))); setOpen(true); };
    window.addEventListener(QUICK_PRESETS_EVENT, on);
    return () => window.removeEventListener(QUICK_PRESETS_EVENT, on);
  }, []);

  function pick(name: string, before: Record<string, string>) {
    setOpen(false);
    toastWithUndo(`Zestaw: ${name}`, () => applyAppearanceValues(before, { replace: true }));
  }

  const row = "pressable flex w-full items-center gap-3 rounded-card border border-border/60 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/60 coarse:min-h-11";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm rounded-card" data-testid="quick-presets">
        <DialogHeader>
          <DialogTitle className="font-display">Zestaw wyglądu</DialogTitle>
          <DialogDescription>Jednym stuknięciem. Każdą zmianę cofniesz z komunikatu.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {PRESETS.map((p) => {
            const Icon = PRESET_ICON[p.id];
            const on = open && isPresetActive(p.values);
            return (
              <button key={p.id} type="button" className={row} aria-pressed={on} onClick={() => pick(p.label, applyValues(p.values, { full: false }))}>
                <Icon className="size-5 shrink-0 text-primary-ink" aria-hidden />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{p.label}</span><span className="block text-2xs text-muted-foreground">{p.desc}</span></span>
                {on && <Check className="size-4 shrink-0 text-primary-ink" aria-label="Włączony" />}
              </button>
            );
          })}
          {slots.map((saved, i) => saved && (
            <button key={i} type="button" className={row} onClick={() => pick(`Mój ${i + 1}`, applyValues(saved, { full: true }))}>
              <Star className="size-5 shrink-0 text-primary-ink" aria-hidden />
              <span className="min-w-0"><span className="block text-sm font-semibold">Mój {i + 1}</span><span className="block truncate text-2xs text-muted-foreground">{slotSummary(saved)}</span></span>
            </button>
          ))}
          <button type="button" className={row} onClick={() => pick("domyślny", resetAppearance())}>
            <RotateCcw className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold">Domyślny wygląd</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
