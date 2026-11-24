import { lazy, Suspense, useMemo, type Dispatch } from "react";
import { toast } from "sonner";
import { Maximize2, QrCode, Radio, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardVariant } from "@/components/ui/card";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { hasAISummarizer } from "@/lib/aiModel";
import { haptic } from "@/lib/haptics";
import { hasNFC } from "@/lib/nfc";
import { TOPICS } from "@/lib/study/content";
import { closeJournalSheet } from "@/lib/study/entrySheet";
import { entrySections, type EntryPanel, type PanelsAction, type PanelsState } from "@/lib/study/entryPanels";
import { sumFittings, type Fitting } from "@/lib/study/fittings";
import { applyKit, type Kit } from "@/lib/study/kits";
import { useKits } from "@/lib/study/kitsStore";
import { slopeLabel } from "@/lib/study/slope";
import { useStudyLists } from "@/lib/study/store";
import type { Pipe } from "@/lib/study/pipes";
import { cn } from "@/lib/utils";
import { AISummary } from "../AISummary";
import { BarcodeScanner } from "../BarcodeScanner";
import { FittingsFields } from "../FittingsFields";
import { LevelMeter } from "../LevelMeter";
import { NFCReader } from "../NFCReader";
import { PipesFields } from "../PipesFields";
import { PressureTestFields } from "../PressureTestFields";
import { EntryKitsPanel } from "./EntryKitsPanel";
import { EntrySupplyToggle } from "./EntrySupplyToggle";
import { EntryTopicPanel } from "./EntryTopicPanel";
import type { EntryForm } from "./entryForm";

const KitsDialog = lazy(() => import("../KitsDialog").then((m) => ({ default: m.KitsDialog })));

const valueBtn = "pressable flex items-center gap-2 rounded-card border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted coarse:min-h-12";

/** Wartość czujnika we wpisie: przycisk otwiera okno pomiaru jeszcze raz. */
function ValueButton({ icon: Icon, label, onClick, className }: { icon: LucideIcon; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(valueBtn, className)}>
      <Icon className="size-4 shrink-0" aria-hidden />{label}
    </button>
  );
}

/**
 * „Dodaj do wpisu”: pigułki sekcji (próba, kształtki, rury, czujniki, zestawy, temat) i same sekcje. Sekcje są
 * schowane, dopóki nie są potrzebne (QoL, § D5); te z danymi otwierają się same (`entrySections`).
 */
