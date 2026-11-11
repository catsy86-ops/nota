import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFrame, hasCamera, hasTorch, openCamera, setTorch, stopStream } from "./cameraCapture";

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

describe("captureFrame (T23)", () => {
  const video = (over: Partial<HTMLVideoElement> = {}) => ({ readyState: 4, videoWidth: 640, videoHeight: 480, ...over }) as unknown as HTMLVideoElement;
  const fakeCanvas = (ctx: unknown, blob: Blob | null = new Blob(["x"])) => {
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(blob));
    vi.spyOn(document, "createElement").mockReturnValue({ width: 0, height: 0, getContext: () => ctx, toBlob } as unknown as HTMLElement);
    return toBlob;
  };
  afterEach(() => { vi.restoreAllMocks(); });

  it("kamera jeszcze bez obrazu: null", async () => {
    expect(await captureFrame(video({ readyState: 1 }))).toBeNull();
    expect(await captureFrame(video({ videoWidth: 0 }))).toBeNull();
    expect(await captureFrame(video({ videoHeight: 0 }))).toBeNull();
  });

  it("brak kontekstu 2D albo pusty toBlob: null", async () => {
    fakeCanvas(null);
    expect(await captureFrame(video())).toBeNull();
    vi.restoreAllMocks();
    fakeCanvas({ drawImage: vi.fn() }, null);
    expect(await captureFrame(video())).toBeNull();
  });

  it("poprawna klatka: rysuje wideo i oddaje JPEG 0,9", async () => {
    const drawImage = vi.fn();
    const toBlob = fakeCanvas({ drawImage });
    const v = video();
    const blob = await captureFrame(v);
    expect(blob).toBeInstanceOf(Blob);
    expect(drawImage).toHaveBeenCalledWith(v, 0, 0);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
  });
});
