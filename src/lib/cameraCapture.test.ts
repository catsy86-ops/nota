import { afterEach, describe, expect, it, vi } from "vitest";
import { hasCamera, hasTorch, openCamera, setTorch, stopStream } from "./cameraCapture";

const track = (caps: unknown, apply = vi.fn().mockResolvedValue(undefined)) => ({ getCapabilities: () => caps, applyConstraints: apply, stop: vi.fn() }) as unknown as MediaStreamTrack;
const stream = (t: MediaStreamTrack) => ({ getVideoTracks: () => [t], getTracks: () => [t] }) as unknown as MediaStream;
const setGum = (fn: unknown) => Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: fn === undefined ? undefined : { getUserMedia: fn } });

afterEach(() => { Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined }); });

describe("cameraCapture (B3.9)", () => {
  it("hasCamera zależy od getUserMedia", () => {
    expect(hasCamera()).toBe(false);
    setGum(async () => ({}));
    expect(hasCamera()).toBe(true);
  });

  it("openCamera: powód błędu (zgoda, brak kamery, nieobsługiwane, inne)", async () => {
    expect(await openCamera()).toEqual({ error: "unsupported" });
    for (const [name, error] of [["NotAllowedError", "denied"], ["SecurityError", "denied"], ["NotFoundError", "notfound"], ["OverconstrainedError", "notfound"], ["AbortError", "error"]] as const) {
      setGum(async () => { throw Object.assign(new Error("x"), { name }); });
      expect(await openCamera(), name).toEqual({ error });
    }
  });

  it("openCamera prosi o tylną kamerę i zwraca strumień", async () => {
    const s = stream(track({}));
    const gum = vi.fn().mockResolvedValue(s);
    setGum(gum);
    expect(await openCamera("environment")).toEqual({ stream: s });
    expect(gum).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: "environment" }) }));
  });

  it("hasTorch tylko, gdy ścieżka zgłasza ograniczenie torch", () => {
    expect(hasTorch(stream(track({ torch: true })))).toBe(true);
    expect(hasTorch(stream(track({ torch: false })))).toBe(false);
    expect(hasTorch(stream(track({})))).toBe(false);
    expect(hasTorch(stream(track(undefined)))).toBe(false);
  });

  it("setTorch zwraca powodzenie i przekazuje ograniczenie; odmowa systemu daje false", async () => {
    const apply = vi.fn().mockResolvedValue(undefined);
    expect(await setTorch(stream(track({ torch: true }, apply)), true)).toBe(true);
    expect(apply).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    const denied = vi.fn().mockRejectedValue(new Error("nope"));
    expect(await setTorch(stream(track({ torch: true }, denied)), true)).toBe(false);
  });

  it("stopStream zatrzymuje wszystkie ścieżki", () => {
    const t = track({});
    stopStream(stream(t));
    expect((t as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalled();
  });
});
