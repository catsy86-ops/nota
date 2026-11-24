import { useMemo, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { haptic } from "@/lib/haptics";
import { addRecording } from "@/lib/study/recordings";
import { JOURNAL_MAX_RECORDINGS } from "@/lib/study/journalEntry";
import { JOURNAL_MAX_IMAGES } from "@/lib/study/store";
import { useSitePoints } from "@/lib/study/pointsStore";
import { pointType } from "@/lib/study/points";
import { toastWithUndo } from "@/lib/undoToast";
import { CameraCapture } from "../CameraCapture";
import { DimensionDrawer } from "../DimensionDrawer";
import { PhotoStrip } from "../PhotoStrip";
import { useJournalPhotoEdits } from "../useJournalPhotoEdits";
import { EntryRecordings } from "./EntryRecordings";
import type { EntryForm } from "./entryForm";
import type { useEntryPhotos } from "./useEntryPhotos";
import type { usePhotoUi } from "./usePhotoUi";

/**
 * Zdjęcia i nagrania wpisu: aparat w aplikacji (B3.9), galeria, nagranie, pasek zdjęć z podpisem, rysunkiem
 * i miarką (oryginał zostaje), przypięcie do punktu budowy. Okna rysunku i miarki są tu, bo dotyczą tych zdjęć.
 */
export function EntryPhotoSection({ form, getForm, patch, isEdit, siteId, photos, ui, onTranscript }: EntryForm & {
  isEdit: boolean;
  /** Karta budowy wpisu (`""` = bez karty) — punkty do wyboru w aparacie. */
  siteId: string;
  photos: ReturnType<typeof useEntryPhotos>;
  ui: ReturnType<typeof usePhotoUi>;
  onTranscript: (t: string) => void;
}) {
  const { captioning, setCaptioning, captionDraft, setCaptionDraft, recording, setRecording } = ui;
  const [cameraOpen, setCameraOpen] = useState(false);
  const { processing, setProcessing, addPhotos } = photos;
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { saveCaption, drawing, setDrawing, openDrawing, saveDrawing, undoDrawing, measuring, setMeasuring, openDimensions, saveDimensions } = useJournalPhotoEdits({ getForm, patch, setProcessing, setCaptioning, setCaptionDraft });

  // Punkty budowy do wyboru w aparacie (B3.9): „Łazienka · WC (stelaż)”.
  const sitePoints = useSitePoints(siteId);
  const cameraPoints = useMemo(() => {
    const roomName = new Map(sitePoints.rooms.map((r) => [r.id, r.name] as const));
    return sitePoints.points.map((p) => ({ id: p.id, label: `${roomName.get(p.room) ?? "Pomieszczenie"} · ${pointType(p.type).label}` }));
  }, [sitePoints]);

  /** Gotowe nagranie z `VoiceRecorder`: przypinamy do szkicu albo edytowanego wpisu. */
  async function addRecordingFile(file: File) {
    const { added, message } = await addRecording(file, getForm().recordings);
    if (added) {
      patch({ recordings: [...getForm().recordings, added] });
      haptic("success");
    }
    if (message) toast.error(message);
  }

  function removePhoto(ref: string) {
    const before = getForm().images;
    patch({ images: before.filter((r) => r !== ref) });
    // Cofnij: zdjęcie wraca na swoje miejsce (zapisane dopiero przy „Zapisz wpis”).
    const at = before.indexOf(ref);
    toastWithUndo("Usunięto zdjęcie z wpisu", () => {
      const cur = getForm().images;
      if (!cur.includes(ref)) patch({ images: [...cur.slice(0, at), ref, ...cur.slice(at)] });
    }, { id: `photo-remove-${ref}` });
  }

  const fileInput = (ref: RefObject<HTMLInputElement | null>, testId: string, capture = false) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple={!capture}
      capture={capture ? "environment" : undefined}
      className="hidden"
      data-testid={testId}
      onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void addPhotos(f); }}
    />
  );

  return (
    <div className="space-y-2">
      {fileInput(cameraRef, "journal-camera-input", true)}
      {fileInput(galleryRef, "journal-photo-input")}
      <div className="flex gap-2 coarse:grid coarse:grid-cols-2">
        <Button type="button" variant="outline" onClick={() => setCameraOpen(true)} className="hidden coarse:inline-flex coarse:h-12">
          <Camera className="mr-1.5 size-5" />Aparat
        </Button>
        <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()} className="coarse:h-12">
          <ImagePlus className="mr-1.5 size-4 coarse:h-5 coarse:w-5" /><span className="coarse:hidden">Dodaj zdjęcie</span><span className="hidden coarse:inline">Galeria</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => setRecording(true)} disabled={recording || form.recordings.length >= JOURNAL_MAX_RECORDINGS} className="coarse:h-12">
          <Mic className="mr-1.5 size-4 coarse:h-5 coarse:w-5" />Nagraj
        </Button>
      </div>
      <EntryRecordings
        recording={recording}
        onCloseRecorder={() => setRecording(false)}
        recordings={form.recordings}
        onFile={(f) => void addRecordingFile(f)}
        onTranscript={onTranscript}
        onRemove={(hash) => patch({ recordings: getForm().recordings.filter((x) => x.hash !== hash) })}
      />
      {!isEdit && form.point && (
        <p className="ui-hint flex items-center gap-2" data-testid="entry-point">
          <span className="min-w-0 flex-1">Wpis przypiszę do punktu: {cameraPoints.find((p) => p.id === form.point)?.label ?? "punkt"}</span>
          <button type="button" onClick={() => patch({ point: undefined })} className="pressable shrink-0 underline coarse:min-h-11">Bez punktu</button>
        </p>
      )}
      <PhotoStrip
        images={form.images}
        processing={processing}
        captioning={captioning}
        captionDraft={captionDraft}
        onCaptionDraft={setCaptionDraft}
        onToggleCaption={(ref) => { setCaptioning(captioning === ref ? null : ref); setCaptionDraft(""); }}
        onCancelCaption={() => setCaptioning(null)}
        onSubmitCaption={(ref) => saveCaption(ref, captionDraft)}
        captions={form.captions}
        onRemoveCaption={(ref) => saveCaption(ref, "")}
        onDraw={(ref) => void openDrawing(ref)}
        onMeasure={(ref) => void openDimensions(ref)}
        dimensions={form.dimensions}
        drawnFrom={form.drawnFrom}
        onUndoDrawing={undoDrawing}
        onRemove={removePhoto}
      />
      {/* B3.9: zdjęcia z aparatu przechodzą tę samą obróbkę co z galerii (`addPhotos`: limit 2 MB, magazyn, limit wpisu). */}
      <CameraCapture
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(blob) => addPhotos([new File([blob], "aparat.jpg", { type: blob.type || "image/jpeg" })])}
        count={form.images.length + processing}
        max={JOURNAL_MAX_IMAGES}
        points={isEdit ? [] : cameraPoints}
        point={form.point}
        onPoint={(id) => patch({ point: id })}
      />
      {/* Rysowanie po zdjęciu — okno nad arkuszem; zamknięcie bez zapisu zostawia zdjęcie bez zmian. */}
      <DrawingCanvas
        open={drawing !== null}
        onOpenChange={(o) => { if (!o) setDrawing(null); }}
        initialImage={drawing?.url ?? null}
        onSave={(dataUrl) => void saveDrawing(dataUrl)}
      />
      {/* B3.3 Miarka: wymiary jako dane przy zdjęciu, oryginał bez zmian. */}
      <DimensionDrawer
        open={measuring !== null}
        onOpenChange={(o) => { if (!o) setMeasuring(null); }}
        imageUrl={measuring?.url ?? ""}
        dimensions={measuring ? form.dimensions?.[measuring.ref] ?? [] : []}
        onSave={saveDimensions}
      />
    </div>
  );
}
