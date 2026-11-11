import { describe, it, expect } from "vitest";
import {
  daysWaiting,
  formatPaymentMessage,
  generateSMSLink,
  generateWhatsAppLink,
} from "./paymentReminder";

describe("paymentReminder", () => {
  it("daysWaiting: oblicza dni od daty terminu", () => {
    const now = new Date("2026-11-10").getTime();
    const dueDate = new Date("2026-11-05").getTime();
    const days = daysWaiting(dueDate, now);
    expect(days).toBe(5);
  });

  it("daysWaiting: zwraca 0 dla przyszłej daty", () => {
    const now = new Date("2026-11-10").getTime();
    const dueDate = new Date("2026-11-15").getTime();
    const days = daysWaiting(dueDate, now);
    expect(days).toBe(0);
  });

  it("daysWaiting: zaokrągla do pełnych dni", () => {
    const now = new Date("2026-11-10T12:00:00").getTime();
    const dueDate = new Date("2026-11-05T14:00:00").getTime();
    const days = daysWaiting(dueDate, now);
    expect(days).toBe(4);
  });

  it("formatPaymentMessage: formatuje wiadomość z days", () => {
    const msg = formatPaymentMessage("Lipowa", 2400, 14);
    expect(msg).toBe("Lipowa: 2400 zł czeka 14 dni");
  });

  it("formatPaymentMessage: dodaje numer konta jeśli podany", () => {
    const msg = formatPaymentMessage("Lipowa", 2400, 14, {
      number: "PL12345678901234567890123456",
      owner: "Jan Kowalski",
    });
    expect(msg).toContain("Lipowa: 2400 zł czeka 14 dni");
    expect(msg).toContain("PL12345678901234567890123456");
  });

  it("generateSMSLink: generuje link sms:", () => {
    const link = generateSMSLink("Test", "123456789");
    expect(link).toMatch(/^sms:123456789\?body=/);
  });

  it("generateSMSLink: koduje wiadomość URL", () => {
    const link = generateSMSLink("Hello World", "123456789");
    expect(link).toContain("Hello%20World");
  });

  it("generateWhatsAppLink: generuje link https://wa.me/", () => {
    const link = generateWhatsAppLink("Test", "48123456789");
    expect(link).toMatch(/^https:\/\/wa\.me\/48123456789\?text=/);
  });

  it("generateWhatsAppLink: koduje wiadomość URL", () => {
    const link = generateWhatsAppLink("Hello World", "48123456789");
    expect(link).toContain("Hello%20World");
  });

  it("generateWhatsAppLink: obsługuje znaki specjalne", () => {
    const msg = "Kwota: 2 400 zł\nKonto: PL123";
    const link = generateWhatsAppLink(msg, "48123456789");
    expect(link).toContain("%0A"); // \n -> %0A
    expect(link).toContain("2%20400");
  });
});

describe("daysWaiting: zmiana czasu (D9)", () => {
  it("dwie doby kalendarzowe przez przejście na czas letni to 2 dni, nie 1", () => {
    const due = new Date(2026, 2, 28, 0, 0).getTime(); // 28 marca, północ
    const now = new Date(2026, 2, 30, 0, 0).getTime(); // 30 marca, północ (doba 29.03 miała 23 h)
    expect(daysWaiting(due, now)).toBe(2);
  });
  it("przez przejście na czas zimowy też 2 dni", () => {
    expect(daysWaiting(new Date(2026, 9, 24, 0, 0).getTime(), new Date(2026, 9, 26, 0, 0).getTime())).toBe(2);
  });
});

