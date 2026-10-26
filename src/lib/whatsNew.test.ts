import { describe, expect, it } from "vitest";
import { whatsNewDecision } from "./whatsNew";

describe("Co nowego (U-4)", () => {
  it("pierwsze uruchomienie tylko zapamiętuje wersję", () => {
    expect(whatsNewDecision(null, "2026.10.26")).toBe("remember");
  });
  it("ta sama wersja: nic; nowa: dymek", () => {
    expect(whatsNewDecision("2026.10.26", "2026.10.26")).toBe("none");
    expect(whatsNewDecision("2026.10.01", "2026.10.26")).toBe("show");
  });
});
