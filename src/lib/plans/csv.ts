import { metersText, PIPE_STATUS_LABEL, pipeLabel, symbolLabel, type PipeGroupStatus, type PlanSummary } from "./summary";
import { SYSTEM_META } from "./systems";

/**
 * Zestawienie jako CSV pod polski Excel (D9): separator „;”, BOM UTF-8, przecinek dziesiętny,
 * CRLF. Komórka zaczynająca się od `=`, `+`, `-`, `@`, tabulatora albo CR dostaje apostrof —
 * opis z planu nie może stać się formułą w arkuszu (wstrzykiwanie formuł CSV).
 */

export function csvCell(v: string | number): string {
  let s = typeof v === "number" ? String(v).replace(".", ",") : v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (cells: (string | number)[]) => cells.map(csvCell).join(";");

export function summaryCsv(s: PlanSummary, planName: string): string {
  const lines: string[] = [row(["Analiza", planName]), row(["Sekcja", "Pozycja", "Instalacja", "Średnica [mm]", "Ilość", "Jednostka", "Uwagi"])];
  for (const status of ["confirmed", "estimated", "noScale", "unverified"] as PipeGroupStatus[]) {
    for (const r of s.pipes[status]) {
      const qty = r.meters === null ? Math.round(r.pixels) : metersText(r.meters);
      lines.push(row([PIPE_STATUS_LABEL[status], pipeLabel(r), SYSTEM_META[r.system].label, r.diameterMm ?? "", qty, r.meters === null ? "px" : "m",
        `${r.routeIds.length} tras${r.meters === null ? ", plan bez skali — długość w pikselach" : ""}`]));
    }
  }
  for (const [verified, label] of [[true, "Symbole zatwierdzone"], [false, "Symbole do weryfikacji"]] as const) {
    for (const r of verified ? s.symbols.verified : s.symbols.unverified) {
      lines.push(row([label, symbolLabel(r), r.system ? SYSTEM_META[r.system].label : "", "", r.count, "szt", ""]));
    }
  }
  for (const i of s.items) {
    lines.push(row(["Pozycje ręczne", i.description, i.system ? SYSTEM_META[i.system].label : "", i.diameterMm ?? "", i.quantity, i.unit, `${i.category}${i.verified ? "" : ", do weryfikacji"}`]));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** Nazwa pliku: bez znaków, które źle znoszą systemy plików. */
export const summaryFileName = (planName: string) => `Zestawienie - ${planName.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "plan"}.csv`;
