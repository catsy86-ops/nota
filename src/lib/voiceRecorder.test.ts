import { describe, expect, it } from "vitest";
import { pickAudioType, voiceFileName } from "./voiceRecorder";

describe("pickAudioType", () => {
  it("woli Opus w WebM, potem MP4 (iPhone), a bez wsparcia zostawia wybór przeglądarce", () => {
    expect(pickAudioType(() => true)).toBe("audio/webm;codecs=opus");
    expect(pickAudioType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickAudioType(() => false)).toBe("");
  });
});

describe("voiceFileName", () => {
  it("nazwa z datą i godziną, rozszerzenie wg formatu", () => {
    const at = new Date(2026, 9, 18, 14, 5);
    expect(voiceFileName(at, "audio/webm")).toBe("Nagranie 2026-10-18 14-05.webm");
    expect(voiceFileName(at, "audio/mp4")).toBe("Nagranie 2026-10-18 14-05.m4a");
    expect(voiceFileName(at, "audio/ogg")).toBe("Nagranie 2026-10-18 14-05.ogg");
  });
});
