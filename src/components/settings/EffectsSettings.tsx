import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EFFECT_LABELS, EffectKey, setEffectEnabled, useEffectsSettings } from "@/lib/effectsSettings";
import { haptic } from "@/lib/haptics";
import { showAchievementStamp } from "@/lib/achievementStamp";
import { bubbles, celebrate, dayDoneReward, emojiShower, fireworks, hearts, rainbow, sparkle } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { Section } from "./SettingsShared";

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
    case "cardTilt":
    case "themeFade": break;
    case "badgeStamp": showAchievementStamp({ id: "preview", emoji: "🏅", title: "Podgląd pieczątki" }); break;
    case "doneReward": dayDoneReward(); break;
    case "haptics": haptic("success"); break;
  }
}

/** Efekty i zabawa: przełączniki i podgląd. Przeniesione z Ogólne (faza 2b), żeby Ogólne było krótsze. */
export function EffectsSettings() {
  const settings = useEffectsSettings();
  const keys = Object.keys(EFFECT_LABELS) as EffectKey[];
  return (
    <div className="space-y-4">
      <div className="pt-2"><Section title="Efekty i zabawa">
        <p className="text-xs text-muted-foreground mb-2">Małe mikrointerakcje i sezonowe kolory. Wszystko respektuje tryb ograniczonego ruchu.</p>
      </Section></div>
      <div className="space-y-3">
        {keys.map((key) => {
          const meta = EFFECT_LABELS[key];
          const enabled = settings[key];
          const id = `effect-${key}`;
          return (
            // Przechył za kursorem nic nie robi na dotyku — tam go nie pokazujemy.
            <div key={key} className={cn("flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3", key === "cardTilt" && "[@media(pointer:coarse)]:hidden")}>
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl leading-none shrink-0" aria-hidden>{meta.emoji}</span>
                <div className="min-w-0">
                  <Label htmlFor={id} className="text-sm font-semibold cursor-pointer">{meta.label}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {key !== "seasonalTheme" && key !== "dailyQuote" && key !== "cardTilt" && (
                  <Button type="button" size="sm" variant="outline" disabled={!enabled} onClick={() => previewEffect(key)} className={cn("h-8 px-2.5 gap-1.5 coarse:h-11", key === "haptics" && "pointer-fine:hidden")}>
                    <Play className="w-3.5 h-3.5" /><span className="text-xs">Test</span>
                  </Button>
                )}
                <Switch id={id} checked={enabled} onCheckedChange={(v) => setEffectEnabled(key, v)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
