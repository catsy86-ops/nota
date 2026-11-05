import { describe, expect, it } from "vitest";
import { syncErrorText } from "./syncErrorText";

describe("błąd synchronizacji po ludzku", () => {
  it("brak sieci przy pobieraniu modułu", () => {
    expect(syncErrorText("Failed to fetch dynamically imported module: https://x/assets/y-webrtc.js")).toMatch(/brak internetu/);
  });
  it("brak WebRTC", () => {
    expect(syncErrorText("RTCPeerConnection is not defined")).toMatch(/WebRTC/);
  });
  it("niebezpieczne połączenie", () => {
    expect(syncErrorText("Cannot read properties of undefined (reading 'subtle')")).toMatch(/https/);
  });
  it("nieznany błąd: ogólna, ale konkretna rada", () => {
    expect(syncErrorText("coś dziwnego")).toMatch(/Wyłącz ją i włącz ponownie/);
  });
});
