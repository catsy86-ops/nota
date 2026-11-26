import { describe, expect, it } from "vitest";
import { cleanAccount, cleanBlik, formatAccount, formatBlik, ibanChecksumOk, paymentLine } from "./paymentDetails";

// L2.3: czyszczenie konta i BLIK-a listą dozwolonych znaków (przegląd bezpieczeństwa 2026-11-26).
const OK = "PL61109010140000071219812874";
const ch = (n: number) => String.fromCharCode(n);

describe("cleanAccount", () => {
  it("poprawny IBAN i 26 cyfr bez PL — postać kanoniczna, stan ok", () => {
    expect(ibanChecksumOk(OK)).toBe(true);
    expect(cleanAccount("PL61 1090 1014 0000 0712 1981 2874")).toEqual({ value: OK, status: "ok" });
    expect(cleanAccount("61 1090 1014 0000 0712 1981 2874")).toEqual({ value: OK, status: "ok" });
    expect(cleanAccount("pl61-1090-1014-0000-0712-1981-2874")).toEqual({ value: OK, status: "ok" });
  });

  it("zerowa szerokość, RLO, NBSP i cyfry pełnej szerokości nie przechodzą do wyniku", () => {
    expect(cleanAccount(`PL61${ch(0x200b)}1090${ch(0x202e)}1014${ch(0xa0)}0000 0712 1981 2874${ch(0xfeff)}`)).toEqual({ value: OK, status: "ok" });
    const full = "６１１０９０１０１４０００００７１２１９８１２８７４";
    expect(cleanAccount(full)).toEqual({ value: OK, status: "ok" });
  });

  it("cyfry innych pism, litery w środku konta polskiego, zła długość — invalid, bez wartości", () => {
    expect(cleanAccount("٦١١٠٩٠١٠١٤٠٠٠٠٠٧١٢١٩٨١٢٨٧٤")).toEqual({ value: "", status: "invalid" });
    expect(cleanAccount("PL61 1090 1014 0000 0712 1981 287")).toEqual({ value: "", status: "invalid" });
    expect(cleanAccount("konto: 6110901014")).toEqual({ value: "", status: "invalid" });
    expect(cleanAccount("PL61109010140000071219812874".repeat(2))).toEqual({ value: "", status: "invalid" });
  });

  it("zła suma kontrolna — wartość zostaje, stan badChecksum; puste i nie-tekst — empty", () => {
    expect(cleanAccount("PL62109010140000071219812874")).toEqual({ value: "PL62109010140000071219812874", status: "badChecksum" });
    expect(cleanAccount("   ")).toEqual({ value: "", status: "empty" });
    expect(cleanAccount(42)).toEqual({ value: "", status: "empty" });
  });

  it("format w grupach po 4", () => {
    expect(formatAccount(OK)).toBe("PL61 1090 1014 0000 0712 1981 2874");
  });
});

describe("cleanBlik", () => {
  it("9 cyfr po zdjęciu +48/0048, spacji i myślników", () => {
    expect(cleanBlik("600 123 456")).toBe("600123456");
    expect(cleanBlik("+48 600-123-456")).toBe("600123456");
    expect(cleanBlik("0048600123456")).toBe("600123456");
    expect(formatBlik("600123456")).toBe("600 123 456");
  });

  it("8 i 10 cyfr, litery — null", () => {
    expect(cleanBlik("60012345")).toBeNull();
    expect(cleanBlik("6001234567")).toBeNull();
    expect(cleanBlik("600 123 45a")).toBeNull();
    expect(cleanBlik(null)).toBeNull();
  });
});

describe("paymentLine", () => {
  it("tylko poprawne części; konto ze złą sumą pomijane; nic — null", () => {
    expect(paymentLine({ account: OK, blik: "600123456" })).toBe("Przelew: PL61 1090 1014 0000 0712 1981 2874 · BLIK: 600 123 456");
    expect(paymentLine({ account: "PL62109010140000071219812874", blik: "600123456" })).toBe("BLIK: 600 123 456");
    expect(paymentLine({ account: OK })).toBe("Przelew: PL61 1090 1014 0000 0712 1981 2874");
    expect(paymentLine({})).toBeNull();
  });
});
