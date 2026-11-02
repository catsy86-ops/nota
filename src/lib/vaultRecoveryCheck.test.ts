import { beforeEach, describe, expect, it } from "vitest";
import { getRecoveryCheck, markRecoveryChecked, markRecoveryNudged, RECOVERY_CHECK_EVERY_MS, recoveryCheckDue, setRecoveryNudgeOff } from "./vaultRecoveryCheck";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => { setRecoveryNudgeOff(false); localStorage.clear(); });

describe("przypomnienie o kodzie awaryjnym (Skarbiec 2.4)", () => {
  it("nigdy nie sprawdzony — pora; po sprawdzeniu albo przypomnieniu — za 90 dni", () => {
    const now = 1_000 * DAY;
    expect(recoveryCheckDue({}, now)).toBe(true);
    expect(recoveryCheckDue({ checkedAt: now - 10 * DAY }, now)).toBe(false);
    expect(recoveryCheckDue({ nudgedAt: now - 10 * DAY }, now)).toBe(false);
    expect(recoveryCheckDue({ checkedAt: now - RECOVERY_CHECK_EVERY_MS }, now)).toBe(true);
    expect(recoveryCheckDue({ off: true }, now)).toBe(false);
  });

  it("zapis na urządzeniu: sprawdzenie, przypomnienie, wyłączenie", () => {
    markRecoveryChecked(5);
    markRecoveryNudged(7);
    expect(getRecoveryCheck()).toMatchObject({ checkedAt: 5, nudgedAt: 7 });
    setRecoveryNudgeOff(true);
    expect(getRecoveryCheck().off).toBe(true);
    setRecoveryNudgeOff(false);
    expect(getRecoveryCheck().off).toBeUndefined();
  });
});
