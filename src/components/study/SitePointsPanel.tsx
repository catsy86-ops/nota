import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, ChevronDown, Droplets, Plus, Trash2 } from "lucide-react";
import { NoteImage } from "@/components/NoteImage";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { addJournalEntry, setSite } from "@/lib/study/store";
import type { JournalEntry } from "@/lib/study/journalEntry";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { HEIGHT_MAX, latestPointPhotos, pointCaption, pointsProgress, pointStage, pointType, POINT_STEPS, POINT_TYPES, ROOM_NAME_MAX, ROOM_TEMPLATES, sidesLabel, STEP_LABEL, type WaterPoint } from "@/lib/study/points";
import { addPoint, addRoom, removePoint, removeRoom, restoreRoom, savePoint, togglePointStep, useSitePoints } from "@/lib/study/pointsStore";
import type { SiteInfo } from "@/lib/study/sites";

/** Opis kroku do zrobienia przy punkcie: „→ próba” albo „gotowe”. */
const nextLabel = (p: WaterPoint) => {
  const stage = pointStage(p);
  return stage >= POINT_STEPS.length ? "gotowe" : `→ ${STEP_LABEL[POINT_STEPS[stage]]}`;
};

/**
 * Punkty w pomieszczeniach (H2.1): pomieszczenia zwijane, przy punkcie typ, strony (Z C K), wysokość
 * i trzy kratki stanu — podejście, próba, biały montaż. Stuknięcie kratki zaznacza ją z wcześniejszymi
 * albo cofa ją z późniejszymi („Cofnij” w dymku). Wysokość startowo z tabeli G-HEAT, do poprawienia.
 */
