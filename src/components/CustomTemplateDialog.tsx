import { useState } from "react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteCustomTemplate, saveCustomTemplate, type CustomTemplate } from "@/lib/customTemplates";
import { renderTemplate, TEMPLATE_VARIABLES } from "@/lib/templateVars";
import { toast } from "sonner";

interface Props {
  /** `null` = nowy szablon; obiekt = edycja istniejącego. */
  template: CustomTemplate | null;
  onOpenChange: (open: boolean) => void;
}

/** Edytor własnego szablonu: tytuł i treść ze zmiennymi `{{data}}`, podgląd wyniku na żywo. */
export function CustomTemplateDialog({ template, onOpenChange }: Props) {
  const [name, setName] = useState(template?.name ?? "");
  const [emoji, setEmoji] = useState(template?.emoji ?? "");
  const [title, setTitle] = useState(template?.title ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [labels, setLabels] = useState((template?.labels ?? []).join(", "));

  function save() {
    if (!name.trim()) return;
    const ok = saveCustomTemplate({
      id: template?.id ?? crypto.randomUUID(),
      name: name.trim(),
      emoji: emoji.trim(),
      title,
      content,
      labels: labels.split(",").map((l) => l.trim().replace(/^#/, "")).filter(Boolean),
    });
    if (!ok) { toast.error("Osiągnięto limit szablonów", { description: "Usuń jakiś szablon, by dodać nowy." }); return; }
    toast.success(`Zapisano szablon „${name.trim()}”`);
    onOpenChange(false);
  }

  function remove() {
    if (!template) return;
    deleteCustomTemplate(template.id);
    toast.success(`Usunięto szablon „${template.name}”`);
    onOpenChange(false);
  }

  const preview = renderTemplate(title);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{template ? "Edytuj szablon" : "Nowy szablon"}</DialogTitle>
          <DialogDescription>
            Zmienne podstawią się przy tworzeniu notatki: {TEMPLATE_VARIABLES.map((v) => `{{${v.name}}}`).join(", ")}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <div className="space-y-1">
              <Label htmlFor="tpl-name">Nazwa szablonu</Label>
              <Input id="tpl-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="np. Dziennik" autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tpl-emoji">Ikona</Label>
              <Input id="tpl-emoji" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} placeholder="📓" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-title">Tytuł notatki</Label>
            <Input id="tpl-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="Dziennik — {{data}}" />
            {title.includes("{{") && <p className="text-xs text-muted-foreground">Wyjdzie: {preview || "—"}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-content">Treść</Label>
            <textarea
              id="tpl-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder={"Dzisiaj ({{dzień}}, {{godzina}}):\n\n- "}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-y"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-labels">Etykiety (po przecinku)</Label>
            <Input id="tpl-labels" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="dziennik, osobiste" />
          </div>
          <ResponsiveDialogFooter className="gap-2 sm:justify-between">
            {template ? <Button type="button" variant="ghost" className="text-destructive" onClick={remove}>Usuń szablon</Button> : <span />}
            <Button type="submit" disabled={!name.trim()}>Zapisz szablon</Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
