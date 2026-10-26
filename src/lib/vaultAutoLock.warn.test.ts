import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 1.3 planu Skarbca: 30 s przed auto-blokadą pokazuje się ostrzeżenie; aktywność je odsuwa.
const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastMock }));

import { setAutoLockMinutes, startAutoLock } from "./vaultAutoLock";

const fakeVault = () => ({
  isUnlocked: vi.fn(() => true),
  lock: vi.fn(async () => {}),
  subscribe: () => () => {},
});

describe("ostrzeżenie przed auto-blokadą (1.3)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    setAutoLockMinutes(1);
    toastMock.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("30 s przed blokadą pokazuje dymek, a blokada przychodzi po minucie bezczynności", () => {
    const pn = fakeVault();
    const stop = startAutoLock(pn as never);
    vi.advanceTimersByTime(29_000);
    expect(toastMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(toastMock).toHaveBeenCalledWith("Zablokuję za 30 s", expect.objectContaining({ id: "vault-autolock-warning" }));
    expect(pn.lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(pn.lock).toHaveBeenCalled();
    stop();
  });

  it("aktywność odsuwa ostrzeżenie i blokadę o tyle, ile trwała bezczynność", () => {
    const pn = fakeVault();
    const stop = startAutoLock(pn as never);
    vi.advanceTimersByTime(20_000);
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(29_000);
    expect(toastMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_000);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(pn.lock).not.toHaveBeenCalled();
    stop();
  });
});