export function SitePointsPanel({ site, journal }: { site: SiteInfo; journal: readonly JournalEntry[] }) {
  const { rooms, points } = useSitePoints(site.id);
  const photos = useMemo(() => latestPointPhotos(journal), [journal]);
  // H2.3: jedno ukryte pole aparatu na cały panel; `photoFor` mówi, którego punktu dotyczy zdjęcie.
  const photoInput = useRef<HTMLInputElement>(null);
  const photoFor = useRef<{ point: WaterPoint; room: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState<string | null>(null);

  function takePhoto(point: WaterPoint, room: string) {
    photoFor.current = { point, room };
    photoInput.current?.click();
  }

  async function savePhoto(file: File) {
    const target = photoFor.current;
    if (!target) return;
    setPhotoBusy(target.point.id);
    try {
      const prepared = await prepareImage(file);
      if (!prepared) { toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB"); return; }
      const ref = await imageStore.putBlob(prepared);
      const caption = pointCaption(target.room, target.point);
      setSite(site.name);
      if (!addJournalEntry({ kind: "ok", topic: null, text: `Punkt: ${caption}`, images: [ref], captions: { [ref]: caption }, point: target.point.id })) {
        toast.error("Nie zapisano zdjęcia");
        return;
      }
      haptic("success");
      toast.success(`Zdjęcie punktu: ${caption}`);
    } catch {
      toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki." });
    } finally {
      setPhotoBusy(null);
    }
  }
  /** Rozwinięcie wybrane przez użytkownika; bez wyboru — jedno albo dwa pomieszczenia rozwinięte, więcej zwinięte. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const progress = pointsProgress(points);
  const isOpen = (id: string) => open[id] ?? rooms.length <= 2;
  const flip = (id: string) => setOpen((s) => ({ ...s, [id]: !(s[id] ?? rooms.length <= 2) }));
  const expand = (id: string) => setOpen((s) => ({ ...s, [id]: true }));

  function tapStep(p: WaterPoint, index: number) {
    const before = togglePointStep(site.id, p, index);
    const label = pointType(p.type).label;
    const filled = pointStage(p) <= index;
    haptic(filled ? "success" : "tap");
    toastWithUndo(filled ? `${label}: ${STEP_LABEL[POINT_STEPS[index]]}` : `${label}: cofnięto ${STEP_LABEL[POINT_STEPS[index]]}`,
      () => savePoint(site.id, before), { id: `point-${p.id}` });
  }

  function addFromTemplate(templateId: string) {
    const room = addRoom(site.id, "", templateId);
    if (room) { haptic("success"); expand(room.id); }
  }

  function addNamed() {
    const room = addRoom(site.id, name);
    if (!room) return;
    setName("");
    haptic("success");
    expand(room.id);
  }

  function dropRoom(roomId: string) {
    const removed = removeRoom(site.id, roomId);
    if (removed) toastWithUndo(`Usunięto „${removed.room.name}” (${removed.points.length} pkt)`, () => restoreRoom(site.id, removed));
  }

  function dropPoint(p: WaterPoint) {
    const removed = removePoint(site.id, p.id);
    if (removed) toastWithUndo(`Usunięto punkt: ${pointType(p.type).label}`, () => savePoint(site.id, removed));
  }

  function saveHeight(p: WaterPoint, raw: string) {
    const t = raw.trim();
    const n = Number(t.replace(",", "."));
    if (t === "") { const { height: _h, ...rest } = p; savePoint(site.id, rest); return; }
    if (Number.isFinite(n) && n > 0 && n <= HEIGHT_MAX) savePoint(site.id, { ...p, height: Math.round(n) });
  }

  return (
    <section aria-label="Punkty w pomieszczeniach" data-testid="site-points" className="space-y-2">
      <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden data-testid="point-photo-input"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void savePhoto(f); }} />
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Droplets className="h-4 w-4" aria-hidden />Punkty
        {progress.total > 0 && <span className="font-mono tabular-nums normal-case" data-testid="site-points-progress">{progress.done}/{progress.total} gotowe</span>}
      </h3>

      {rooms.map((room) => {
        const list = points.filter((p) => p.room === room.id);
        const rp = pointsProgress(list);
        const expanded = isOpen(room.id);
        return (
          <div key={room.id} className="rounded-card border border-border" data-testid="site-room">
            <div className="flex items-center gap-1 pr-1">
              <button type="button" onClick={() => flip(room.id)} aria-expanded={expanded} aria-controls={`room-${room.id}`}
                className="pressable flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left coarse:min-h-11">
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", !expanded && "-rotate-90")} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.name}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-label={`${rp.done} z ${rp.total} gotowe`}>{rp.done}/{rp.total}</span>
              </button>
              <button type="button" onClick={() => dropRoom(room.id)} aria-label={`Usuń pomieszczenie ${room.name}`}
                className="pressable grid size-9 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground coarse:size-11">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {expanded && (
              <div id={`room-${room.id}`} className="space-y-2 border-t border-dashed border-border px-3 py-2">
                {list.length === 0 && <p className="text-xs text-muted-foreground">Brak punktów — dodaj pierwszy poniżej.</p>}
                <ul className="space-y-2">
                  {list.map((p) => {
                    const t = pointType(p.type);
                    const stage = pointStage(p);
                    return (
                      <li key={p.id} className="space-y-1" data-testid="site-point">
                        <div className="flex items-center gap-2">
                          {photos.get(p.id) && (
                            <NoteImage imageRef={photos.get(p.id)!} alt={`Ostatnie zdjęcie: ${t.label}`} className="size-9 shrink-0 rounded-field object-cover" placeholderClassName="size-9 shrink-0 rounded-field" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                          {p.sides.length > 0 && <span className="font-mono text-2xs text-muted-foreground" aria-label={`Strony: ${p.sides.length}`}>{sidesLabel(p.sides)}</span>}
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <input
                              key={`${p.id}-${p.height ?? ""}`}
                              defaultValue={p.height !== undefined ? String(p.height) : ""}
                              onBlur={(e) => saveHeight(p, e.target.value)}
                              inputMode="numeric"
                              placeholder="—"
                              aria-label={`${t.label}: wysokość w cm`}
                              className="h-8 w-12 rounded-field border border-input bg-background px-1.5 text-right font-mono text-sm tabular-nums text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11"
                            />
                            cm
                          </label>
                          <button type="button" onClick={() => takePhoto(p, room.name)} disabled={photoBusy === p.id} aria-label={`Zdjęcie punktu: ${t.label}`}
                            title="Zdjęcie z podpisem: pomieszczenie, punkt, wysokość"
                            className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground disabled:opacity-50 coarse:size-11">
                            <Camera className="h-4 w-4" aria-hidden />
                          </button>
                          <button type="button" onClick={() => dropPoint(p)} aria-label={`Usuń punkt ${t.label}`}
                            className="pressable grid size-8 shrink-0 place-items-center rounded-field text-muted-foreground hover:text-foreground coarse:size-11">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5" role="group" aria-label={`${t.label}: stan`}>
                          {POINT_STEPS.map((s, i) => (
                            <button
                              key={s}
                              type="button"
                              role="checkbox"
                              aria-checked={stage > i}
                              aria-label={`${t.label}: ${STEP_LABEL[s]}`}
                              title={STEP_LABEL[s]}
                              onClick={() => tapStep(p, i)}
                              className={cn(
                                "pressable grid size-9 place-items-center rounded-field border-2 coarse:size-11",
                                stage > i ? "border-success-ink bg-success-ink text-background" : stage === i ? "border-foreground/60" : "border-border",
                              )}
                            >
                              {stage > i && <Check className="h-4 w-4" aria-hidden />}
                            </button>
                          ))}
                          <span className={cn("pl-1 text-xs", stage >= POINT_STEPS.length ? "text-success-ink" : "text-muted-foreground")}>{nextLabel(p)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value && addPoint(site.id, room.id, e.target.value)) haptic("success"); }}
                    aria-label={`Dodaj punkt: ${room.name}`}
                    className="h-9 min-w-0 flex-1 rounded-field border border-input bg-background px-2 text-sm text-foreground coarse:h-11"
                  >
                    <option value="">Dodaj punkt…</option>
                    {POINT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addNamed(); }}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={ROOM_NAME_MAX} placeholder="np. Łazienka piętro"
          aria-label="Nazwa pomieszczenia"
          className="h-10 min-w-0 flex-1 rounded-field border border-input bg-background px-2.5 text-base text-foreground outline-hidden focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm" />
        <button type="submit" disabled={!name.trim()} className="pressable shrink-0 rounded-field border border-border px-3 text-sm disabled:opacity-50 coarse:min-h-11">Dodaj</button>
      </form>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Pomieszczenie z szablonu">
        {ROOM_TEMPLATES.map((t) => (
          <button key={t.id} type="button" onClick={() => addFromTemplate(t.id)}
            className="pressable rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-primary/10 coarse:min-h-11 coarse:px-3 coarse:text-sm">
            + {t.name} ({t.types.map((x) => pointType(x).label.toLowerCase()).join(", ")})
          </button>
        ))}
      </div>
      {rooms.length > 0 && (
        <p className="text-2xs text-muted-foreground">Kratki: podejście · próba · biały montaż. Wysokości startowe z tabeli G-HEAT.</p>
      )}
    </section>
  );
}
