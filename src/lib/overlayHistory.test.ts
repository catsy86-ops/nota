import { afterEach, describe, expect, it, vi } from "vitest";
import { overlayDepth, registerOverlay } from "./overlayHistory";

// jsdom wysyła popstate po `history.back()` asynchronicznie. Czekamy timerem — słuchacz popstate
// też zostałby zatrzymany, tak jak router.
const popped = () => new Promise<void>((r) => setTimeout(r, 50));

describe("overlayHistory — router nie dostaje cofnięcia bez zmiany adresu (M2.2)", () => {
  const router = vi.fn();
  window.addEventListener("popstate", router);
  afterEach(() => router.mockClear());

  it("zamknięcie z interfejsu: popstate zatrzymany przed routerem, okno zamknięte bez drugiego wywołania", async () => {
    const close = vi.fn();
    const unregister = registerOverlay(close);
    expect(overlayDepth()).toBe(1);
    const done = popped();
    unregister();
    await done;
    expect(router).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(overlayDepth()).toBe(0);
  });

  it("„wstecz” systemowe zamyka warstwę i dochodzi do routera", async () => {
    const close = vi.fn();
    const unregister = registerOverlay(close);
    const done = popped();
    window.history.back();
    await done;
    expect(close).toHaveBeenCalledTimes(1);
    expect(router).toHaveBeenCalledTimes(1);
    unregister();
  });

  it("adres zmieniony na wpisie warstwy: cofnięcie z interfejsu idzie do routera", async () => {
    const unregister = registerOverlay(() => {});
    window.history.replaceState(window.history.state, "", "?ustawienia=wyglad");
    const done = popped();
    unregister();
    await done;
    expect(router).toHaveBeenCalledTimes(1);
  });
});
