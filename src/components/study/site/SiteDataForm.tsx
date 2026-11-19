import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import { ChevronDown, Contact, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardClass } from "@/components/ui/card";
import { ClientDatalist } from "@/components/clients/ClientDatalist";
import { fillFromClient, findClientByName } from "@/lib/clients/siteClient";
import { getClients } from "@/lib/clients/store";
import { SITE_FIELD_MAX, SITE_NAME_MAX } from "@/lib/study/sites";
import { hasContactPicker, pickContact, SITE_ACCESS_MAX, SITE_PHONE_MAX } from "@/lib/study/contact";
import { cn } from "@/lib/utils";
import type { SiteForm } from "./siteForm";


const fieldClass =
  "w-full rounded-field border border-border bg-background px-3 py-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring sm:text-sm";

/**
 * „Edytuj dane” karty budowy (R2.2): nazwa, adres, inwestor, telefony, dostęp. Stan formularza, walidacja i zapis
 * zostają w `SiteCardDialog` (zapis przy wyjściu z okna, `persistDirty`) — tu sam widok.
 */
export function SiteDataForm({ form, setForm, setField, editing, setEditing, summary, dirty, error, save }: {
  form: SiteForm;
  setForm: Dispatch<SetStateAction<SiteForm>>;
  setField: (k: keyof SiteForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
  summary: string;
  dirty: boolean;
  error: string | null;
  save: () => void;
}) {
  return (
    <div className={`${cardClass} mx-5 mt-3`} data-testid="site-data">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        aria-expanded={editing}
        aria-controls="site-card-form"
        className="pressable flex w-full items-center gap-2 rounded-card px-3 py-2.5 text-left coarse:min-h-11"
      >
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="shrink-0 section-caps">Edytuj dane</span>
        <span className={cn("min-w-0 flex-1 truncate text-sm", !summary && "text-muted-foreground")}>
          {editing ? "" : summary || "bez adresu i kontaktów"}
        </span>
        {dirty && !editing && <span className="shrink-0 text-xs text-warning-ink">niezapisane</span>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", editing && "rotate-180")} aria-hidden />
      </button>
      {editing && (
    <form
      id="site-card-form"
      className="space-y-3 border-t border-border px-3 py-3"
      onSubmit={(e) => { e.preventDefault(); save(); }}
    >
      <label className="block space-y-1 text-xs text-muted-foreground">
        Nazwa
        <input
          value={form.name}
          onChange={setField("name")}
          maxLength={SITE_NAME_MAX}
          aria-invalid={!!error}
          aria-describedby={error ? "site-card-error" : undefined}
          className={fieldClass}
        />
      </label>
      {error && <p id="site-card-error" className="text-xs text-destructive-ink" role="alert">{error}</p>}
      <label className="block space-y-1 text-xs text-muted-foreground">
        Adres
        <input
          value={form.address}
          onChange={setField("address")}
          maxLength={SITE_FIELD_MAX}
          placeholder="ul. Lipowa 5, Kraków"
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Inwestor
        <input
          value={form.investor}
          list="site-card-client-list"
          onChange={setField("investor")}
          // Telefon i adres klienta wchodzą dopiero po wyjściu z pola: przy pisaniu „Jan” nie wolno ich brać od krótszego „Jan”.
          onBlur={() => { const known = findClientByName(getClients(), form.investor); if (known) setForm((f) => ({ ...f, ...fillFromClient(known, f) })); }}
          maxLength={SITE_FIELD_MAX}
          placeholder="np. Jan Kowalski"
          autoComplete="off"
          className={fieldClass}
        />
      </label>
      <ClientDatalist id="site-card-client-list" />
      <div className="block space-y-1 text-xs text-muted-foreground">
        <label>Telefon inwestora</label>
        <div className="flex gap-1">
          <input
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={setField("phone")}
            maxLength={SITE_PHONE_MAX}
            aria-label="Telefon inwestora"
            placeholder="600 100 200"
            autoComplete="off"
            className={cn(fieldClass, "flex-1")}
          />
          {hasContactPicker() && (
            <Button type="button" size="sm" variant="outline" onClick={async () => { const c = await pickContact(); if (c) setForm((f) => ({ ...f, phone: c.tel, investor: f.investor || c.name || "" })); }} title="Z kontaktów" aria-label="Wybierz inwestora z kontaktów" data-testid="pick-contact-investor">
              <Contact className="h-4 w-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0 space-y-1 text-xs text-muted-foreground">
          Kierownik budowy
          <input
            value={form.manager}
            onChange={setField("manager")}
            maxLength={SITE_FIELD_MAX}
            placeholder="imię"
            autoComplete="off"
            className={fieldClass}
          />
        </label>
        <div className="block min-w-0 space-y-1 text-xs text-muted-foreground">
          <label>Telefon kierownika</label>
          <div className="flex gap-1">
            <input
              type="tel"
              inputMode="tel"
              value={form.managerPhone}
              onChange={setField("managerPhone")}
              maxLength={SITE_PHONE_MAX}
              aria-label="Telefon kierownika"
            placeholder="600 100 200"
              autoComplete="off"
              className={cn(fieldClass, "flex-1")}
            />
            {hasContactPicker() && (
              <Button type="button" size="sm" variant="outline" onClick={async () => { const c = await pickContact(); if (c) setForm((f) => ({ ...f, managerPhone: c.tel, manager: f.manager || c.name || "" })); }} title="Z kontaktów" aria-label="Wybierz kierownika z kontaktów" data-testid="pick-contact-manager">
                <Contact className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
        <div className="block min-w-0 space-y-1 text-xs text-muted-foreground">
          <label>Telefon hurtowni (WhatsApp zamówień)</label>
          <div className="flex gap-1">
            <input
              type="tel"
              inputMode="tel"
              value={form.supplierPhone}
              onChange={setField("supplierPhone")}
              maxLength={SITE_PHONE_MAX}
              aria-label="Telefon hurtowni (WhatsApp zamówień)"
            placeholder="np. hurtownia 22 000 00 00"
              autoComplete="off"
              className={cn(fieldClass, "flex-1")}
            />
            {hasContactPicker() && (
              <Button type="button" size="sm" variant="outline" onClick={async () => { const c = await pickContact(); if (c) setForm((f) => ({ ...f, supplierPhone: c.tel })); }} title="Z kontaktów" aria-label="Wybierz hurtownię z kontaktów" data-testid="pick-contact-supplier">
                <Contact className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Dostęp do budowy
        <textarea
          value={form.access}
          onChange={setField("access")}
          maxLength={SITE_ACCESS_MAX}
          rows={2}
          placeholder="np. kod do bramy 1234#, klucze u sąsiada spod 7"
          className={`${fieldClass} resize-none`}
        />
      </label>
      <Button type="submit" disabled={!dirty || !!error} className="w-full coarse:h-11">Zapisz kartę</Button>
    </form>
      )}
    </div>
  );
}
