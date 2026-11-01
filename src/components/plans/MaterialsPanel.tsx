import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Send, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { downloadBlob } from "@/lib/downloadBlob";
import { summaryCsv, summaryFileName } from "@/lib/plans/csv";
import { parseDecimal } from "@/lib/plans/geometry";
import { PLAN_ITEMS_MAX, PLAN_LABEL_MAX, type MaterialItem } from "@/lib/plans/model";
import { newPlanId, removePlanEntity, savePlanEntity, stopPlansCapture } from "@/lib/plans/plansStore";
import { buildSummary, metersText, PIPE_STATUS_LABEL, pipeLabel, shortageItems, symbolLabel, type PipeGroupStatus } from "@/lib/plans/summary";
import { SYSTEM_META } from "@/lib/plans/systems";
import type { PlanData } from "@/lib/plans/yPlans";
import { toastWithUndo } from "@/lib/undoToast";
import { cn } from "@/lib/utils";
import { pluralPl } from "@/lib/plural";

const sectionCls = "space-y-1.5 border-b border-border/60 px-3 py-3 last:border-b-0";
const h3 = "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const field = "h-10 w-full rounded-field border border-border bg-background px-2.5 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm";
const rowBtn = "flex min-h-10 w-full items-center gap-2 rounded-control px-2 text-left text-sm hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:min-h-11";

/**
 * Zestawienie materiałów (faza 7): rury po instalacji i średnicy w grupach pewności, symbole, ręczne
 * pozycje, CSV i „Do braków budowy” w Pracy. Wiersz rur/symboli podświetla swoje trasy na planie.
 */
