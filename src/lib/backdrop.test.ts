import { describe, expect, it } from "vitest";
import { resolveBackdrop, setBackdrop } from "@/lib/backdrop";

describe("tło stylu — pełne / ciche / gładkie", () => {
  it("auto: pełne, a ciche przy oszczędzaniu danych", () => {
    expect(resolveBackdrop("auto", false)).toBe("full");
    expect(resolveBackdrop("auto", true)).toBe("quiet");
  });

  it("wybór użytkownika wygrywa z oszczędzaniem danych", () => {
    expect(resolveBackdrop("full", true)).toBe("full");
    expect(resolveBackdrop("plain", false)).toBe("plain");
  });

  it("zapis ustawia atrybut na <html>, a pełne go zdejmuje", () => {
    setBackdrop("quiet");
    expect(document.documentElement.dataset.backdrop).toBe("quiet");
    setBackdrop("plain");
    expect(document.documentElement.dataset.backdrop).toBe("plain");
    setBackdrop("full");
    expect(document.documentElement.dataset.backdrop).toBeUndefined();
  });
});
