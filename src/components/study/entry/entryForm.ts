import type { JournalDraft } from "@/lib/study/draft";

/** Pola wspólne dla szkicu nowego wpisu i edycji zapisanego. */
export type FormFields = Pick<JournalDraft, "topic" | "kind" | "text" | "checked" | "images" | "captions" | "drawnFrom" | "dimensions" | "point" | "level" | "barcode" | "summary" | "recordings" | "test" | "fittings" | "pipes" | "stage" | "geo">;

/** Formularz arkusza dla sekcji: bieżący stan do rysowania, odczyt na świeżo (operacje asynchroniczne) i łatka. */
export interface EntryForm {
  form: FormFields;
  getForm: () => FormFields;
  patch: (p: Partial<FormFields>) => void;
}
