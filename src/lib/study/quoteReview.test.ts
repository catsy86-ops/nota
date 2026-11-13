import { describe, expect, it } from "vitest";
import { matchesQuoteFilter, monthKeyOf, quoteReview } from "./quoteReview";
import type { Job } from "./jobs";
import type { QuoteDoc } from "./quoteDoc";

const at = (m: number, d = 10) => new Date(2026, m - 1, d, 12).getTime();
const job = (price: number, doc?: QuoteDoc): Pick<Job, "items" | "margin" | "doc"> => ({
  items: [{ id: "a", kind: "labor", name: "x", qty: 1, unit: "usł.", price, order: 0 }],
  ...(doc ? { doc } : {}),
});

describe("quoteReview (5.4)", () => {
  it("miesiąc lokalny z chwili", () => {
    expect(monthKeyOf(new Date(2026, 10, 30, 23, 59).getTime())).toBe("2026-11");
    expect(monthKeyOf(new Date(2026, 11, 1, 0, 1).getTime())).toBe("2026-12");
  });

  it("liczy wysłane, przyjęte i odrzucone w miesiącu z sumami kwot do zapłaty", () => {
    const jobs = [
      job(1000, { sentAt: at(11), acceptedAt: at(11, 12) }),
      job(500, { sentAt: at(11, 3), rejectedAt: at(11, 20) }),
      job(200, { sentAt: at(11, 5) }),
      job(900, { sentAt: at(10, 28), acceptedAt: at(11, 2) }),
      job(300, { sentAt: at(10, 1), rejectedAt: at(10, 9) }),
      job(400),
    ];
    const r = quoteReview(jobs, "2026-11");
    expect(r.sent).toEqual({ count: 3, total: 1700 });
    expect(r.accepted).toEqual({ count: 2, total: 1900 });
    expect(r.rejected).toEqual({ count: 1, total: 500 });
    // Skuteczność: 2 przyjęte na 3 rozstrzygnięte.
    expect(r.rate).toBe(67);
    expect(quoteReview(jobs, "2026-10")).toMatchObject({ sent: { count: 2 }, accepted: { count: 0 }, rejected: { count: 1 }, rate: 0 });
  });

  it("kwoty uwzględniają rabat i VAT z dokumentu", () => {
    const r = quoteReview([job(1000, { sentAt: at(11), discount: 10, vatMode: "net", vatRate: 23 })], "2026-11");
    expect(r.sent.total).toBe(1107);
  });

  it("bez rozstrzygnięć skuteczność to null, a pusty przegląd ma same zera", () => {
    expect(quoteReview([job(100, { sentAt: at(11) })], "2026-11").rate).toBeNull();
    expect(quoteReview([], "2026-11")).toEqual({ month: "2026-11", sent: { count: 0, total: 0 }, accepted: { count: 0, total: 0 }, rejected: { count: 0, total: 0 }, rate: null });
  });
});

describe("matchesQuoteFilter", () => {
  it("„wszystkie” przepuszcza każdą wycenę, pozostałe filtry — po stanie z najnowszego znacznika", () => {
    expect(matchesQuoteFilter({}, "all")).toBe(true);
    expect(matchesQuoteFilter({}, "draft")).toBe(true);
    expect(matchesQuoteFilter({ doc: { sentAt: 1 } }, "sent")).toBe(true);
    expect(matchesQuoteFilter({ doc: { sentAt: 1 } }, "draft")).toBe(false);
    expect(matchesQuoteFilter({ doc: { sentAt: 1, acceptedAt: 2 } }, "accepted")).toBe(true);
    expect(matchesQuoteFilter({ doc: { sentAt: 3, acceptedAt: 2 } }, "accepted")).toBe(false);
    expect(matchesQuoteFilter({ doc: { rejectedAt: 5 } }, "rejected")).toBe(true);
  });
});
