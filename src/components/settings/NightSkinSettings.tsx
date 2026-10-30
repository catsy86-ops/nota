import { Clock, Monitor, Sunset, type LucideIcon } from "lucide-react";
import { CITIES } from "@/lib/sun";
import { SKINS, type Skin } from "@/lib/skins";
import { SKIN_META } from "@/lib/skinGallery";
import { setSkinSchedule, skinScheduleStore, type SkinSchedule } from "@/lib/skinSchedule";
import { Segmented } from "./Segmented";
import { ToggleRow } from "./SettingsShared";

const WHEN: { value: SkinSchedule["mode"]; label: string; Icon: LucideIcon }[] = [
  { value: "system", label: "Z trybem ciemnym", Icon: Monitor },
  { value: "hours", label: "Według godzin", Icon: Clock },
  { value: "sun", label: "Wg słońca", Icon: Sunset },
];

const fieldClass = "h-9 coarse:h-11 rounded-control border border-input bg-background px-2 text-sm text-foreground";

/**
 * Styl na noc (plan motywów 1.4): przełącznik, styl nocny i pora. Styl dzienny to ten, który był wybrany
 * przy włączeniu; później ręczny wybór stylu zmienia styl bieżącej pory (`skinSchedule.ts`).
 */
export function NightSkinSettings({ skin }: { skin: Skin }) {
  const s = skinScheduleStore.use();
  const update = (patch: Partial<SkinSchedule>) => setSkinSchedule({ ...s, ...patch });
  const enable = (on: boolean) => {
    if (!on) return update({ enabled: false });
    // Bieżący styl zostaje dziennym; nocny musi być inny.
    const night = s.night !== skin ? s.night : skin === "zorza" ? "neon" : "zorza";
    update({ enabled: true, day: skin, night });
  };
  return (
    <div className="space-y-3">
      <ToggleRow
        label="Inny styl wieczorem"
        desc={s.enabled ? `W dzień ${SKIN_META[s.day].label}, wieczorem ${SKIN_META[s.night].label}.` : "Na przykład Zeszyt w dzień, Zorza wieczorem."}
        checked={s.enabled}
        onCheck={enable}
      />
      {s.enabled && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Styl nocny
            <select value={s.night} onChange={(e) => update({ night: e.target.value as Skin })} className={fieldClass}>
              {SKINS.map((k) => <option key={k} value={k}>{SKIN_META[k].label}</option>)}
            </select>
          </label>
          <Segmented label="Kiedy przełączać" options={WHEN} value={s.mode} onChange={(mode) => update({ mode })} />
          {s.mode === "sun" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Miasto (wschód i zachód)
              <select value={s.city} onChange={(e) => update({ city: e.target.value })} className={fieldClass}>
                {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          {s.mode === "hours" && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Od
                <input type="time" value={s.from} onChange={(e) => e.target.value && update({ from: e.target.value })} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Do
                <input type="time" value={s.to} onChange={(e) => e.target.value && update({ to: e.target.value })} className={fieldClass} />
              </label>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Wybór stylu w galerii zmienia styl bieżącej pory: wieczorem — nocny.</p>
        </>
      )}
    </div>
  );
}
