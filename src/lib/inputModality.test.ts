import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";

// Moduł rejestruje nasłuchy przy imporcie (na poziomie dokumentu), więc importujemy go raz.
beforeAll(async () => {
  await import("@/lib/inputModality");
});

function press(target: HTMLElement, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function pointer(target: HTMLElement, pointerType: string) {
  // jsdom nie zawsze ma PointerEvent — wystarczy zdarzenie z polem pointerType.
  const e = new Event("pointerdown", { bubbles: true });
  Object.defineProperty(e, "pointerType", { value: pointerType });
  target.dispatchEvent(e);
}

describe("inputModality — ostatnie źródło wejścia", () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    host.innerHTML = `
      <button id="btn">Zapisz</button>
      <input id="cb" type="checkbox" />
      <input id="txt" type="text" />
      <textarea id="ta"></textarea>
    `;
    document.body.appendChild(host);
    pointer(host.querySelector("#btn") as HTMLElement, "touch");
    expect(document.documentElement.dataset.input).toBe("touch");
  });

  afterEach(() => {
    host.remove();
  });

  it("Tab przełącza na klawiaturę", () => {
    press(host.querySelector("#btn") as HTMLElement, "Tab");
    expect(document.documentElement.dataset.input).toBe("keyboard");
  });

  it("Enter na przycisku po dotyku przełącza na klawiaturę", () => {
    press(host.querySelector("#btn") as HTMLElement, "Enter");
    expect(document.documentElement.dataset.input).toBe("keyboard");
  });

  it("Spacja na checkboksie przełącza na klawiaturę", () => {
    pointer(host.querySelector("#btn") as HTMLElement, "touch");
    press(host.querySelector("#cb") as HTMLElement, " ");
    expect(document.documentElement.dataset.input).toBe("keyboard");
  });

  it("Enter i Spacja w polu tekstowym nie zmieniają źródła (klawiatura ekranowa)", () => {
    press(host.querySelector("#txt") as HTMLElement, "Enter");
    expect(document.documentElement.dataset.input).toBe("touch");
    press(host.querySelector("#ta") as HTMLElement, " ");
    expect(document.documentElement.dataset.input).toBe("touch");
  });

  it("Escape nadal nie przełącza (zamknięcie okna po dotyku)", () => {
    press(host.querySelector("#btn") as HTMLElement, "Escape");
    expect(document.documentElement.dataset.input).toBe("touch");
  });
});

describe("recentUserAction — zmiana po akcji, nie z synchronizacji (M5.4)", () => {
  it("jest prawdą tuż po dotyku i klawiszu, fałszem po upływie okna", async () => {
    const { recentUserAction } = await import("@/lib/inputModality");
    const realNow = performance.now.bind(performance);
    let now = realNow();
    performance.now = () => now;
    try {
      pointer(document.body, "touch");
      expect(recentUserAction()).toBe(true);
      now += 1600;
      expect(recentUserAction()).toBe(false);
      press(document.body, "a");
      expect(recentUserAction()).toBe(true);
      now += 400;
      expect(recentUserAction(300)).toBe(false);
    } finally {
      performance.now = realNow;
    }
  });
});
