import { cn } from "@/lib/utils";
import { CLIENT_KIND_LABEL, CLIENT_KINDS, type ClientKind } from "@/lib/clients/model";

/** Przełącznik „Osoba / Firma” — ten sam w oknie nowego klienta i na karcie klienta. */
export function ClientKindToggle({ value, onChange }: { value: ClientKind; onChange: (kind: ClientKind) => void }) {
  return (
    <div role="group" aria-label="Rodzaj klienta" className="flex gap-2">
      {CLIENT_KINDS.map((k) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={cn("pressable rounded-full border px-3 py-1 text-sm coarse:min-h-11", value === k ? "border-primary bg-primary/10 font-medium text-primary-ink" : "border-border text-muted-foreground hover:bg-muted")}>
          {CLIENT_KIND_LABEL[k]}
        </button>
      ))}
    </div>
  );
}
