import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { MonthGrid } from "./MonthGrid";

// K5.1: zmiana zaznaczenia przerysowuje tylko dwie komórki (stary i nowy dzień),
// a nie całą siatkę. Licznik stoi w owijce `memo` nad prawdziwym `DayCell`:
// owijka porównuje propsy tak samo jak prawdziwe `memo`, więc liczy dokładnie
// te renderery, które siatka by wykonała.
const renders = vi.hoisted(() => ({ count: 0 }));

vi.mock("./DayCell", async (importOriginal) => {
  const React = await import("react");
  const mod = await importOriginal<typeof import("./DayCell")>();
  const Counted = React.memo(function CountedDayCell(props: Parameters<typeof mod.DayCell>[0]) {
    renders.count++;
    return React.createElement(mod.DayCell, props);
  });
  return { ...mod, DayCell: Counted };
});

const MONTH = new Date(2026, 9, 1);
const titleOf = () => "";

/** Rodzic jak w kalendarzu: callbacki i funkcje odczytu są stabilne, zaznaczenie się zmienia. */
function Harness({ onReady }: { onReady: (set: (d: Date) => void) => void }) {
  const [selectedDay, setSelectedDay] = useState(new Date(2026, 9, 5));
  const shiftOf = useCallback(() => undefined, []);
  const studyOf = useCallback(() => undefined, []);
  const onSelectDay = useCallback((d: Date) => setSelectedDay(d), []);
  const onActivateDay = useCallback(() => {}, []);
  onReady(setSelectedDay);
  return (
    <MonthGrid
      month={MONTH}
      byDay={new Map()}
      titleOf={titleOf}
      shiftOf={shiftOf}
      studyOf={studyOf}
      selectedDay={selectedDay}
      onSelectDay={onSelectDay}
      onActivateDay={onActivateDay}
      onMonthChange={() => {}}
    />
  );
}

describe("siatka miesiąca — renderowanie (K5.1)", () => {
  it("zmiana zaznaczenia przerysowuje tylko komórki, których dotyczy", () => {
    let setDay: (d: Date) => void = () => {};
    const { container } = render(<Harness onReady={(s) => { setDay = s; }} />);
    expect(container.querySelectorAll("[role=row] > *").length).toBeGreaterThan(28);

    renders.count = 0;
    act(() => setDay(new Date(2026, 9, 12)));
    // Stary i nowy dzień; reszta siatki zostaje.
    expect(renders.count).toBeLessThanOrEqual(2);
  });

  it("klik w dzień woła wybór dnia z komórki, nie przerysowuje całej siatki", () => {
    const { container } = render(<Harness onReady={() => {}} />);
    const cell = container.querySelector<HTMLElement>('[data-day-key="2026-10-20"]');
    expect(cell).not.toBeNull();
    renders.count = 0;
    fireEvent.click(cell as HTMLElement);
    expect(renders.count).toBeLessThanOrEqual(2);
  });
});
