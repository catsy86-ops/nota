import { PdfWriter, pdfFileName } from "@/lib/study/pdfWriter";
import { PDF_TYPE } from "@/lib/pdfType";
import { DEBT_KIND_LABEL, formatAmount, runningBalances, type PersonDebts } from "./model";

/**
 * L4.4 „Rozliczenie” osoby jako PDF — odpowiednik „Wyślij” do wydruku: saldo, stan na dzień i wszystkie wpisy
 * od najnowszego z saldem po każdym. Kwoty zawsze widoczne (jak w wiadomości) — to dokument dla drugiej strony.
 */

export const debtStatementPdfName = (person: string) => pdfFileName("Rozliczenie", person);

const dmy = (key: string) => key.split("-").reverse().join(".");

const balanceText = (b: number) => (b === 0 ? "Rozliczone" : b > 0 ? `Do oddania: ${formatAmount(b)}` : `Jestem winien: ${formatAmount(-b)}`);

export async function buildDebtStatementPdf(p: PersonDebts, today: string): Promise<Blob> {
  const w = await PdfWriter.create();
  w.line("Rozliczenie", PDF_TYPE.title, "bold");
  w.line(p.name, PDF_TYPE.heading, "bold");
  w.line(`Stan na ${dmy(today)}`);
  w.gap(2);
  w.line(balanceText(p.balance), PDF_TYPE.subtitle, "bold");

  w.heading("Wpisy");
  const running = runningBalances(p.entries);
  p.entries.forEach((e, i) => {
    w.line(`${dmy(e.at)} · ${DEBT_KIND_LABEL[e.kind]} · ${formatAmount(e.amount)}${e.note ? ` · ${e.note}` : ""}`, PDF_TYPE.body, "normal", 2);
    w.line(`saldo po wpisie: ${formatAmount(running[i] ?? 0)}`, PDF_TYPE.table, "normal", 6);
  });
  return w.finish();
}
