import { describe, it, expect, beforeEach } from "vitest";
import { hasDictationConsent, withdrawDictationConsent } from "./useDictation";

describe("zgoda na dyktowanie", () => {
  beforeEach(() => localStorage.clear());

  it("bez zapisu zgody nie ma", () => {
    expect(hasDictationConsent()).toBe(false);
  });

  it("zapisana zgoda jest widoczna, a cofnięcie ją zdejmuje", () => {
    localStorage.setItem("kaczy.dictation.consent", "1");
    expect(hasDictationConsent()).toBe(true);
    withdrawDictationConsent();
    expect(hasDictationConsent()).toBe(false);
    expect(localStorage.getItem("kaczy.dictation.consent")).toBeNull();
  });
});
