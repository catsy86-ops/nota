import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, FilePlus2, MapPin, MessageSquare, Phone, Trash2, UserRound } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { ClientKindToggle } from "./ClientKindToggle";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { toast } from "sonner";
import {
  CLIENT_ADDRESS_MAX, CLIENT_EMAIL_MAX, findDuplicates, CLIENT_KIND_LABEL, CLIENT_NAME_MAX, CLIENT_NOTE_MAX, CLIENT_PHONE_MAX,
  clientAddress, isPlausibleEmail, parseClientNip, type Client, type ClientField,
} from "@/lib/clients/model";
import { archiveClient, removeClient, restoreClient, setClientField, useClients } from "@/lib/clients/store";
import { mergeClients } from "@/lib/clients/merge";
import { newQuoteForClient } from "@/lib/study/newClientQuote";
import { useSiteDirectory } from "@/lib/study/studyProjection";
import { ClientHistory } from "./ClientHistory";
import { hasContactPicker, mapsHref, pickContact, prettyPhone, smsHref, telHref } from "@/lib/study/contact";

const fieldCls = "h-9 w-full rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring aria-invalid:border-destructive coarse:h-11 sm:text-sm";
const ACTION = "pressable inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted coarse:min-h-11";

/**
 * Pole klienta zapisywane przy wyjściu z pola (Enter też zatwierdza), po jednym kluczu w Yjs — edycja telefonu na jednym
 * urządzeniu i adresu na drugim się scala. Wartość odrzucona (zły NIP, e-mail, pusta nazwa) zostaje w polu z komunikatem
 * i nie jest zapisywana; zdalna zmiana pola, którego nie edytujesz, odświeża jego tekst.
 */
