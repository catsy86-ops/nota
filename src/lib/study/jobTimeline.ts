import type { Job } from "./jobs";

/**
 * R3.2 „Oś zlecenia”: wycena → zaliczka → realizacja → protokół → faktura → zapłata → gwarancja, liczone
 * z danych, które już są (zlecenie, karta budowy, faktury). Czysta funkcja; nic nie zapisuje.
 * Zaliczka nie jest obowiązkowa — gdy zlecenie poszło dalej bez niej, krok jest „pominięty”, nie „brak”.
 */

export const TIMELINE_STEPS = ["quote", "deposit", "work", "protocol", "invoice", "payment", "warranty"] as const;
export type TimelineStep = (typeof TIMELINE_STEPS)[number];
export const TIMELINE_LABEL: Readonly<Record<TimelineStep, string>> = {
  quote: "Wycena", deposit: "Zaliczka", work: "Realizacja", protocol: "Protokół", invoice: "Faktura", payment: "Zapłata", warranty: "Gwarancja",
};

type StepState = "done" | "skipped" | "current" | "todo";

export interface TimelineInput {
  job: Pick<Job, "status" | "items" | "doc">;
  /** Podpis klienta na protokole odbioru (`SiteCard.signature`). */
  signed: boolean;
  /** Koniec gwarancji „RRRR-MM-DD” z karty budowy. */
  warranty?: string;
  /** Czy jest faktura zwykła (nie korekta) do tej budowy. */
  invoiced: boolean;
}

export function jobTimeline({ job, signed, warranty, invoiced }: TimelineInput): { step: TimelineStep; state: StepState }[] {
  const finished = job.status === "done" || job.status === "paid";
  const done: Record<TimelineStep, boolean> = {
    quote: job.items.length > 0,
    deposit: (job.doc?.depositPaid ?? 0) > 0,
    work: finished,
    protocol: signed,
    invoice: invoiced,
    payment: job.status === "paid",
    warranty: Boolean(warranty),
  };
  // Zaliczka po rozpoczęciu dalszych kroków jest już tylko „pominięta”.
  const pastDeposit = TIMELINE_STEPS.slice(2).some((s) => done[s]) || job.status === "booked";
  let current = false;
  return TIMELINE_STEPS.map((step) => {
    if (done[step]) return { step, state: "done" as const };
    if (step === "deposit" && pastDeposit) return { step, state: "skipped" as const };
    if (!current) { current = true; return { step, state: "current" as const }; }
    return { step, state: "todo" as const };
  });
}
