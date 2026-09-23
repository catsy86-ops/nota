import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Play, Sparkles, LayoutGrid, Pencil, Keyboard, Database, Download, Sun, Moon, Monitor, Zap, Accessibility } from "lucide-react";
import { motion } from "framer-motion";
import { EFFECT_LABELS, EffectKey, setEffectEnabled, useEffectsSettings } from "@/lib/effectsSettings";
import { bubbles, celebrate, emojiShower, fireworks, hearts, rainbow, sparkle } from "@/lib/celebrate";
import { useViewPrefs, setViewPref, resetViewPrefs, type Density, type Layout } from "@/lib/viewPrefs";
import { colorClasses } from "@/components/ColorPicker";
import { cn } from "@/lib/utils";
import type { NoteColor } from "@/hooks/useNotes";
import { exportFullBackup, importFullBackup } from "@/lib/exportNotes";
import { daysSinceBackup } from "@/lib/backupReminder";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useMotionPref, type MotionMode } from "@/hooks/useMotionPref";
import { useConfirmPrefs, setConfirmPref } from "@/lib/confirmPrefs";
import { SEASON_META, useSeasonPref, type SeasonPref } from "@/lib/seasonTheme";
import { toast } from "sonner";

function previewEffect(key: EffectKey) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  switch (key) {
    case "confetti": celebrate(cx, cy); break;
    case "sparkle": sparkle(cx, cy); break;
    case "emojiShower": emojiShower(); break;
    case "fireworks": fireworks(1200); break;
    case "hearts": hearts(cx, cy); break;
    case "bubbles": bubbles(cx, window.innerHeight - 40); break;
    case "rainbow": rainbow(); break;
    case "snow":
    case "seasonalTheme":
    case "dailyQuote": break;
  }
}

const COLORS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: "Ctrl/⌘ + N", desc: "Nowa notatka" },
  { keys: "Alt + N", desc: "Nowa notatka (alternatywnie)" },
  { keys: "Ctrl/⌘ + K", desc: "Paleta poleceń" },
  { keys: "/  •  Alt + S", desc: "Skup się na wyszukiwarce" },
  { keys: "Alt + T", desc: "Przejdź do trybu „Dziś”" },
  { keys: "Alt + W", desc: "Przejdź do trybu „Ten tydzień”" },
  { keys: "↑↑↓↓←→←→ B A", desc: "Konami — niespodzianka 🎉" },
  { keys: "+ / - / 0", desc: "Zoom w trybie prezentacji notatki" },
  { keys: "Esc", desc: "Zamknij dialogi i tryb prezentacji" },
  { keys: "[[Tytuł]]", desc: "Link do innej notatki w treści" },
];

interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  const settings = useEffectsSettings();
  const confirmPrefs = useConfirmPrefs();
  const prefs = useViewPrefs();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { mode: motionMode, reduced: motionReduced, setMode: setMotionMode } = useMotionPref();
  const { pref: seasonPref, season: activeSeason, setPref: setSeasonPref } = useSeasonPref();

  const keys = Object.keys(EFFECT_LABELS) as EffectKey[];
  const controlled = open !== undefined;

  const themeOptions: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: "Jasny", Icon: Sun },
    { value: "dark", label: "Ciemny", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
  ];

  const motionOptions: { value: MotionMode; label: string; Icon: typeof Sun }[] = [
    { value: "full", label: "Pełne", Icon: Zap },
    { value: "reduced", label: "Ograniczone", Icon: Accessibility },
    { value: "system", label: "System", Icon: Monitor },
  ];


  function handleAutoExportChange(v: number) {
    setViewPref("autoExportDays", v);
    if (v === 0) {
      try { localStorage.removeItem("kaczy.lastAutoExport"); } catch { /* ignore */ }
    }
  }

  async function exportNow() {
    try {
      await exportFullBackup();
      try { localStorage.setItem("kaczy.lastAutoExport", String(Date.now())); } catch { /* ignore */ }
      toast.success("Backup pobrany 💾");
    } catch {
      toast.error("Nie udało się wygenerować backupu");
    }
  }

  async function restoreNow() {
    try {
      const backup = await importFullBackup();
      toast.success(`Backup wczytany — ${backup.notes.length} notatek. Odświeżam…`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      if (err instanceof Error && err.message !== "Nie wybrano pliku") {
        toast.error("Nie udało się wczytać backupu: " + err.message);
      }
    }
  }

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

        <Tabs defaultValue="appearance" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="appearance" className="gap-1.5"><LayoutGrid className="w-3.5 h-3.5" /><span className="hidden sm:inline">Wygląd</span></TabsTrigger>
            <TabsTrigger value="general" className="gap-1.5"><Pencil className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ogólne</span></TabsTrigger>
            <TabsTrigger value="backup" className="gap-1.5"><Database className="w-3.5 h-3.5" /><span className="hidden sm:inline">Dane</span></TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-3 pr-1">
            {/* APPEARANCE */}
            <TabsContent value="appearance" className="space-y-4 mt-0">
              <Section title="Motyw">
                <div className="relative grid grid-cols-3 gap-2 p-1 rounded-2xl bg-muted/40 border border-border/60">
                  {themeOptions.map((opt) => {
                    const active = themeMode === opt.value;
                    const Icon = opt.Icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setThemeMode(opt.value)}
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors",
                          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-pressed={active}
                      >
                        {active && (
                          <motion.span
                            layoutId="theme-pill"
                            className="absolute inset-0 rounded-xl bg-background shadow-sm border border-border/60"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <Icon className="w-4 h-4 relative z-10" />
                        <span className="relative z-10">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {themeMode === "system"
                    ? "Motyw dopasowuje się do ustawień Twojego systemu."
                    : themeMode === "dark"
                      ? "Ciemny motyw ułatwia pracę wieczorem."
                      : "Klasyczny jasny motyw."}
                </p>
              </Section>

              <Section title="Ruch i animacje">
                <div className="grid grid-cols-3 gap-2">
                  {motionOptions.map((opt) => {
                    const active = motionMode === opt.value;
                    const Icon = opt.Icon;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setMotionMode(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {motionMode === "system"
                    ? `Zgodnie z ustawieniem systemu (teraz: ${motionReduced ? "ograniczony ruch" : "pełne animacje"}).`
                    : motionMode === "reduced"
                      ? "Animacje, przejścia i efekty ruchu są wyłączone."
                      : "Wszystkie animacje włączone, niezależnie od ustawień systemu."}
                </p>
              </Section>



              <Section title="Motyw pory roku">
                <div className="grid grid-cols-5 gap-2">
                  {(["auto", "spring", "summer", "autumn", "winter"] as SeasonPref[]).map((s) => {
                    const meta = s === "auto" ? { label: "Auto", emoji: "🗓️" } : SEASON_META[s];
                    const active = seasonPref === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSeasonPref(s)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-[11px] font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        <span className="text-lg leading-none" aria-hidden>{meta.emoji}</span>
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {settings.seasonalTheme
                    ? seasonPref === "auto"
                      ? `Kolory tła i akcentów dopasowują się do daty (teraz: ${SEASON_META[activeSeason].label.toLowerCase()}).`
                      : `Wymuszona kolorystyka: ${SEASON_META[activeSeason].label.toLowerCase()}.`
                    : "Włącz „Motyw sezonowy” w zakładce Efekty, aby zobaczyć zmiany kolorów."}
                </p>
              </Section>

              <Section title="Domyślny układ siatki">
                <div className="grid grid-cols-3 gap-2">
                  {(["masonry","grid","list"] as Layout[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setViewPref("layout", l)}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-medium transition-all capitalize",
                        prefs.layout === l ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                      )}
                    >{l === "masonry" ? "Masonry" : l === "grid" ? "Siatka" : "Lista"}</button>
                  ))}
                </div>
              </Section>

              <Section title="Gęstość">
                <div className="grid grid-cols-3 gap-2">
                  {(["compact","cozy","comfy"] as Density[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setViewPref("density", d)}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-medium transition-all",
                        prefs.density === d ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                      )}
                    >{d === "compact" ? "Kompakt" : d === "cozy" ? "Komfort" : "Luźno"}</button>
                  ))}
                </div>
              </Section>

              <Section title={`Liczba kolumn ${prefs.autoColumns ? "(auto)" : `(${prefs.columns})`}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewPref("autoColumns", true)}
                    className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium",
                      prefs.autoColumns ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
                  >Auto (responsywne)</button>
                  {[1,2,3,4].map((c) => (
                    <button
                      key={c}
                      onClick={() => { setViewPref("autoColumns", false); setViewPref("columns", c); }}
                      className={cn("w-10 h-10 rounded-xl border text-sm font-bold",
                        !prefs.autoColumns && prefs.columns === c ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
                    >{c}</button>
                  ))}
                </div>
              </Section>

              <ToggleRow
                label="Pokaż czas czytania"
                desc="Dodaje szacowany czas czytania do każdej notatki."
                checked={prefs.showReadingTime}
                onCheck={(v) => setViewPref("showReadingTime", v)}
              />
              <ToggleRow
                label="Pokaż backlinki"
                desc="W trybie prezentacji wyświetla notatki linkujące do bieżącej."
                checked={prefs.showBacklinks}
                onCheck={(v) => setViewPref("showBacklinks", v)}
              />

              <Button variant="ghost" size="sm" onClick={() => { resetViewPrefs(); toast.success("Przywrócono ustawienia"); }}>
                Przywróć domyślne
              </Button>
            </TabsContent>

            {/* EDITOR */}
            <TabsContent value="general" className="space-y-4 mt-0">
              <Section title="Domyślny kolor nowej notatki">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setViewPref("defaultNoteColor", c)}
                      className={cn(
                        "w-9 h-9 rounded-full border-2 transition-transform",
                        colorClasses[c],
                        prefs.defaultNoteColor === c ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/60 hover:scale-105"
                      )}
                      title={c}
                    />
                  ))}
                </div>
              </Section>

              <ToggleRow
                label="Sprawdzanie pisowni"
                desc="Włącza wbudowane sprawdzanie pisowni przeglądarki w polach edycji."
                checked={prefs.spellcheck}
                onCheck={(v) => setViewPref("spellcheck", v)}
              />

              <ToggleRow
                label="Pytaj przed przeniesieniem do kosza"
                desc="Pokazuje przyjazne potwierdzenie. Po akcji i tak masz przycisk „Cofnij”."
                checked={confirmPrefs.trash}
                onCheck={(v) => setConfirmPref("trash", v)}
              />

              <ToggleRow
                label="Pytaj przed archiwizacją"
                desc="Potwierdzenie przed przeniesieniem notatki do Archiwum."
                checked={confirmPrefs.archive}
                onCheck={(v) => setConfirmPref("archive", v)}
              />

              <Section title={`Autosave ${prefs.autosaveSeconds === 0 ? "(wyłączony)" : `co ${prefs.autosaveSeconds}s`}`}>
                <Slider
                  value={[prefs.autosaveSeconds]}
                  min={0} max={30} step={5}
                  onValueChange={([v]) => setViewPref("autosaveSeconds", v)}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {prefs.autosaveSeconds === 0
                    ? "Notatki zapisują się tylko po kliknięciu „Zapisz”."
                    : "Edycja będzie zapisywana automatycznie po przerwie w pisaniu."}
                </p>
              </Section>

            {/* EFFECTS — merged into Ogólne */}
            <div className="pt-2"><Section title="Efekty i zabawa">
              <p className="text-xs text-muted-foreground mb-2">Małe mikrointerakcje i sezonowe tło. Wszystko respektuje tryb ograniczonego ruchu.</p>
            </Section></div>
            <div className="space-y-3">
              {keys.map((key) => {
                const meta = EFFECT_LABELS[key];
                const enabled = settings[key];
                const id = `effect-${key}`;
                return (
                  <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl leading-none shrink-0" aria-hidden>{meta.emoji}</span>
                      <div className="min-w-0">
                        <Label htmlFor={id} className="text-sm font-semibold cursor-pointer">{meta.label}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {key !== "snow" && key !== "seasonalTheme" && key !== "dailyQuote" && (
                        <Button type="button" size="sm" variant="outline" disabled={!enabled} onClick={() => previewEffect(key)} className="h-8 px-2.5 gap-1.5">
                          <Play className="w-3.5 h-3.5" /><span className="text-xs">Test</span>
                        </Button>
                      )}
                      <Switch id={id} checked={enabled} onCheckedChange={(v) => setEffectEnabled(key, v)} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SHORTCUTS — merged into Ogólne */}
            <div className="pt-2 space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Lista skrótów dostępnych w aplikacji:</p>
              {SHORTCUTS.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
                  <span className="text-sm text-foreground">{s.desc}</span>
                  <kbd className="font-mono text-[11px] bg-background border border-border/60 rounded-md px-2 py-1 text-foreground/80">{s.keys}</kbd>
                </div>
              ))}
            </div>
            </TabsContent>

            {/* BACKUP */}
            <TabsContent value="backup" className="space-y-4 mt-0">
              <Section title={`Auto-backup ${prefs.autoExportDays === 0 ? "(wyłączony)" : `co ${prefs.autoExportDays} dni`}`}>
                <Slider
                  value={[prefs.autoExportDays]}
                  min={0} max={30} step={1}
                  onValueChange={([v]) => handleAutoExportChange(v)}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Po przekroczeniu interwału aplikacja sama pobierze plik JSON z backupem (gdy otworzysz KACZY).
                </p>
              </Section>

              <Section title={`Przypomnienie ${prefs.backupReminderDays === 0 ? "(wyłączone)" : `co ${prefs.backupReminderDays} dni`}`}>
                <Slider
                  value={[prefs.backupReminderDays]}
                  min={0} max={60} step={1}
                  onValueChange={([v]) => setViewPref("backupReminderDays", v)}
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {(() => {
                    const d = daysSinceBackup();
                    if (d === null) return "Jeszcze nie zrobiłeś backupu.";
                    return `Ostatni backup: ${d === 0 ? "dziś" : `${d} dni temu`}.`;
                  })()}
                </p>
              </Section>

              <Section title={`Przypomnienie „Dziś” ${prefs.todayReminderTime ? `codziennie o ${prefs.todayReminderTime}` : prefs.todayReminderHours === 0 ? "(wyłączone)" : prefs.todayReminderHours >= 24 ? `co ${Math.round(prefs.todayReminderHours / 24)} dni` : `co ${prefs.todayReminderHours} h`}`}>
                <Slider
                  value={[prefs.todayReminderHours]}
                  min={0} max={48} step={1}
                  onValueChange={([v]) => setViewPref("todayReminderHours", v)}
                  disabled={!!prefs.todayReminderTime}
                />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground shrink-0">albo o stałej godzinie:</span>
                  <input
                    type="time"
                    value={prefs.todayReminderTime}
                    onChange={(e) => setViewPref("todayReminderTime", e.target.value)}
                    className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
                  />
                  {prefs.todayReminderTime && (
                    <button
                      type="button"
                      onClick={() => setViewPref("todayReminderTime", "")}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >wyczyść</button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {prefs.todayReminderTime
                    ? `Toast pojawi się raz dziennie o ${prefs.todayReminderTime} (gdy masz notatki z dzisiaj).`
                    : prefs.todayReminderHours === 0
                      ? "Powiadomienie o notatkach z dzisiaj nie będzie się pojawiać."
                      : `Toast pojawi się co najwyżej raz na ${prefs.todayReminderHours} ${prefs.todayReminderHours === 1 ? "godzinę" : prefs.todayReminderHours < 5 ? "godziny" : "godzin"} (gdy masz notatki z dzisiaj).`}
                </p>
              </Section>

              <Section title={`Przypomnienie „Ten tydzień” ${prefs.weekReminderTime ? `${["w niedzielę","w poniedziałek","we wtorek","w środę","w czwartek","w piątek","w sobotę"][prefs.weekReminderDay]} o ${prefs.weekReminderTime}` : "(wyłączone)"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={prefs.weekReminderDay}
                    onChange={(e) => setViewPref("weekReminderDay", Number(e.target.value))}
                    className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
                    disabled={!prefs.weekReminderTime}
                  >
                    {["Niedziela","Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota"].map((d, i) => (
                      <option key={d} value={i}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={prefs.weekReminderTime}
                    onChange={(e) => setViewPref("weekReminderTime", e.target.value)}
                    className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
                  />
                  {prefs.weekReminderTime && (
                    <button
                      type="button"
                      onClick={() => setViewPref("weekReminderTime", "")}
                      className="text-[11px] text-muted-foreground hover:text-foreground underline"
                    >wyłącz</button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {prefs.weekReminderTime
                    ? "Raz w tygodniu, o wybranej porze, dostaniesz podsumowanie ostatnich 7 dni."
                    : "Ustaw godzinę, aby otrzymywać cotygodniowe przypomnienie."}
                </p>
              </Section>

              <Button onClick={exportNow} className="w-full gap-2">
                <Download className="w-4 h-4" /> Pobierz pełny backup teraz
              </Button>
              <Button onClick={restoreNow} variant="outline" className="w-full gap-2">
                <Database className="w-4 h-4" /> Przywróć z pliku backupu
              </Button>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">💡 Wskazówka</p>
                <p>Pełny backup zawiera wszystkie notatki (w tym archiwum i kosz), etykiety i foldery. Przywrócenie z pliku zastąpi obecne dane w tej przeglądarce i odświeży aplikację.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onCheck }: { label: string; desc: string; checked: boolean; onCheck: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheck} />
    </div>
  );
}
