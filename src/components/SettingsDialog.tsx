import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, LayoutGrid, Pencil, Database, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import { SyncSettings } from "@/components/SyncSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { BackupSettings } from "@/components/settings/BackupSettings";

interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  const controlled = open !== undefined;
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("appearance");
  const [joinPrefill, setJoinPrefill] = useState("");

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
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
            >
              <Sparkles className="w-[18px] h-[18px]" />
              <span>Ustawienia</span>
            </motion.button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Ustawienia
          </DialogTitle>
          <DialogDescription>Wszystko zapisuje się automatycznie w tej przeglądarce.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="appearance" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /><span className="hidden sm:inline">Wygląd</span></TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5"><Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ogólne</span></TabsTrigger>
            <TabsTrigger value="backup" className="gap-1.5"><Database className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dane</span></TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5"><Wifi className="w-3.5 h-3.5" /><span className="hidden sm:inline">Sync</span></TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-3 pr-1">
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
              <SyncSettings prefillCode={joinPrefill} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
