import { useState } from "react";
import { Ruler } from "lucide-react";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { HEIGHTS } from "@/lib/study/content";

/**
 * Ściąga wysokości podejść (standard G-HEAT) — najczęściej potrzebna na budowie, więc
 * pod ręką: przycisk w nagłówku działu i w arkuszu wpisu przy temacie „Punkty wodne”.
 * Duże cyfry w kroju mono — czytane z wyciągniętej ręki, w rękawicach.
 */
export function HeightsButton({ variant = "pill", className }: { variant?: "pill" | "icon" | "link"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={variant === "icon" ? "Wysokości podejść" : undefined}
        title="Wysokości podejść [cm]"
        className={cn(
          "pressable inline-flex items-center gap-2 text-muted-foreground hover:text-foreground",
          variant === "pill" && "rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted coarse:min-h-11",
          variant === "icon" && "size-9 justify-center rounded-full border border-border hover:bg-muted coarse:size-11",
          variant === "link" && "rounded-field px-1.5 py-1 text-xs font-medium text-primary-ink underline-offset-2 hover:underline coarse:min-h-11",
          className,
        )}
      >
        <Ruler className="h-4 w-4" aria-hidden />
        {variant !== "icon" && "Wysokości"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="sm:max-w-lg" data-testid="heights-sheet">
          <div className="pr-8">
            <DialogTitle className="font-display text-lg">Wysokości podejść [cm]</DialogTitle>
            <DialogDescription className="text-xs">Standard G-HEAT. Zmywarka — zwykle jak pralka.</DialogDescription>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 font-medium">Punkt</th>
                <th className="py-1.5 pr-3 text-right font-medium">Woda</th>
                <th className="py-1.5 pr-3 text-right font-medium">c/z</th>
                <th className="py-1.5 text-right font-medium">Kan.</th>
              </tr>
            </thead>
            <tbody>
              {HEIGHTS.map((h) => (
                <tr key={h.point} className="border-t border-border/60">
                  <td className="py-2 pr-3 text-sm">{h.point}</td>
                  <td className="py-2 pr-3 text-right font-mono text-xl font-semibold tabular-nums text-primary-ink">{h.water}</td>
                  <td className="py-2 pr-3 text-right font-mono text-base tabular-nums">{h.spacing ?? "—"}</td>
                  <td className="py-2 text-right font-mono text-base tabular-nums">{h.sewer ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">c/z — rozstaw ciepła/zimna. Kan. — wysokość podejścia kanalizacji.</p>
        </ResponsiveDialogContent>
      </Dialog>
    </>
  );
}
