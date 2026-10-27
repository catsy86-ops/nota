import { beforeEach, describe, expect, it, vi } from "vitest";

const toastFn = vi.hoisted(() => Object.assign(vi.fn(), { dismiss: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastFn }));

import { skinStore, setSkin } from "@/lib/skins";
import { trySkin, __resetSkinTry } from "@/lib/skinTry";

type Opts = { action: { onClick: () => void }; onAutoClose: () => void; description: string };
const lastOpts = () => toastFn.mock.calls.at(-1)![1] as Opts;

beforeEach(() => {
  localStorage.clear();
  setSkin("zeszyt");
  __resetSkinTry();
  toastFn.mockClear();
  toastFn.dismiss.mockClear();
});

describe("trySkin — przymierz styl z Cofnij", () => {
  it("ustawia styl od razu i pokazuje dymek z nazwą", () => {
    trySkin("neon");
    expect(skinStore.get()).toBe("neon");
    expect(toastFn).toHaveBeenCalledWith("Styl: Neon", expect.objectContaining({ id: "skin-try" }));
  });

  it("Cofnij po kilku przymiarkach wraca do stylu sprzed serii", () => {
    trySkin("neon");
    trySkin("zorza");
    trySkin("plan");
    expect(lastOpts().description).toContain("Zeszyt");
    lastOpts().action.onClick();
    expect(skinStore.get()).toBe("zeszyt");
  });

  it("po zamknięciu dymka nowa seria zaczyna się od bieżącego stylu", () => {
    trySkin("neon");
    lastOpts().onAutoClose();
    trySkin("miedz");
    lastOpts().action.onClick();
    expect(skinStore.get()).toBe("neon");
  });

  it("ręczny powrót do stylu wyjściowego zamyka dymek bez Cofnij", () => {
    trySkin("neon");
    toastFn.mockClear();
    trySkin("zeszyt");
    expect(skinStore.get()).toBe("zeszyt");
    expect(toastFn).not.toHaveBeenCalled();
    expect(toastFn.dismiss).toHaveBeenCalledWith("skin-try");
  });

  it("ten sam styl nic nie robi", () => {
    trySkin("zeszyt");
    expect(toastFn).not.toHaveBeenCalled();
  });

  it("Odblask proponuje tryb budowa, gdy jest wyłączony", () => {
    trySkin("odblask");
    const offer = toastFn.mock.calls.find(([title]) => title === "Włączyć tryb budowa?");
    expect(offer?.[1]).toEqual(expect.objectContaining({ id: "odblask-site" }));
    (offer![1] as Opts).action.onClick();
    expect(document.documentElement.dataset.site).toBe("");
  });
});
