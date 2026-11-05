import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { BottomSheetMarker } from "@/lib/bottomSheets";

// Etap 7 (nowy plan 4.5): otwarty arkusz dolny oznacza <html data-bottom-sheet>, a CSS w index.css
// przenosi wtedy toasty na górę ekranu telefonu (bez przebudowy Toastera, która przewijała listę).
const marked = () => document.documentElement.hasAttribute("data-bottom-sheet");

describe("arkusze dolne i toasty", () => {
  it("atrybut jest, dopóki otwarty jest choć jeden arkusz", () => {
    const { rerender, unmount } = render(<><BottomSheetMarker /><BottomSheetMarker /></>);
    expect(marked()).toBe(true);
    rerender(<BottomSheetMarker />);
    expect(marked()).toBe(true);
    rerender(<></>);
    expect(marked()).toBe(false);
    unmount();
  });
});
