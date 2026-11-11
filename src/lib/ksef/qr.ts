import type { InvoiceRecord } from "./yInvoices";

/** SHA-256 w hex → Base64URL bez dopełnienia (tak KSeF zapisuje skrót faktury w adresie kodu QR). */
export function hexToBase64Url(hex: string): string {
  const bytes = hex.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Adres KODU I z wizualizacji faktury (KSeF, `kody-qr.md`): `https://qr.ksef.mf.gov.pl/invoice/{NIP}/{DD-MM-RRRR}/{skrót}`,
 * gdzie data to P_1, a skrót to SHA-256 pliku XML w Base64URL. Środowisko produkcyjne; pod kodem drukujemy numer KSeF
 * albo „OFFLINE”, gdy faktury jeszcze tam nie wgrano.
 */
export function invoiceQrUrl(r: Pick<InvoiceRecord, "hash" | "invoice">): string {
  const [y, m, d] = r.invoice.issueDate.split("-");
  const nip = r.invoice.seller.nip.replace(/\D/g, "");
  return `https://qr.ksef.mf.gov.pl/invoice/${nip}/${d}-${m}-${y}/${hexToBase64Url(r.hash)}`;
}

/**
 * Kod QR jako PNG (data URL) do PDF. Używa `qrcode.react` renderowanego poza ekranem; bez canvasa (np. testy) zwraca
 * `undefined`, a PDF powstaje bez kodu.
 */
export async function qrPngDataUrl(value: string, size = 240): Promise<string | undefined> {
  try {
    const [{ createRoot }, { flushSync }, { QRCodeCanvas }, React] = await Promise.all([import("react-dom/client"), import("react-dom"), import("qrcode.react"), import("react")]);
    const host = document.createElement("div");
    const root = createRoot(host);
    flushSync(() => root.render(React.createElement(QRCodeCanvas, { value, size, marginSize: 2, level: "M" })));
    const canvas = host.querySelector("canvas");
    const url = canvas?.toDataURL("image/png");
    root.unmount();
    return url && url.startsWith("data:image/png") ? url : undefined;
  } catch {
    return undefined;
  }
}
