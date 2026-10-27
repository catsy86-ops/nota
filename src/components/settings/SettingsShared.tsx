import { createContext, useContext, useId, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { changedViewPrefs, resetViewPrefKeys, useViewPrefs, VIEW_PREF_LABELS, type ViewPrefs } from "@/lib/viewPrefs";

/**
 * Reset tylko ustawień z jednej sekcji (faza 3a). Potwierdzenie wymienia, co się zmieni; gdy wszystko
 * już jest domyślne, przycisk jest wyłączony — nie ma czego resetować.
 */
export function ResetSectionButton({ title, keys }: { title: string; keys: readonly (keyof ViewPrefs)[] }) {
  useViewPrefs(); // przerysowanie po zmianie ustawień, żeby lista była aktualna
  const [open, setOpen] = useState(false);
  const changed = changedViewPrefs(keys);
  return (
    <div className="flex justify-end">
      <Button type="button" variant="ghost" size="sm" disabled={changed.length === 0} onClick={() => setOpen(true)} className="coarse:h-11">
        Przywróć domyślne w tej sekcji
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić domyślne: {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmienią się: {changed.map((k) => VIEW_PREF_LABELS[k]).join(", ") || "nic — wszystko już jest domyślne"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { resetViewPrefKeys(keys); toast.success(`Przywrócono domyślne: ${title}`); }}>
              Przywróć
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Poziom nagłówka sekcji: 3 na karcie, 4 wewnątrz `SettingsGroup` (hierarchia dla czytnika ekranu). */
const SectionLevel = createContext<3 | 4>(3);

/** Small labeled section wrapper shared by every settings tab. Tytuł to nagłówek, nie akapit. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const Heading = useContext(SectionLevel) === 4 ? "h4" : "h3";
  return (
    <div className="space-y-2">
      <Heading className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</Heading>
      {children}
    </div>
  );
}

/**
 * Grupa sekcji z nagłówkiem (plan motywów 3.4: Wygląd w czterech częściach). `id` jest celem skoku
 * z paska grup; `scroll-mt` zostawia miejsce na przyklejony pasek (na dotyku wyższy: przyciski 44 px).
 */
export function SettingsGroup({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-14 coarse:scroll-mt-20 space-y-4">
      <h3 id={headingId} className="border-b border-border/60 pb-1.5 text-base font-semibold text-foreground">{title}</h3>
      <SectionLevel.Provider value={4}>{children}</SectionLevel.Provider>
    </section>
  );
}

/**
 * Label + description + switch row shared by every settings tab. Przełącznik ma nazwę dostępną
 * (etykieta z `aria-labelledby`), żeby czytnik ekranu mówił, czym jest.
 */
/**
 * Strzałki w grupie radio (wzorzec ARIA): przechodzą do następnej/poprzedniej opcji z zawijaniem,
 * zaznaczają ją i przenoszą fokus. Działa dla przycisków z `role="radio"` w `role="radiogroup"`.
 */
export function moveRadio<T>(e: KeyboardEvent<HTMLElement>, values: readonly T[], current: T, onChange: (v: T) => void) {
  const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const i = values.indexOf(current);
  const nextIndex = (i + step + values.length) % values.length;
  onChange(values[nextIndex]);
  const group = e.currentTarget.closest<HTMLElement>("[role=\"radiogroup\"]");
  const radios = Array.from(group?.querySelectorAll<HTMLElement>("[role=\"radio\"]") ?? []);
  requestAnimationFrame(() => radios[nextIndex]?.focus());
}

export function ToggleRow({ label, desc, checked, onCheck }: { label: string; desc: string; checked: boolean; onCheck: (v: boolean) => void }) {
  const labelId = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border/60 bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheck} aria-labelledby={labelId} />
    </div>
  );
}
