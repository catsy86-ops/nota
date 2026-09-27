import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  registerGridNavSection,
  setGridNavFocus,
  setGridNavPreview,
  handleGridNavKey,
  __resetGridNavForTests,
  type GridNavHandlers,
} from "./gridKeyboardNav";

/** Zestaw atrap z zachowanymi typami `Mock` — potrzebnymi do podglądu wywołań. */
function probeHandlers(cols = 2) {
  return {
    onDelete: vi.fn(),
    onArchive: vi.fn(),
    onTogglePin: vi.fn(),
    onDuplicate: vi.fn(),
    openNote: vi.fn(),
    scrollToNote: vi.fn(),
    colsCount: () => cols,
  };
}

function handlers(overrides: Partial<GridNavHandlers> = {}) {
  return { ...probeHandlers(), ...overrides };
}

function key(k: string) {
  const e = new KeyboardEvent("keydown", { key: k, cancelable: true });
  handleGridNavKey(e);
  return e;
}

function focusedIdAfter(k: string) {
  key(k);
  return currentFocus();
}

// Stan czytamy przez efekt uboczny na podświetleniu: prościej podejrzeć go
// przez akcję niż eksportować getter tylko dla testów.
let probe: ReturnType<typeof probeHandlers>;
function currentFocus(): string | null {
  probe.onDelete.mockClear();
  key("Delete");
  const call = probe.onDelete.mock.calls[0];
  return call ? (call[0] as string) : null;
}

describe("gridKeyboardNav", () => {
  beforeEach(() => {
    __resetGridNavForTests();
    document.body.innerHTML = "";
  });
  afterEach(() => __resetGridNavForTests());

  it("każdy klawisz działa raz, mimo dwóch zarejestrowanych siatek", () => {
    const pinned = handlers();
    const others = handlers();
    registerGridNavSection(0, ["p1"], pinned);
    registerGridNavSection(1, ["o1", "o2"], others);

    setGridNavFocus("o1");
    key("Delete");

    expect(others.onDelete).toHaveBeenCalledTimes(1);
    expect(others.onDelete).toHaveBeenCalledWith("o1");
    // To był właśnie bug: druga siatka usuwała swoją notatkę przy tym samym klawiszu.
    expect(pinned.onDelete).not.toHaveBeenCalled();
  });

  it("strzałki przechodzą z sekcji przypiętych do pozostałych jak po jednej liście", () => {
    probe = probeHandlers();
    registerGridNavSection(0, ["p1", "p2"], probe);
    registerGridNavSection(1, ["o1"], probe);

    setGridNavFocus("p2");
    expect(focusedIdAfter("ArrowRight")).toBe("o1");
    expect(focusedIdAfter("ArrowLeft")).toBe("p2");
  });

  it("kolejność sekcji wynika z navOrder, nie z kolejności montowania", () => {
    probe = probeHandlers();
    registerGridNavSection(1, ["o1"], probe); // „Inne” zarejestrowane pierwsze
    registerGridNavSection(0, ["p1"], probe);

    setGridNavFocus(null);
    expect(focusedIdAfter("End")).toBe("o1");
    expect(focusedIdAfter("Home")).toBe("p1");
  });

  it("↓ skacze o liczbę kolumn zgłoszoną przez sekcję", () => {
    probe = probeHandlers(2);
    registerGridNavSection(0, ["a", "b", "c", "d"], probe);
    setGridNavFocus("a");
    expect(focusedIdAfter("ArrowDown")).toBe("c");
  });

  it("Enter otwiera dokładnie jedną notatkę — tę z fokusem", () => {
    const pinned = handlers();
    const others = handlers();
    registerGridNavSection(0, ["p1"], pinned);
    registerGridNavSection(1, ["o1"], others);

    setGridNavFocus("p1");
    key("Enter");
    expect(pinned.openNote).toHaveBeenCalledExactlyOnceWith("p1");
    expect(others.openNote).not.toHaveBeenCalled();
  });

  it("akcje bez fokusu nic nie robią", () => {
    const h = handlers();
    registerGridNavSection(0, ["a"], h);
    key("Delete");
    key("Enter");
    expect(h.onDelete).not.toHaveBeenCalled();
    expect(h.openNote).not.toHaveBeenCalled();
  });

  it("archiwum nie dostaje akcji archiwizacji", () => {
    const h = handlers({ onArchive: undefined });
    registerGridNavSection(0, ["a"], h);
    setGridNavFocus("a");
    const e = key("a");
    expect(e.defaultPrevented).toBe(false);
  });

  it("odrejestrowanie sekcji zdejmuje fokus z notatki, której już nie ma", () => {
    probe = probeHandlers();
    const unregister = registerGridNavSection(0, ["p1"], probe);
    registerGridNavSection(1, ["o1"], probe);
    setGridNavFocus("p1");
    unregister();
    expect(currentFocus()).toBe(null);
  });

  it("nie reaguje, gdy użytkownik pisze w polu tekstowym", () => {
    const h = handlers();
    registerGridNavSection(0, ["a"], h);
    setGridNavFocus("a");
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    key("Delete");
    expect(h.onDelete).not.toHaveBeenCalled();
  });

  it("nie reaguje, gdy otwarty jest dialog", () => {
    const h = handlers();
    registerGridNavSection(0, ["a"], h);
    setGridNavFocus("a");
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    key("Delete");
    expect(h.onDelete).not.toHaveBeenCalled();
  });

  it("w szybkim podglądzie Spacja zamyka, Enter otwiera notatkę raz", () => {
    vi.useFakeTimers();
    const h = handlers();
    registerGridNavSection(0, ["a"], h);
    setGridNavPreview("a");
    key("Enter");
    vi.advanceTimersByTime(60);
    expect(h.openNote).toHaveBeenCalledExactlyOnceWith("a");

    setGridNavPreview("a");
    key(" ");
    key("Delete"); // podgląd zamknięty, ale fokusu nie ma → brak akcji
    expect(h.onDelete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("„/” przenosi fokus do wyszukiwania i nie rusza notatek", () => {
    const h = handlers();
    registerGridNavSection(0, ["a"], h);
    const input = document.createElement("input");
    input.placeholder = "Szukaj notatek...";
    document.body.appendChild(input);
    const e = key("/");
    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });
});
