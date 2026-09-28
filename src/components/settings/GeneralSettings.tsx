import { Play, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { EFFECT_LABELS, EffectKey, setEffectEnabled, useEffectsSettings } from "@/lib/effectsSettings";
import { bubbles, celebrate, emojiShower, fireworks, hearts, rainbow, sparkle } from "@/lib/celebrate";
import { useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { colorClasses } from "@/components/ColorPicker";
import { useConfirmPrefs, setConfirmPref } from "@/lib/confirmPrefs";
import type { NoteColor } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";
import { Section, ToggleRow } from "./SettingsShared";
import { getNotificationPermission } from "@/lib/notificationPermission";
import { MOD_KEY } from "@/lib/platform";

const PERMISSION_TEXT = {
  granted: "Włączone — przypomnienia pokażą się jako powiadomienia systemowe, gdy aplikacja jest otwarta.",
  default: "Przeglądarka zapyta o zgodę przy ustawieniu pierwszego przypomnienia.",
  denied: "Zablokowane w przeglądarce — przypomnienia pojawią się tylko w aplikacji. Zmienisz to w ustawieniach witryny (ikona kłódki przy adresie).",
  unsupported: "Ta przeglądarka nie obsługuje powiadomień — przypomnienia pojawią się tylko w aplikacji.",
} as const;

function NotificationStatus() {
  const state = getNotificationPermission();
  return (
    <Section title="Powiadomienia o przypomnieniach">
      <p className={cn("text-xs", state === "denied" ? "text-destructive" : "text-muted-foreground")}>
        {PERMISSION_TEXT[state]}
      </p>
    </Section>
  );
}

const COLORS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: `${MOD_KEY} + N`, desc: "Nowa notatka" },
  { keys: "Alt + N", desc: "Nowa notatka (alternatywnie)" },
  { keys: `${MOD_KEY} + K`, desc: "Paleta poleceń" },
  { keys: "/  •  Alt + S", desc: "Skup się na wyszukiwarce" },
  { keys: "Alt + T", desc: "Przejdź do trybu „Dziś”" },
  { keys: "Alt + W", desc: "Przejdź do trybu „Ten tydzień”" },
  { keys: "↑↑↓↓←→←→ B A", desc: "Konami — niespodzianka 🎉" },
  { keys: "+ / - / 0", desc: "Zoom w trybie prezentacji notatki" },
  { keys: "Esc", desc: "Zamknij dialogi i tryb prezentacji" },
  { keys: "[[Tytuł]]", desc: "Link do innej notatki w treści" },
];

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
    case "seasonalTheme":
    case "dailyQuote":
    case "cardTilt": break;
  }
}

/** "Ogólne" tab: default note color, editor prefs, confirmations, autosave, effects, shortcuts cheat-sheet. */
export function GeneralSettings() {
  const settings = useEffectsSettings();
  const confirmPrefs = useConfirmPrefs();
  const prefs = useViewPrefs();
  const keys = Object.keys(EFFECT_LABELS) as EffectKey[];

  return (
    <div className="space-y-4">
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

      <NotificationStatus />

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
        <p className="text-xs text-muted-foreground mt-1.5">
          {prefs.autosaveSeconds === 0
            ? "Bez zapisu cyklicznego. Edycja i tak zapisuje się przy wyjściu z pola oraz gdy kafel zniknie z widoku."
            : "Edycja będzie zapisywana automatycznie po przerwie w pisaniu — oraz zawsze przy wyjściu z pola."}
        </p>
      </Section>

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
                {key !== "seasonalTheme" && key !== "dailyQuote" && key !== "cardTilt" && (
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

      <div className="pt-2 space-y-2">
        <p className="text-xs text-muted-foreground mb-2">Lista skrótów dostępnych w aplikacji:</p>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
            <span className="text-sm text-foreground">{s.desc}</span>
            <kbd className="font-mono text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground/80">{s.keys}</kbd>
          </div>
        ))}
      </div>

      <div className="pt-2"><Section title="Diagnostyka">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Raport diagnostyczny</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plik tekstowy z wersją aplikacji, stanem pamięci i synchronizacji oraz ostatnimi błędami. Bez treści notatek i bez kodu parowania. Nic nie jest wysyłane.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDownloadReport} className="shrink-0 gap-1.5">
            <FileDown className="w-3.5 h-3.5" />Pobierz
          </Button>
        </div>
      </Section></div>
    </div>
  );
}

async function handleDownloadReport() {
  try {
    const { downloadDiagReport } = await import("@/lib/diagnosticsReport");
    await downloadDiagReport();
  } catch {
    toast.error("Nie udało się przygotować raportu");
  }
}
