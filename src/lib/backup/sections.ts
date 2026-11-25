import { yjsStore } from "@/lib/yjsStore";

/**
 * Sekcje kopii niesione jako JSON w stringu i scalane przy przywracaniu. Nowy dział: jedna pozycja tutaj + pole w schemacie
 * i budowie kopii. `load` wczytuje moduł w fazie sprawdzania; zwrócona funkcja scala **synchronicznie** w fazie zapisu.
 * Kolejność ma znaczenie (P8): `training` sprawdza notatki, więc idzie po wymianie notatek.
 */
export type MergeKey = "supplements" | "diet" | "weight" | "training" | "debts" | "debtPlans" | "debtProofs" | "entryCheck" | "kits" | "views" | "points" | "plans" | "billing" | "van" | "invoices" | "pricing" | "clients" | "jobs";
export type Merge = (dump: never) => unknown;
export const MERGE_SECTIONS: readonly { key: MergeKey; label: string; load: () => Promise<Merge> }[] = [
  { key: "supplements", label: "Suplementy", load: async () => (await import("@/lib/supplements/store")).mergeSupplementDump },
  { key: "diet", label: "Dieta", load: async () => (await import("@/lib/diet/store")).mergeDietDump },
  { key: "weight", label: "Waga", load: async () => (await import("@/lib/weight/store")).mergeWeightDump },
  // Notatki z kopii są już wczytane, więc można sprawdzić, czy przypomnienie ma swoją notatkę.
  { key: "training", label: "Trening", load: async () => { const m = await import("@/lib/training/store"); return (d: never) => m.mergeTrainingDump(d, (id: string) => yjsStore.projectNotes().some((n) => n.id === id)); } },
  { key: "debts", label: "Długi", load: async () => (await import("@/lib/debts/store")).mergeDebtsDump },
  // Po „Długi”: plan bez pożyczki jest pomijany.
  { key: "debtPlans", label: "Raty", load: async () => (await import("@/lib/debts/store")).mergeDebtPlansDump },
  // Po „Długi”: dowód bez wpisu jest pomijany.
  { key: "debtProofs", label: "Dowody długów", load: async () => (await import("@/lib/debts/store")).mergeDebtProofsDump },
  { key: "entryCheck", label: "Lista przed wejściem", load: async () => (await import("@/lib/study/entryCheckStore")).mergeEntryCheckDump },
  { key: "kits", label: "Zestawy", load: async () => (await import("@/lib/study/kitsStore")).mergeKitsDump },
  { key: "views", label: "Widoki", load: async () => (await import("@/lib/savedViews")).mergeViewsDump },
  { key: "points", label: "Punkty wodne", load: async () => (await import("@/lib/study/pointsStore")).mergePointsDump },
  { key: "plans", label: "Plany", load: async () => (await import("@/lib/plans/plansStore")).mergePlansDump },
  { key: "billing", label: "Rozliczenia", load: async () => (await import("@/lib/study/billingStore")).mergeBillingDump },
  { key: "van", label: "Auto", load: async () => (await import("@/lib/study/vanStore")).mergeVanDump },
  { key: "invoices", label: "Faktury", load: async () => (await import("@/lib/ksef/invoicesStore")).mergeInvoicesDump },
  { key: "pricing", label: "Cenniki", load: async () => (await import("@/lib/study/pricingStore")).mergePricingDump },
  { key: "clients", label: "Klienci", load: async () => (await import("@/lib/clients/store")).mergeClientsDump },
  { key: "jobs", label: "Fuchy", load: async () => (await import("@/lib/study/jobsStore")).mergeJobsDump },
];

export const SHIFTS_SECTION = "Grafik";
export const STUDY_SECTION = "Nauka i Praca";