export function MaterialsPanel({ plan, highlight, onHighlight }: { plan: PlanData; highlight: string | null; onHighlight: (key: string | null, ids: string[]) => void }) {
  const summary = useMemo(() => buildSummary(plan), [plan]);
  const [sending, setSending] = useState(false);
  const pid = plan.project.id;
  const certain = shortageItems(summary);

  function exportCsv() {
    downloadBlob(new Blob([summaryCsv(summary, plan.project.name)], { type: "text/csv;charset=utf-8" }), summaryFileName(plan.project.name));
    toast.success("Zapisano zestawienie CSV");
  }

  return (
    <div data-testid="plan-materials">
      <section className={sectionCls} aria-label="Zestawienie — akcje">
        <div className="flex items-center justify-between gap-2">
          <h3 className={h3}>Zestawienie materiałów</h3>
        </div>
        {!summary.hasScale && (
          <p className="rounded-control bg-muted/60 p-2 text-xs" role="note">Plan bez skali — rury są w pikselach, nie w metrach. Ustaw skalę (narzędzie „Skala”), żeby policzyć metry.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={exportCsv} className="pressable coarse:h-11"><Download className="mr-1.5 h-4 w-4" aria-hidden />CSV</Button>
          <Button type="button" variant="outline" onClick={() => setSending(true)} disabled={certain.length === 0} className="pressable coarse:h-11"
            title={certain.length ? "Pewne pozycje jako braki wybranej budowy" : "Brak pewnych pozycji: zatwierdź trasy i ustaw skalę"}>
            <Send className="mr-1.5 h-4 w-4" aria-hidden />Do braków
          </Button>
        </div>
      </section>

      {(["confirmed", "estimated", "noScale", "unverified"] as PipeGroupStatus[]).map((status) => summary.pipes[status].length > 0 && (
        <section key={status} className={sectionCls} aria-label={PIPE_STATUS_LABEL[status]} data-testid={`plan-materials-${status}`}>
          <h3 className={h3}>{PIPE_STATUS_LABEL[status]}</h3>
          <ul>
            {summary.pipes[status].map((r) => (
              <li key={r.key}>
                <button type="button" aria-pressed={highlight === r.key} onClick={() => onHighlight(highlight === r.key ? null : r.key, r.routeIds)} className={cn(rowBtn, highlight === r.key && "bg-primary/10")}>
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: SYSTEM_META[r.system].color }} />
                  <span className="min-w-0 flex-1 truncate">{pipeLabel(r)}<span className="text-xs text-muted-foreground"> · {r.routeIds.length} {pluralPl(r.routeIds.length, ["trasa", "trasy", "tras"])}</span></span>
                  <span className="font-mono text-sm tabular-nums">{r.meters === null ? `${Math.round(r.pixels)} px` : `${metersText(r.meters)} m`}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {([[true, "Symbole zatwierdzone"], [false, "Symbole do weryfikacji"]] as const).map(([verified, label]) => {
        const rows = verified ? summary.symbols.verified : summary.symbols.unverified;
        return rows.length > 0 && (
          <section key={label} className={sectionCls} aria-label={label}>
            <h3 className={h3}>{label}</h3>
            <ul>
              {rows.map((r) => (
                <li key={r.key}>
                  <button type="button" aria-pressed={highlight === r.key} onClick={() => onHighlight(highlight === r.key ? null : r.key, r.symbolIds)} className={cn(rowBtn, highlight === r.key && "bg-primary/10")}>
                    <span className="min-w-0 flex-1 truncate">{symbolLabel(r)}</span>
                    <span className="font-mono text-sm tabular-nums">{r.count} szt.</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <ManualItems pid={pid} items={plan.items} />
      <SendToSiteDialog open={sending} onOpenChange={setSending} items={certain} defaultSite={plan.project.siteId} planName={plan.project.name} />
    </div>
  );
}

/** Ręczne pozycje: dodawanie, ilość, jednostka, zatwierdzenie, usuwanie (z „Cofnij”). */
function ManualItems({ pid, items }: { pid: string; items: readonly MaterialItem[] }) {
  const [desc, setDesc] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<MaterialItem["unit"]>("szt");
  const q = parseDecimal(qty);
  const valid = desc.trim() !== "" && Number.isFinite(q) && q > 0 && q <= 100_000;
  const save = (i: MaterialItem) => { stopPlansCapture(); savePlanEntity("i", pid, i); };

  function add() {
    if (!valid) return;
    save({ id: newPlanId("item"), category: "ręczne", description: desc.trim().slice(0, PLAN_LABEL_MAX), quantity: q, unit, verified: true, at: Date.now() });
    setDesc("");
    setQty("");
  }

  return (
    <section className={sectionCls} aria-label="Pozycje ręczne" data-testid="plan-items">
      <h3 className={h3}>Pozycje ręczne ({items.length})</h3>
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={i.verified} onCheckedChange={(v) => save({ ...i, verified: v === true })} aria-label={`Zatwierdzona: ${i.description}`} />
              <span className="min-w-0 flex-1 truncate">{i.description}</span>
              <span className="font-mono tabular-nums">{i.quantity.toLocaleString("pl-PL")} {i.unit === "szt" ? "szt." : "m"}</span>
              <button type="button" aria-label={`Usuń pozycję ${i.description}`} onClick={() => { stopPlansCapture(); const r = removePlanEntity("i", pid, i.id); if (r) toastWithUndo("Usunięto pozycję", () => savePlanEntity("i", pid, r)); }}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-muted hover:text-destructive-ink outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 coarse:w-11">
                <Trash className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length < PLAN_ITEMS_MAX && (
        <form className="grid grid-cols-[1fr_5rem_4.5rem] gap-1.5" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="np. Zawór kulowy ½”" aria-label="Opis pozycji" maxLength={PLAN_LABEL_MAX} className={cn(field, "col-span-3")} />
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="Ilość" aria-label="Ilość" className={cn(field, "col-span-1 font-mono")} />
          <select value={unit} onChange={(e) => setUnit(e.target.value as MaterialItem["unit"])} aria-label="Jednostka" className={field}>
            <option value="szt">szt.</option>
            <option value="m">m</option>
          </select>
          <Button type="submit" disabled={!valid} className="pressable coarse:h-11" aria-label="Dodaj pozycję"><Plus className="h-4 w-4" aria-hidden /></Button>
        </form>
      )}
    </section>
  );
}

/**
 * „Do braków budowy” (D6 a): pewne pozycje dochodzą do listy braków wybranej budowy w Pracy
 * (`addShortagesFromDictation` — ta sama pozycja nie dubluje się, tylko aktualizuje ilość). Sklep Pracy
 * ładuje się dopiero przy otwarciu okna.
 */
function SendToSiteDialog({ open, onOpenChange, items, defaultSite, planName }: {
  open: boolean; onOpenChange: (o: boolean) => void; items: readonly { text: string; qty: string }[]; defaultSite?: string; planName: string;
}) {
  const [sites, setSites] = useState<{ id: string; name: string }[] | null>(null);
  const [siteId, setSiteId] = useState(defaultSite ?? "");

  // Lista budów wczytywana przy każdym otwarciu (mogły dojść nowe).
  useEffect(() => { if (open) void load(); }, [open]);

  async function load() {
    const { getStudy, siteDirectoryOf } = await import("@/lib/study/store");
    const list = siteDirectoryOf(getStudy()).filter((s) => s.archived === undefined).map((s) => ({ id: s.id, name: s.name }));
    setSites(list);
    setSiteId((cur) => cur || list[0]?.id || "");
  }

  async function send() {
    const { getStudy, siteDirectoryOf, setSiteShortages } = await import("@/lib/study/store");
    const { addShortagesFromDictation } = await import("@/lib/study/shortages");
    const site = siteDirectoryOf(getStudy()).find((s) => s.id === siteId);
    if (!site) return;
    const base = site.shortages ?? [];
    const { list, rejected } = addShortagesFromDictation(base, items, Date.now());
    setSiteShortages(site.id, list, base);
    onOpenChange(false);
    toast.success(`Dodano do braków „${site.name}”: ${items.length - rejected} pozycji z „${planName}”${rejected ? ` (${rejected} nie zmieściło się — limit listy)` : ""}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-md" data-testid="plan-send">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="font-display text-lg">Do braków budowy</DialogTitle>
          <DialogDescription className="text-xs">Tylko pozycje pewne: rury z potwierdzonym pomiarem (ze skalą), zatwierdzone symbole i pozycje ręczne. Szacunki i trasy do weryfikacji zostają w zestawieniu.</DialogDescription>
        </div>
        <div className="space-y-3 px-5 py-4">
          <ul className="max-h-40 space-y-0.5 overflow-y-auto text-sm">
            {items.map((i) => <li key={i.text} className="flex justify-between gap-2"><span className="truncate">{i.text}</span><span className="font-mono tabular-nums">{i.qty}</span></li>)}
          </ul>
          {sites === null ? <p className="text-sm text-muted-foreground">Wczytuję budowy…</p> : sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak budów w dziale Praca — dodaj kartę budowy, żeby przekazać braki.</p>
          ) : (
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Budowa</span>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={field}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 sm:grid sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="pressable coarse:h-11">Anuluj</Button>
            <Button type="button" onClick={() => void send()} disabled={!siteId || !sites?.length} className="pressable coarse:h-11">Dodaj do braków</Button>
          </ResponsiveDialogFooter>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
