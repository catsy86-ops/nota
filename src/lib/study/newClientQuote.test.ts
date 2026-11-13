import { beforeEach, describe, expect, it } from "vitest";
import { newQuoteForClient, quoteSiteName } from "./newClientQuote";
import { addClient, archiveClient, getClientLinks } from "@/lib/clients/store";
import { getJobs } from "./jobsStore";
import { resetStudyForTests } from "./data";
import { getStudy, siteDirectoryOf } from "./store";
import type { SiteInfo } from "./sites";
import { yjsStore } from "@/lib/yjsStore";

beforeEach(async () => {
  localStorage.clear();
  await yjsStore.resetForTests();
  resetStudyForTests();
});

const dir = () => siteDirectoryOf(getStudy());
const s = (name: string) => ({ id: name, name }) as SiteInfo;

describe("quoteSiteName", () => {
  it("pierwsza wolna nazwa z numerem, bez ogonków i wielkości liter przy porównaniu", () => {
    expect(quoteSiteName("Jan Kowalski", [])).toBe("Jan Kowalski — wycena");
    expect(quoteSiteName("Jan Kowalski", [s("JAN kowalski — WYCENA")])).toBe("Jan Kowalski — wycena (2)");
    expect(quoteSiteName("Jan Kowalski", [s("Jan Kowalski — wycena"), s("Jan Kowalski — wycena (2)")])).toBe("Jan Kowalski — wycena (3)");
  });
  it("długa nazwa klienta jest przycinana, żeby sufiks się zmieścił", () => {
    const name = quoteSiteName("x".repeat(120), []);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith(" — wycena")).toBe(true);
  });
});

describe("newQuoteForClient (4.6)", () => {
  it("zakłada kartę budowy z danymi klienta, zlecenie w stanie „Wycena” i powiązanie z kartoteką", () => {
    const klient = addClient({ name: "Jan Kowalski", phone: "600 100 200", address1: "ul. Lipowa 5", address2: "30-001 Kraków" })!;
    const made = newQuoteForClient(klient, dir())!;
    expect(made.name).toBe("Jan Kowalski — wycena");
    const card = dir().find((x) => x.id === made.id)!;
    expect(card).toMatchObject({ investor: "Jan Kowalski", phone: "600 100 200", address: "ul. Lipowa 5, 30-001 Kraków" });
    expect(getJobs().get(made.id)).toMatchObject({ status: "quote", items: [] });
    expect(getClientLinks().get(made.id)).toBe(klient.id);
  });

  it("druga wycena dla tego samego klienta dostaje kolejny numer w nazwie", () => {
    const klient = addClient({ name: "Ania" })!;
    const one = newQuoteForClient(klient, dir())!;
    const two = newQuoteForClient(klient, dir())!;
    expect([one.name, two.name]).toEqual(["Ania — wycena", "Ania — wycena (2)"]);
    expect(getJobs().size).toBe(2);
  });

  it("klient bez telefonu i adresu też dostaje wycenę", () => {
    const klient = addClient({ name: "Zenon" })!;
    const made = newQuoteForClient(klient, dir())!;
    expect(dir().find((x) => x.id === made.id)).toMatchObject({ investor: "Zenon", address: "" });
    archiveClient(klient.id, true);
  });
});