export function EntryToolsSection({ form, getForm, patch, fittingHistory, pipeHistory, supply, onSupply, showSupply, onPractice, panels, dispatch }: EntryForm & {
  fittingHistory: readonly (readonly Fitting[] | undefined)[];
  pipeHistory: readonly (readonly Pipe[] | undefined)[];
  supply: "site" | "van";
  onSupply: (s: "site" | "van") => void;
  showSupply: boolean;
  onPractice: (topicId: string) => void;
  /** Otwarte panele — stan trzyma arkusz (zawsze zamontowany), więc przeżywa zamknięcie i ponowne otwarcie. */
  panels: PanelsState;
  dispatch: Dispatch<PanelsAction>;
}) {
  const set = (panel: EntryPanel, open: boolean) => dispatch({ type: "set", panel, open });
  const toggle = (panel: EntryPanel) => dispatch({ type: "toggle", panel });

  const sec = entrySections(panels, form);
  const touchDevice = useMediaQuery("(pointer: coarse)");
  // B1.1: trzy najczęściej używane kształtki od razu w rzędzie przycisków — 1 stuknięcie zamiast otwierania sekcji.
  const quickFittings = useMemo(() => (sec.fittings.visible ? [] : sumFittings(fittingHistory).slice(0, 3).map((f) => f.name)), [sec.fittings.visible, fittingHistory]);
  // Zestawy materiału (H1.2): pigułki pod „+ Zestaw”, edycja w osobnym oknie (ładowanym leniwie).
  const { kits } = useKits();
  const addKit = (kit: Kit) => {
    const f = getForm();
    patch(applyKit(f.fittings ?? [], f.pipes ?? [], kit));
    haptic("success");
    // U góry — na dole leży „Zapisz wpis”.
    toast.success(`Dodano zestaw: ${kit.name}`, { id: "kit-applied", position: "top-center" });
    set("kits", false);
  };

  const { topic } = form;
  const lists = useStudyLists();
  const items = useMemo(() => lists.checklist.filter((c) => c.topic === topic), [lists, topic]);
  const current = TOPICS.find((t) => t.id === topic) ?? null;
  const checked = useMemo(() => new Set(form.checked), [form.checked]);
  /** Inny temat = inna lista kontrolna, więc zaznaczone punkty się zerują; tekst i zdjęcia zostają. */
  const setTopic = (next: string) => { if (next !== getForm().topic) patch({ topic: next, checked: [] }); };
  const toggleItem = (id: string) => {
    const prev = getForm().checked;
    patch({ checked: prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id] });
  };

  /** Pigułka sekcji z danymi: „✓” gdy coś wpisano, wymuszona sekcja nie daje się schować. */
  const sectionPill = (panel: "test" | "fittings" | "pipes", label: string, filled: boolean) => (
    <Button
      type="button"
      aria-pressed={sec[panel].visible}
      aria-controls={`journal-${panel}`}
      aria-disabled={sec[panel].forced || undefined}
      onClick={() => { if (!sec[panel].forced) toggle(panel); }}
      variant="chip" size="chip" className="text-foreground"
    >
      {filled ? "✓ " : "+ "}{label}
    </Button>
  );
  const toolPill = (panel: EntryPanel, label: string, testId: string) => (
    <Button type="button" onClick={() => set(panel, true)} data-testid={testId} variant="chip" size="chip" className="text-foreground">{label}</Button>
  );

  return (
    <div className="space-y-2" data-testid="journal-sections">
      {/* Sekcje dodaje się pigułką (QoL, § D5): schowane, dopóki nie są potrzebne; te z danymi otwarte same. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dodaj do wpisu">
        {sectionPill("test", "Próba", !!form.test)}
        {sectionPill("fittings", "Kształtki", sec.fittings.forced)}
        {quickFittings.map((n) => (
          <Button key={n} type="button" onClick={() => patch({ fittings: [{ name: n, qty: 1 }] })} variant="chip-soft" size="chip" className="max-w-full text-foreground">
            <span className="truncate">+ {n}</span>
          </Button>
        ))}
        {sectionPill("pipes", "Rury", sec.pipes.forced)}
        {/* Czujniki i narzędzia (Faza 3): pigułki otwierają okna; po zapisie wartość widać w blokach poniżej. */}
        {touchDevice && typeof DeviceOrientationEvent !== "undefined" && toolPill("level", `${form.level !== undefined ? "✓ " : "+ "}Spadek`, "pill-level")}
        {toolPill("barcode", `${form.barcode ? "✓ " : "+ "}Kod`, "pill-barcode")}
        {touchDevice && hasNFC() && toolPill("nfc", "+ NFC", "pill-nfc")}
        {hasAISummarizer() && toolPill("ai", `${form.summary ? "✓ " : "+ "}Streszczenie`, "pill-ai")}
        <Button type="button" aria-expanded={panels.kits} aria-controls="journal-kits" onClick={() => toggle("kits")} variant="chip" size="chip" className="text-foreground">
          + Zestaw
        </Button>
        <Button type="button" aria-expanded={panels.topic} aria-controls="journal-topic" onClick={() => toggle("topic")} variant="chip" size="chip" className="max-w-full text-foreground">
          <span className="truncate">{topic ? `Temat: ${current?.title ?? topic}${checked.size > 0 ? ` · ${checked.size}/${items.length}` : ""}` : "+ Temat"}</span>
        </Button>
      </div>
      {sec.test.visible && (
        <div id="journal-test" className={cn(cardVariant(), "p-2")}>
          <PressureTestFields value={form.test} topic={topic} onChange={(t) => patch({ test: t })} />
        </div>
      )}
      {sec.level.visible && (
        <div id="journal-level" className={cn(cardVariant(), "p-2")}>
          <ValueButton icon={Maximize2} className="w-full" onClick={() => set("level", true)} label={form.level !== undefined ? `Spadek: ${slopeLabel(form.level)}` : "Zmierz spadek"} />
        </div>
      )}
      <LevelMeter open={panels.level} onOpenChange={(o) => set("level", o)} onSelect={(angle) => patch({ level: angle })} />
      {sec.barcode.visible && (
        <div id="journal-barcode" className={cn(cardVariant(), "p-2")}>
          <div className="flex gap-2">
            <ValueButton icon={QrCode} className="flex-1" onClick={() => set("barcode", true)} label={form.barcode ? `Kod: ${form.barcode}` : "Dodaj kod"} />
            {hasNFC() && (
              <button type="button" onClick={() => set("nfc", true)} className={valueBtn} title="NFC tag" aria-label="Odczytaj tag NFC">
                <Radio className="size-4 shrink-0" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
      <BarcodeScanner open={panels.barcode} onOpenChange={(o) => set("barcode", o)} onDetected={(code) => patch({ barcode: code })} />
      <NFCReader open={panels.nfc} onOpenChange={(o) => set("nfc", o)} onDetected={(tag) => patch({ barcode: tag })} />
      {sec.ai.visible && (
        <div id="journal-ai" className={cn(cardVariant(), "p-2")}>
          <ValueButton icon={Sparkles} className="w-full" onClick={() => set("ai", true)} label={form.summary ? `Streszczenie: ${form.summary.slice(0, 50)}…` : "Dodaj streszczenie AI"} />
        </div>
      )}
      <AISummary open={panels.ai} onOpenChange={(o) => set("ai", o)} text={form.text} onSelect={(s) => patch({ summary: s })} />
      {sec.fittings.visible && (
        <div id="journal-fittings" className={cn(cardVariant(), "p-2")}>
          <FittingsFields value={form.fittings ?? []} history={fittingHistory} onChange={(f) => patch({ fittings: f })} />
        </div>
      )}
      {panels.kits && <EntryKitsPanel kits={kits} onAdd={addKit} onEdit={() => set("kitsDialog", true)} />}
      {panels.kitsDialog && (
        <Suspense fallback={null}>
          <KitsDialog open={panels.kitsDialog} onOpenChange={(o) => set("kitsDialog", o)} fittingHistory={fittingHistory} pipeHistory={pipeHistory} />
        </Suspense>
      )}
      {sec.pipes.visible && (
        <div id="journal-pipes" className={cn(cardVariant(), "p-3")}>
          <PipesFields value={form.pipes ?? []} history={pipeHistory} onChange={(p) => patch({ pipes: p })} />
        </div>
      )}
      {showSupply && <EntrySupplyToggle supply={supply} onChange={onSupply} />}
      {panels.topic && (
        <EntryTopicPanel
          topic={topic} current={current} items={items} checked={checked}
          onTopic={setTopic} onToggle={toggleItem}
          onPractice={(id) => { closeJournalSheet(); onPractice(id); }}
        />
      )}
    </div>
  );
}
