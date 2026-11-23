import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HIDDEN_LOCK_CHOICES, PRIVACY_COVER_ATTR, setAutoLockMinutes, setHiddenLockMinutes, startAutoLock } from "./vaultAutoLock";

let visibility: DocumentVisibilityState = "visible";
Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });

const fakeVault = () => ({
  isUnlocked: vi.fn(() => true),
  lock: vi.fn(async () => {}),
  subscribe: () => () => {},
});

function hide() {
  visibility = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("blokada skarbca po schowaniu karty — wybór w Ustawieniach", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    // Testujemy tylko blokadę po ukryciu: bezczynność (domyślnie 5 min) wyłączona.
    setAutoLockMinutes(0);
  });
  afterEach(() => {
    vi.useRealTimers();
    visibility = "visible";
  });

  it("oferuje 1, 5, 15 minut i wyłączenie", () => {
    expect([...HIDDEN_LOCK_CHOICES]).toEqual([1, 5, 15, 0]);
  });

  it("wybór 0 (nie blokuj po ukryciu) nie blokuje nawet po długim czasie", () => {
    setHiddenLockMinutes(0);
    const pn = fakeVault();
    const stop = startAutoLock(pn as never);
    hide();
    vi.advanceTimersByTime(60 * 60_000);
    expect(pn.lock).not.toHaveBeenCalled();
    stop();
  });

  it("wybór 5 minut blokuje dopiero po pięciu minutach, nie po jednej", () => {
    setHiddenLockMinutes(5);
    const pn = fakeVault();
    const stop = startAutoLock(pn as never);
    hide();
    vi.advanceTimersByTime(60_000);
    expect(pn.lock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(4 * 60_000);
    expect(pn.lock).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe("zasłona ekranu przy odblokowanym skarbcu (S1.9)", () => {
  const cover = () => document.documentElement.hasAttribute(PRIVACY_COVER_ATTR);
  beforeEach(() => { localStorage.clear(); setAutoLockMinutes(0); setHiddenLockMinutes(0); });
  afterEach(() => { visibility = "visible"; document.documentElement.removeAttribute(PRIVACY_COVER_ATTR); });

  it("karta w tle + skarbiec odblokowany → zasłona; powrót ją zdejmuje", () => {
    const stop = startAutoLock(fakeVault() as never);
    hide();
    expect(cover()).toBe(true);
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cover()).toBe(false);
    stop();
  });

  it("skarbiec zablokowany → bez zasłony (nie ma czego zasłaniać)", () => {
    const vault = { ...fakeVault(), isUnlocked: vi.fn(() => false) };
    const stop = startAutoLock(vault as never);
    hide();
    expect(cover()).toBe(false);
    stop();
  });

  it("zasłona działa także przy wyłączonej blokadzie po ukryciu (0 min)", () => {
    setHiddenLockMinutes(0);
    const stop = startAutoLock(fakeVault() as never);
    hide();
    expect(cover()).toBe(true);
    stop();
  });

  it("zatrzymanie nasłuchu zdejmuje zasłonę", () => {
    const stop = startAutoLock(fakeVault() as never);
    hide();
    stop();
    expect(cover()).toBe(false);
  });

  it("zablokowanie skarbca w tle zdejmuje zasłonę", () => {
    let on = true;
    let notify: () => void = () => {};
    const vault = { isUnlocked: () => on, lock: vi.fn(async () => {}), subscribe: (fn: () => void) => { notify = fn; return () => {}; } };
    const stop = startAutoLock(vault as never);
    hide();
    expect(cover()).toBe(true);
    on = false;
    notify();
    expect(cover()).toBe(false);
    stop();
  });
});
