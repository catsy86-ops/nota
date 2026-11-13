import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";
import { CLIENT_NAME_MAX, CLIENT_PHONE_MAX, CLIENTS_MAX, findDuplicates, searchClients, type Client } from "@/lib/clients/model";
import { addClient, useClientLinks, useClients } from "@/lib/clients/store";
import { applyProposals, proposeClients, type ClientProposal } from "@/lib/clients/fromSites";
import { useSiteDirectory } from "@/lib/study/studyProjection";
import { siteKey } from "@/lib/study/siteKey";
import { prettyPhone } from "@/lib/study/contact";
import { ClientCard } from "./ClientCard";
import { ClientKindToggle } from "./ClientKindToggle";

const fieldCls = "h-9 w-full rounded-field border border-input bg-background px-2 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";

function NewClientDialog({ open, onOpenChange, clients, onOpen }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: readonly Client[];
  /** Otwarcie karty klienta: nowo założonego albo już istniejącego o tej samej nazwie. */
  onOpen: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<Client["kind"]>("person");
  const [failed, setFailed] = useState(false);
  const twins = useMemo(() => (name.trim() ? findDuplicates(clients, { name, nip: "" }) : []), [clients, name]);

  const reset = () => { setName(""); setPhone(""); setKind("person"); setFailed(false); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const c = addClient({ name, phone, kind });
    if (!c) { setFailed(true); return; }
    reset();
    onOpenChange(false);
    onOpen(c.id);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <ResponsiveDialogContent className="sm:max-w-sm" data-testid="new-client-dialog">
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle className="font-display">Nowy klient</DialogTitle>
            <DialogDescription>Nazwa wystarczy. NIP, adres i resztę dopiszesz na karcie klienta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <label htmlFor="new-client-name" className="text-xs text-muted-foreground">Imię i nazwisko albo firma</label>
            <input id="new-client-name" autoFocus value={name} maxLength={CLIENT_NAME_MAX} autoComplete="off" onChange={(e) => { setName(e.target.value); setFailed(false); }}
              aria-invalid={failed ? true : undefined} className={fieldCls} data-testid="new-client-name" />
          </div>
          {twins.length > 0 && (
            <p className="rounded-field bg-warning/15 px-3 py-2 text-sm" role="status" data-testid="new-client-twin">
              Klient o tej nazwie już jest:{" "}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => { onOpenChange(false); onOpen(twins[0].id); }}>otwórz {twins[0].name}</button>.
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="new-client-phone" className="text-xs text-muted-foreground">Telefon (opcjonalnie)</label>
            <input id="new-client-phone" value={phone} maxLength={CLIENT_PHONE_MAX} inputMode="tel" type="tel" autoComplete="off" onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
          </div>
          <ClientKindToggle value={kind} onChange={setKind} />
          {failed && <p role="alert" className="text-sm text-destructive">Nie udało się dodać: wpisz nazwę (kartoteka mieści do {CLIENTS_MAX} klientów).</p>}
          <ResponsiveDialogFooter>
            <Button type="submit" disabled={!name.trim()} className="coarse:h-11" data-testid="new-client-save">Dodaj klienta</Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

const DISMISS_KEY = "kaczy.clients.importDismissed.v1";
// Do localStorage trafia skrót listy, nie nazwy klientów (dane osobowe nie leżą tam jawnym tekstem).
const signature = (list: readonly ClientProposal[]) => siteKey(list.map((p) => p.key).join("|"));
const readDismissed = () => { try { return localStorage.getItem(DISMISS_KEY); } catch { return null; } };

/** Okno propozycji z budów (1.6): wszystko zaznaczone, odznaczasz to, czego nie chcesz; nic nie dzieje się bez „Utwórz”. */
function ImportDialog({ open, onOpenChange, proposals }: { open: boolean; onOpenChange: (open: boolean) => void; proposals: readonly ClientProposal[] }) {
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const chosen = proposals.filter((p) => !off.has(p.key));
  const toggle = (key: string) => setOff((cur) => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const run = () => {
    const r = applyProposals(chosen);
    onOpenChange(false);
    setOff(new Set());
    if (r.failed > 0) toast.error(`Nie udało się dodać ${r.failed} ${pluralPl(r.failed, ["klienta", "klientów", "klientów"])}`, { description: "Kartoteka jest pełna albo nazwa jest nieprawidłowa." });
    else toast.success(`Dodano klientów: ${r.created}, podłączono budów: ${r.linked}`);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md" data-testid="client-import-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">Klienci z budów</DialogTitle>
          <DialogDescription>Inwestorzy wpisani w kartach budów. Odznacz tych, których nie chcesz w kartotece.</DialogDescription>
        </DialogHeader>
        <ul className="-mx-1 max-h-[50dvh] space-y-1 overflow-y-auto px-1" aria-label="Propozycje klientów">
          {proposals.map((p) => (
            <li key={p.key}>
              <label className="flex cursor-pointer items-start gap-3 rounded-field border border-border px-3 py-2 coarse:min-h-11">
                <input type="checkbox" checked={!off.has(p.key)} onChange={() => toggle(p.key)} className="mt-1 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.existingId ? "Już w kartotece — tylko podłącz budowy" : [p.phone && prettyPhone(p.phone), p.address].filter(Boolean).join(" · ") || "Bez telefonu i adresu"}
                    {" · "}{p.siteIds.length} {pluralPl(p.siteIds.length, ["budowa", "budowy", "budów"])}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <ResponsiveDialogFooter>
          <Button type="button" onClick={run} disabled={chosen.length === 0} className="coarse:h-11" data-testid="client-import-run">
            Utwórz ({chosen.length})
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

/**
 * Zakładka „Klienci” w Pracy (plan wycen i klientów, 1.4–1.5): szukanie po nazwie, telefonie, NIP-ie i adresie,
 * lista aktywnych i archiwalnych, „Nowy klient” i karta z edycją w miejscu.
 */
export default function ClientsView({ onOpenSite, onOpenDebts, requestedId, onRequestHandled }: {
  onOpenSite?: (siteId: string) => void;
  onOpenDebts?: () => void;
  /** Klient do otwarcia z zewnątrz (paleta poleceń); po otwarciu rodzic dostaje `onRequestHandled`. */
  requestedId?: string | null;
  onRequestHandled?: () => void;
} = {}) {
  const clients = useClients();
  const links = useClientLinks();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const dir = useSiteDirectory();
  useEffect(() => {
    if (!requestedId) return;
    setOpenId(requestedId);
    onRequestHandled?.();
  }, [requestedId, onRequestHandled]);
  const [importOpen, setImportOpen] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  // Propozycja z kart budów (1.6): tylko budowy bez klienta; po „Nie teraz” wraca dopiero, gdy lista się zmieni.
  const proposals = useMemo(() => proposeClients(dir.filter((s) => s.stored), clients, links), [dir, clients, links]);
  const showImport = proposals.length > 0 && dismissed !== signature(proposals);
  const dismiss = () => { const sig = signature(proposals); setDismissed(sig); try { localStorage.setItem(DISMISS_KEY, sig); } catch { /* bez zapisu baner wróci */ } };

  const sitesOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [site, id] of links) m.set(id, [...(m.get(id) ?? []), site]);
    return m;
  }, [links]);
  const archivedCount = clients.filter((c) => c.archived).length;
  const found = useMemo(() => searchClients(clients, query).filter((c) => showArchived || !c.archived || query.trim() !== ""), [clients, query, showArchived]);
  const current = openId ? clients.find((c) => c.id === openId) : undefined;

  return (
    <section className="space-y-4" aria-label="Klienci" data-testid="clients-view">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" enterKeyHint="search" aria-label="Szukaj klienta" placeholder="Nazwa, telefon, NIP, adres" value={query} onChange={(e) => setQuery(e.target.value)}
            className={cn(fieldCls, "pl-8")} data-testid="clients-search" />
        </div>
        <Button type="button" onClick={() => setNewOpen(true)} className="coarse:h-11" data-testid="client-new"><Plus className="h-4 w-4" aria-hidden />Nowy klient</Button>
      </div>

      {showImport && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary/40 bg-primary/10 px-3 py-2" data-testid="client-import-banner">
          <p className="min-w-0 flex-1 text-sm">
            W kartach budów jest {proposals.length} {pluralPl(proposals.length, ["inwestor", "inwestorzy", "inwestorów"])} bez klienta w kartotece.
          </p>
          <Button type="button" size="sm" onClick={() => setImportOpen(true)} className="coarse:h-11" data-testid="client-import-open">Przejrzyj</Button>
          <Button type="button" size="sm" variant="ghost" onClick={dismiss} className="coarse:h-11">Nie teraz</Button>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="rounded-card border border-dashed border-border px-4 py-8 text-center" data-testid="clients-empty">
          <UserRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-medium">Nie masz jeszcze klientów</p>
          <p className="ui-hint mt-1">Z kartoteki wybierzesz inwestora przy nowej budowie, a dane do faktury wypełnią się same.</p>
        </div>
      ) : found.length === 0 ? (
        <p className="ui-hint" role="status" data-testid="clients-none">Nikt nie pasuje do „{query.trim()}”.</p>
      ) : (
        <ul className="space-y-1" aria-label="Lista klientów">
          {found.map((c) => {
            const n = sitesOf.get(c.id)?.length ?? 0;
            const Icon = c.kind === "company" ? Building2 : UserRound;
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setOpenId(c.id)} data-testid="client-row"
                  className={cn("pressable flex w-full items-center gap-3 rounded-field border border-border px-3 py-2 text-left hover:bg-muted coarse:min-h-11", c.archived && "opacity-60")}>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.phone && prettyPhone(c.phone), c.address1].filter(Boolean).join(" · ") || "Bez telefonu i adresu"}
                    </span>
                  </span>
                  {c.archived ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs">Archiwum</span>
                    : n > 0 && <span className="shrink-0 text-xs text-muted-foreground">{n} {pluralPl(n, ["budowa", "budowy", "budów"])}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {archivedCount > 0 && query.trim() === "" && (
        <button type="button" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}
          className="pressable text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline coarse:min-h-11">
          {showArchived ? "Ukryj archiwum" : `Pokaż archiwum (${archivedCount})`}
        </button>
      )}

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} proposals={proposals} />
      <NewClientDialog open={newOpen} onOpenChange={setNewOpen} clients={clients} onOpen={setOpenId} />
      <ClientCard client={current} siteIds={current ? sitesOf.get(current.id) ?? [] : []} onClose={() => setOpenId(null)} onOpenSite={onOpenSite} onOpenDebts={onOpenDebts} />
    </section>
  );
}
