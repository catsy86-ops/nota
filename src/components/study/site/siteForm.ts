/** Pola formularza „Edytuj dane” karty budowy (R2.2). */
export const EMPTY_FORM = { name: "", address: "", investor: "", phone: "", manager: "", managerPhone: "", supplierPhone: "", access: "" };
export type SiteForm = typeof EMPTY_FORM;
export const formOf = (s: Partial<SiteForm>): SiteForm => ({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(s).filter(([k, v]) => k in EMPTY_FORM && typeof v === "string")) });
