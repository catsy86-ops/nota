import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Q3.2: arkusze i okna z polami stoją nad klawiaturą ekranową. `--kb-inset` ustawia `lib/keyboardInset.ts`
// (iOS: wysokość klawiatury; Android z `resizes-content`: 0), więc wystarczy, że wspólne komponenty go odejmują.
describe("Q3.2: arkusze i okna nad klawiaturą", () => {
  it("dolny arkusz: dół na klawiaturze, limit wysokości i punkt zatrzymania pomniejszone o klawiaturę", () => {
    render(
      <Sheet open>
        <SheetContent side="bottom" snap aria-describedby={undefined}>
          <SheetTitle>Arkusz</SheetTitle>
          <input aria-label="pole" />
        </SheetContent>
      </Sheet>,
    );
    const sheet = screen.getByRole("dialog");
    expect(sheet.className).toContain("bottom-(--kb-inset,0px)");
    expect(sheet.style.maxHeight).toContain("--kb-inset");
  });

  it("okno: środek w widocznej części ekranu, wysokość bez klawiatury", () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Okno</DialogTitle>
          <input aria-label="pole" />
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("top-[calc((100dvh-var(--kb-inset,0px))/2)]");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem-var(--kb-inset,0px))]");
  });
});
