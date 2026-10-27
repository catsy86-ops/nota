import { useEffect, useState, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { readViewMemory, writeViewMemory } from "@/lib/viewMemory";
import { Settings, LayoutGrid, Pencil, Database, Wifi } from "lucide-react";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";
import { consumeRequestedSettingsTab, settingsTabFromParam, SETTINGS_PARAM } from "@/lib/settingsDeepLink";
import { SyncFileSection } from "@/components/settings/SyncFileSection";

// qrcode.react (used only here, for device pairing) kept out of the eager
// main bundle — TabsContent below only mounts this once the Sync tab is active.
const SyncSettings = lazy(() => import("@/components/SyncSettings").then((m) => ({ default: m.SyncSettings })));

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SETTINGS_TABS = ["appearance", "general", "backup", "sync"] as const;

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Plan 3.6: otwiera się na ostatniej zakładce wybranej przez użytkownika (link z parametrem ma pierwszeństwo).
  const [activeTab, setActiveTab] = useState<string>(() => consumeRequestedSettingsTab() ?? readViewMemory("settingsTab", SETTINGS_TABS, "appearance"));
  const chooseTab = (tab: string) => {
    setActiveTab(tab);
    writeViewMemory("settingsTab", tab);
  };
  const [joinPrefill, setJoinPrefill] = useState("");

  // Link ?settings=<karta> otwiera Ustawienia na tej karcie (faza 3c); parametr znika z adresu.
  useEffect(() => {
    const tab = settingsTabFromParam(searchParams.get(SETTINGS_PARAM));
    if (!tab) return;
    setActiveTab(tab);
    onOpenChange(true);
    const next = new URLSearchParams(searchParams);
    next.delete(SETTINGS_PARAM);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // A QR code from another device links here as ?pair=<code> — jump straight
  // to the Sync tab with the code pre-filled and open the dialog if needed.
  useEffect(() => {
    const pairCode = searchParams.get("pair");
    if (!pairCode) return;
    setJoinPrefill(pairCode);
    setActiveTab("sync");
    onOpenChange?.(true);
    const next = new URLSearchParams(searchParams);
    next.delete("pair");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Stała wysokość: okno nie skacze przy zmianie zakładki. Na telefonie pełny ekran. */}
      <DialogContent className="h-dvh max-h-none max-sm:max-w-none rounded-none border-0 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:h-[min(88dvh,44rem)] sm:max-w-2xl sm:rounded-card sm:border sm:py-6 overflow-hidden flex flex-col">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-ink" />
            Ustawienia
          </DialogTitle>
          <DialogDescription>Zmiany zapisują się od razu w tej przeglądarce. Sync i kopia przenoszą dane na inne urządzenia.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={chooseTab} className="flex-1 flex flex-col min-h-0">
          {/* Na telefonie same nazwy (ikona bez podpisu nie mówi, co jest w zakładce). */}
          <TabsList className="grid grid-cols-4 w-full h-auto">
            <TabsTrigger value="appearance" className="gap-1.5 max-sm:text-xs"><LayoutGrid className="hidden sm:block w-3.5 h-3.5" aria-hidden /><span>Wygląd</span></TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5 max-sm:text-xs"><Pencil className="hidden sm:block w-3.5 h-3.5" aria-hidden /><span>Ogólne</span></TabsTrigger>
            {/* „Kopia i dane” może się zawinąć na wąskim ekranie — zakładka nie ma mieć stałej wysokości na jeden wiersz. */}
            <TabsTrigger value="backup" className="gap-1.5 max-sm:text-xs"><Database className="hidden sm:block w-3.5 h-3.5" aria-hidden /><span>Kopia i dane</span></TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5 max-sm:text-xs"><Wifi className="hidden sm:block w-3.5 h-3.5" aria-hidden /><span>Sync</span></TabsTrigger>
          </TabsList>

          {/* -mx-1 px-1: pierścień zaznaczenia przy lewej krawędzi nie jest przycinany. */}
          <div className="flex-1 overflow-y-auto pt-3 -mx-1 px-1">
            <TabsContent value="appearance" className="mt-0">
              <AppearanceSettings />
            </TabsContent>

            <TabsContent value="general" className="mt-0">
              <GeneralSettings />
            </TabsContent>

            <TabsContent value="backup" className="mt-0">
              <BackupSettings />
            </TabsContent>

            <TabsContent value="sync" className="mt-0">
              <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-muted/40" aria-hidden />}>
                <SyncSettings prefillCode={joinPrefill} />
              </Suspense>
              <div className="pt-4"><SyncFileSection /></div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