function Field({ client, field, label, max, error = () => null, multiline, ...rest }: {
  client: Client;
  field: Exclude<ClientField, "kind" | "archived">;
  label: string;
  max: number;
  /** Komunikat błędu dla wpisanego tekstu albo `null`; bez tego propsa pole przyjmuje wszystko. */
  error?: (v: string) => string | null;
  multiline?: boolean;
} & Pick<React.ComponentProps<"input">, "inputMode" | "type" | "autoComplete">) {
  const stored = client[field];
  const [text, setText] = useState(stored);
  const focused = useRef(false);
  const [problem, setProblem] = useState<string | null>(null);
  // Zdalna zmiana pola, którego nie edytujesz, odświeża tekst; odrzucony wpis (z błędem) zostaje, dopóki nie zmieni się zapisana wartość.
  useEffect(() => { if (!focused.current) { setText(stored); setProblem(null); } }, [stored]);
  const commit = () => {
    focused.current = false;
    const msg = error(text);
    if (msg) { setProblem(msg); return; }
    setProblem(null);
    if (text.trim() !== stored) setClientField(client.id, field, text);
  };
  const id = `client-${client.id}-${field}`;
  const shared = {
    id, value: text, maxLength: max, "aria-invalid": problem ? true : undefined, "aria-describedby": problem ? `${id}-err` : undefined,
    onFocus: () => { focused.current = true; }, onBlur: commit,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setText(e.target.value),
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
      {multiline
        ? <textarea {...shared} rows={3} className={cn(fieldCls, "h-auto py-1.5")} />
        : <input {...shared} {...rest} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className={cn(fieldCls, field === "nip" && "font-mono")} />}
      {problem && <p id={`${id}-err`} role="alert" className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}

/** Karta klienta: dane z edycją w miejscu, szybki kontakt (zadzwoń, SMS, nawiguj), archiwum i usuwanie z „Cofnij”. */
export function ClientCard({ client, siteIds, onClose, onOpenSite, onOpenDebts }: {
  client: Client | undefined;
  siteIds: readonly string[];
  onClose: () => void;
  onOpenSite?: (siteId: string) => void;
  onOpenDebts?: () => void;
}) {
  const open = !!client;
  // Karta zostaje na ekranie z ostatnimi danymi, gdy klient zniknie (usunięty tu albo na drugim urządzeniu).
  const [last, setLast] = useState<Client | undefined>(client);
  useEffect(() => { if (client) setLast(client); }, [client]);
  const c = client ?? last;
  const all = useClients();
  const dir = useSiteDirectory();
  const others = useMemo(() => (c ? all.filter((x) => x.id !== c.id) : []), [all, c]);
  const twin = useMemo(() => (c ? findDuplicates(all, c, c.id)[0] : undefined), [all, c]);
  const [mergeId, setMergeId] = useState("");
  if (!c) return null;

  const tel = c.phone ? telHref(c.phone) : null;
  const sms = c.phone ? smsHref(c.phone) : null;
  const maps = mapsHref(clientAddress(c));

  const remove = () => {
    const removed = removeClient(c.id);
    if (!removed) return;
    onClose();
    toastWithUndo(`Usunięto klienta: ${removed.client.name}`, () => {
      if (!restoreClient(removed.client, removed.siteIds)) toast.error("Nie udało się przywrócić klienta");
    }, { description: siteIds.length > 0 ? "Budowy zostają, tracą tylko powiązanie z klientem." : undefined });
  };

  const newQuote = () => {
    const made = newQuoteForClient(c, dir);
    if (!made) { toast.error("Nie udało się założyć wyceny"); return; }
    onClose();
    toast.success(`Założono wycenę „${made.name}”`);
    onOpenSite?.(made.id);
  };

  const merge = (dropId: string) => {
    const dropName = all.find((x) => x.id === dropId)?.name ?? "klienta";
    const r = mergeClients(c.id, dropId);
    if (!r) { toast.error("Nie udało się scalić klientów"); return; }
    setMergeId("");
    toastWithUndo(`Scalono „${dropName}” z „${c.name}”`, r.undo, {
      description: `Przeniesione budowy: ${r.moved}, uzupełnione pola: ${r.filled}.`,
    });
  };

  const fromContacts = async () => {
    const picked = await pickContact();
    if (!picked) return;
    setClientField(c.id, "phone", picked.tel);
    if (picked.name && !c.name) setClientField(c.id, "name", picked.name);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="sm:max-w-md" data-testid="client-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><UserRound className="h-5 w-5 shrink-0" aria-hidden /><span className="min-w-0 truncate">{c.name}</span></DialogTitle>
          <DialogDescription>{CLIENT_KIND_LABEL[c.kind]}{c.archived ? " · w archiwum" : ""}{siteIds.length > 0 ? ` · budowy: ${siteIds.length}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2" data-testid="client-actions">
          {tel && <a href={tel} className={ACTION}><Phone className="h-4 w-4" aria-hidden />Zadzwoń</a>}
          {sms && <a href={sms} className={ACTION}><MessageSquare className="h-4 w-4" aria-hidden />SMS</a>}
          {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className={ACTION}><MapPin className="h-4 w-4" aria-hidden />Nawiguj</a>}
          {!c.archived && (
            <button type="button" onClick={newQuote} className={cn(ACTION, "border-primary/50 bg-primary/10 font-medium text-primary-ink")} data-testid="client-new-quote">
              <FilePlus2 className="h-4 w-4" aria-hidden />Nowa wycena
            </button>
          )}
          {!tel && !maps && <p className="ui-hint">Dodaj telefon albo adres, a pojawią się tu skróty „Zadzwoń” i „Nawiguj”.</p>}
        </div>

        <ClientHistory client={c} siteIds={siteIds} onOpenSite={onOpenSite && ((id) => { onClose(); onOpenSite(id); })} onOpenDebts={onOpenDebts && (() => { onClose(); onOpenDebts(); })} />

        <div className="space-y-3">
          <Field client={c} field="name" label="Nazwa" max={CLIENT_NAME_MAX} autoComplete="off"
            error={(v) => (v.trim() ? null : "Nazwa nie może być pusta.")} />
          <ClientKindToggle value={c.kind} onChange={(k) => setClientField(c.id, "kind", k)} />
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field client={c} field="phone" label="Telefon" max={CLIENT_PHONE_MAX} inputMode="tel" type="tel" autoComplete="off" />
            </div>
            {hasContactPicker() && (
              <Button type="button" size="sm" variant="outline" onClick={fromContacts} className="coarse:h-11" aria-label="Wybierz telefon z kontaktów" data-testid="client-pick-contact">Z kontaktów</Button>
            )}
          </div>
          {c.phone && <p className="ui-meta -mt-2 font-mono">{prettyPhone(c.phone)}</p>}
          <Field client={c} field="email" label="E-mail" max={CLIENT_EMAIL_MAX} inputMode="email" type="email" autoComplete="off"
            error={(v) => (isPlausibleEmail(v.trim()) ? null : "To nie wygląda na adres e-mail.")} />
          <Field client={c} field="nip" label="NIP (puste = klient prywatny)" max={20} inputMode="numeric" autoComplete="off"
            error={(v) => (parseClientNip(v) === undefined ? "Nieprawidłowy NIP — sprawdź cyfry." : null)} />
          <Field client={c} field="address1" label="Adres" max={CLIENT_ADDRESS_MAX} autoComplete="off" />
          <Field client={c} field="address2" label="Adres, drugi wiersz (kod i miasto)" max={CLIENT_ADDRESS_MAX} autoComplete="off" />
          <Field client={c} field="note" label="Notatka" max={CLIENT_NOTE_MAX} multiline />
        </div>

        {others.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-3" data-testid="client-merge">
            {twin && (
              <p className="text-xs" role="status" data-testid="client-twin">
                Możliwy duplikat: <span className="font-medium">{twin.name}</span>.{" "}
                <button type="button" className="pressable underline underline-offset-2 coarse:min-h-11" onClick={() => merge(twin.id)}>Scal tutaj</button>
              </p>
            )}
            <div className="flex items-center gap-2">
              <label htmlFor={`client-merge-${c.id}`} className="sr-only">Klient do scalenia z tą kartą</label>
              <select id={`client-merge-${c.id}`} value={mergeId} onChange={(e) => setMergeId(e.target.value)}
                className={cn(fieldCls, "min-w-0 flex-1")}>
                <option value="">Scal z innym klientem…</option>
                {others.map((x) => <option key={x.id} value={x.id}>{x.name}{x.archived ? " (archiwum)" : ""}</option>)}
              </select>
              <Button type="button" size="sm" variant="outline" disabled={!mergeId} onClick={() => merge(mergeId)} className="coarse:h-11" data-testid="client-merge-run">Scal</Button>
            </div>
            <p className="ui-hint">Wybrany klient znika, a jego budowy i brakujące dane trafiają do tej karty. Da się cofnąć.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => archiveClient(c.id, !c.archived)} className="coarse:h-11">
            {c.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
            {c.archived ? "Przywróć z archiwum" : "Do archiwum"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={remove} className="text-destructive coarse:h-11" data-testid="client-remove">
            <Trash2 className="h-4 w-4" aria-hidden />Usuń
          </Button>
        </div>
        <p className="ui-hint">Dane klienta są tylko u Ciebie i na Twoich urządzeniach — nie trafiają do raportu dla szefa ani do paczki budowy.</p>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
