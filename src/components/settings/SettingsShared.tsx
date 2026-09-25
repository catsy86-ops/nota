import { Switch } from "@/components/ui/switch";

/** Small labeled section wrapper shared by every settings tab. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Label + description + switch row shared by every settings tab. */
export function ToggleRow({ label, desc, checked, onCheck }: { label: string; desc: string; checked: boolean; onCheck: (v: boolean) => void }) {
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
