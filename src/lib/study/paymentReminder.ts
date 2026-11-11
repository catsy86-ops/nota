/**
 * B4.2: Przypomnienie o należności. Na Dziś: „Lipowa: 2 400 zł czeka 14 dni".
 * Wysyłanie SMS/WhatsApp z kwotą i numerem konta.
 */

export interface PaymentReminder {
  siteId: string;        // ID budowy (np. "Lipowa")
  amount: number;        // kwota w zł
  dueDate: number;       // timestamp
  sent?: number;         // timestamp wysłania przypomnienia (undefined = nie wysłano)
}

export interface BankAccount {
  number: string;        // nr konta (IBAN)
  owner: string;         // nazwa właściciela
}

export function daysWaiting(dueDate: number, now = Date.now()): number {
  // Różnica zegarowa, nie 24 h * n: między terminem a dziś może być zmiana czasu (doba 23/25 h), D9 audytu.
  const shiftMin = new Date(dueDate).getTimezoneOffset() - new Date(now).getTimezoneOffset();
  const days = Math.floor((now - dueDate + shiftMin * 60_000) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

export function formatPaymentMessage(siteName: string, amount: number, days: number, account?: BankAccount): string {
  const message = `${siteName}: ${amount} zł czeka ${days} dni`;
  if (account) {
    return `${message}\nKonto: ${account.number}`;
  }
  return message;
}

/** Numer tylko z cyfr i opcjonalnym wiodącym „+”; reszta (np. „?”, „&”, „;”) odpada, by nie wstrzyknąć parametrów linku. */
export const cleanPhone = (phone: string) => {
  const plus = phone.trim().startsWith("+") ? "+" : "";
  return plus + phone.replace(/\D/g, "");
};

export function generateSMSLink(message: string, phone: string): string {
  return `sms:${cleanPhone(phone)}?body=${encodeURIComponent(message)}`;
}

export function generateWhatsAppLink(message: string, phone: string): string {
  return `https://wa.me/${cleanPhone(phone).replace("+", "")}?text=${encodeURIComponent(message)}`;
}
