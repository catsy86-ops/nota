import { SCHEMA_VERSION } from "@/lib/formatSchema";
import type { Note } from "@/lib/types/note";
import { yjsStore } from "@/lib/yjsStore";
import type { FullBackup } from "@/lib/noteSchema";
import { versionsStore } from "@/lib/versionsStore";
import { imageStore, isEmbeddableImageDataUrl } from "@/lib/imageStore";
import { recordingRefsIn, siteDocRefsIn } from "@/lib/study/journalRefs";
import { planRefsIn } from "@/lib/plans/planRefs";
import { STUDY_STORAGE_KEY } from "@/lib/study/keys";
import { extraSchedulesDump, mainShiftData, shiftsReady } from "@/lib/shifts/store";
import { BACKUP_ATTACHMENTS_BUDGET_BYTES, formatFileSize, type Attachment } from "@/lib/attachments";
import { getViewPrefs } from "@/lib/viewPrefs";

declare const __APP_BUILD__: string | undefined;
import { DANE, backupKeyNames } from "@/lib/storage/keys";

/**
 * Granica plików: na zewnątrz obrazy jadą jako data URL-e (plik ma działać
 * samodzielnie, także w starszej wersji aplikacji). Obraz, którego to
 * urządzenie nie ma, zostaje kluczem — referencja nie ginie.
 */
export async function withEmbeddedImages(notes: Note[]): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => (n.images.length ? { ...n, images: await imageStore.resolve(n.images) } : n)));
}

/** Odwrotnie: data URL-e z pliku → `imageStore`, w notatkach zostają klucze. */
export async function withStoredImages(notes: Note[]): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => (n.images.length ? { ...n, images: await imageStore.ingest(n.images) } : n)));
}

/** Do Markdown/HTML/PDF: tylko obrazy, które da się osadzić. */
export async function embeddableImages(images: string[]): Promise<string[]> {
  return (await imageStore.resolve(images)).filter(isEmbeddableImageDataUrl);
}

/** Załączniki, których bajtów nie ma w pliku backupu — do ostrzeżenia dla użytkownika. */
export interface BackupAttachmentReport {
  /** Pominięte, bo przekroczyłyby budżet rozmiaru backupu. */
  tooLarge: Attachment[];
  /** Manifest jest, ale bajtów nie ma na tym urządzeniu (np. plik dodany na innym). */
  missing: Attachment[];
  /** Zdjęcia dziennika z budowy, które nie weszły do backupu (budżet albo brak bajtów). */
  journalPhotos: number;
  /** Pliki budów (plany, PDF), które nie weszły do backupu — osobno od zdjęć. */
  siteDocs: number;
  /** Nagrania głosowe z wpisów, które nie weszły do backupu — osobno od zdjęć (U8). */
  recordings: number;
  /** Obrazy analiz planów, które nie weszły do backupu (budżet albo brak bajtów). */
  plans: number;
  /** Obrazy analiz planów pominięte z wyboru (Ustawienia → Kopia, `backupPlanImages`) — bez ostrzeżenia przed zapisem. */
  plansExcluded?: number;
  /** Zdjęcia dowodów długów, które nie weszły (budżet albo brak bajtów). */
  proofs?: number;
  /** Zdjęcia dowodów pominięte, bo kwoty długów są ukryte (L4.3) — bez ostrzeżenia przed zapisem. */
  proofsExcluded?: number;
}

/** Zdanie do toastu o pominiętych załącznikach; `null`, gdy wszystko weszło. */
export function describeSkippedAttachments(r?: BackupAttachmentReport): string | null {
  if (!r) return null;
  const n = r.tooLarge.length + r.missing.length;
  const photos = r.journalPhotos;
  const docs = r.siteDocs;
  if (!n && !photos && !docs && !r.recordings && !r.plans && !r.proofs) return null;
  const photosPart = photos ? `Pominięte zdjęcia dziennika z budowy: ${photos} — zostaną tylko na tym urządzeniu.` : null;
  const docsPart = docs ? `Pominięte pliki budów (plany, PDF): ${docs} — zostaną tylko na tym urządzeniu.` : null;
  const recPart = r.recordings ? `Pominięte nagrania głosowe: ${r.recordings} — zostaną tylko na tym urządzeniu.` : null;
  const plansPart = r.plans ? `Pominięte obrazy analiz planów: ${r.plans} — zostaną tylko na tym urządzeniu.` : null;
  const proofsPart = r.proofs ? `Pominięte zdjęcia dowodów długów: ${r.proofs} — zostaną tylko na tym urządzeniu.` : null;
  const extra = [photosPart, docsPart, recPart, plansPart, proofsPart].filter(Boolean).join(" ") || null;
  if (!n) return extra;
  const parts: string[] = [];
  if (r.tooLarge.length) parts.push(`${r.tooLarge.length} za duże na backup (limit ${formatFileSize(BACKUP_ATTACHMENTS_BUDGET_BYTES)} na wszystkie pliki)`);
  if (r.missing.length) parts.push(`${r.missing.length} nieobecne na tym urządzeniu`);
  const main = `Pominięte załączniki: ${parts.join(", ")}. Zostaną w notatkach jako wpisy bez zawartości.`;
  return extra ? `${main} ${extra}` : main;
}

/** Bajty załączników do backupu v3 w ramach budżetu; najpierw mniejsze, żeby weszło ich jak najwięcej. */
async function collectAttachmentBlobs(budget: number, planImages: boolean): Promise<{ blobs: Record<string, string>; report: BackupAttachmentReport }> {
  const report: BackupAttachmentReport = { tooLarge: [], missing: [], journalPhotos: 0, siteDocs: 0, recordings: 0, plans: 0 };
  const blobs: Record<string, string> = {};
  let used = 0;
  const all = [...yjsStore.referencedAttachments().values()].sort((a, b) => a.size - b.size);
  for (const a of all) {
    if (used + a.size > budget) { report.tooLarge.push(a); continue; }
    const dataUrl = await imageStore.getDataUrl(a.hash);
    if (!dataUrl) { report.missing.push(a); continue; }
    blobs[a.hash] = dataUrl;
    used += a.size;
  }
  // Zdjęcia dziennika z budowy: te same bajty co w `imageStore`, razem z załącznikami w budżecie.
  const docs = siteDocRefsIn(yjsStore.doc);
  const recordings = recordingRefsIn(yjsStore.doc);
  // Każdy pominięty bajt liczony w swojej kategorii: plik budowy, nagranie albo zdjęcie dziennika.
  const skip = (hash: string) => {
    if (docs.has(hash)) report.siteDocs++;
    else if (recordings.has(hash)) report.recordings++;
    else report.journalPhotos++;
  };
  const { journalImageRefs } = await import("@/lib/study/images");
  for (const hash of journalImageRefs()) {
    if (blobs[hash]) continue;
    const dataUrl = await imageStore.getDataUrl(hash);
    // Wcześniej pomijane po cichu — użytkownik myślał, że zdjęcia z budowy są w kopii.
    if (!dataUrl) { skip(hash); continue; }
    const approx = Math.ceil(dataUrl.length * 0.75);
    if (used + approx > budget) { skip(hash); continue; }
    blobs[hash] = dataUrl;
    used += approx;
  }
  // Obrazy analiz planów (D7): najpierw kopie robocze i małe oryginały (te same, co jadą do innych
  // urządzeń), potem duże oryginały — przy braku budżetu zostaje przynajmniej obraz do oglądania.
  // Bez obrazów planów (wybór w Ustawieniach): plik JSON nie jest szyfrowany, a plany bywają cudzymi
  // projektami — analizy (trasy, skala, zestawienie) zostają, obrazy tylko na urządzeniu.
  // Zdjęcia dowodów długów (L4.3): tylko dowody istniejących wpisów i tylko przy widocznych kwotach — kopia JSON nie
  // jest szyfrowana, a przelew czy umowa pokazują kwoty, które użytkownik schował.
  const { debtProofsDump } = await import("@/lib/debts/store");
  const { getHideAmounts } = await import("@/lib/debts/hideAmounts");
  const proofRefs = [...new Set(Object.values(debtProofsDump()).map((p) => p.ref))];
  if (getHideAmounts()) report.proofsExcluded = proofRefs.length;
  else for (const hash of proofRefs) {
    if (blobs[hash]) continue;
    const dataUrl = await imageStore.getDataUrl(hash);
    if (!dataUrl) { report.proofs = (report.proofs ?? 0) + 1; continue; }
    const approx = Math.ceil(dataUrl.length * 0.75);
    if (used + approx > budget) { report.proofs = (report.proofs ?? 0) + 1; continue; }
    blobs[hash] = dataUrl;
    used += approx;
  }
  const syncablePlans = planRefsIn(yjsStore.doc, true);
  const planOrder = [...syncablePlans, ...[...planRefsIn(yjsStore.doc)].filter((h) => !syncablePlans.has(h))];
  if (!planImages) {
    report.plansExcluded = planOrder.filter((h) => !blobs[h]).length;
    return { blobs, report };
  }
  for (const hash of planOrder) {
    if (blobs[hash]) continue;
    const dataUrl = await imageStore.getDataUrl(hash);
    if (!dataUrl) { report.plans++; continue; }
    const approx = Math.ceil(dataUrl.length * 0.75);
    if (used + approx > budget) { report.plans++; continue; }
    blobs[hash] = dataUrl;
    used += approx;
  }
  return { blobs, report };
}

/** Zawartość pełnego backupu v3 (bez zapisu do pliku) + raport o pominiętych załącznikach. */
export async function buildFullBackupWithReport(opts: { attachmentBudget?: number; planImages?: boolean } = {}): Promise<{ backup: FullBackup; attachments: BackupAttachmentReport }> {
  await yjsStore.ready();
  await versionsStore.load();
  await shiftsReady();
  // Dane działu Praca ładowane dopiero tu — nie wchodzą do paczki startowej.
  const [{ studyReady, yStudy }, { stateFromDump }, { supplementDump: supplementsDump }, { dietDump }, { trainingDump }, { debtsDump, debtPlansDump, debtProofsDump }, { entryCheckDump }] = await Promise.all([import("@/lib/study/data"), import("@/lib/study/yStudy"), import("@/lib/supplements/store"), import("@/lib/diet/store"), import("@/lib/training/store"), import("@/lib/debts/store"), import("@/lib/study/entryCheckStore")]);
  await studyReady();
  const { weightDump } = await import("@/lib/weight/store");
  const { kitsDump } = await import("@/lib/study/kitsStore");
  const { pointsDump } = await import("@/lib/study/pointsStore");
  const { billingDump } = await import("@/lib/study/billingStore");
  const { jobsDump } = await import("@/lib/study/jobsStore");
  const { invoicesDump } = await import("@/lib/ksef/invoicesStore");
  const { clientsDump } = await import("@/lib/clients/store");
  const { pricingDump } = await import("@/lib/study/pricingStore");
  const { vanDump } = await import("@/lib/study/vanStore");
  const { plansDump } = await import("@/lib/plans/plansStore");
  const { blobs, report } = await collectAttachmentBlobs(opts.attachmentBudget ?? BACKUP_ATTACHMENTS_BUDGET_BYTES, opts.planImages ?? getViewPrefs().backupPlanImages);
  const study = yStudy.dump();
  const propDefs = yjsStore.projectPropDefs();
  const backup: FullBackup = {
    version: 3,
    // D5.1: wersja formatu dokumentu obok wersji koperty — kopia z nowszego formatu nie wczyta się w starszej aplikacji.
    schema: SCHEMA_VERSION,
    // Z-18.2: kto zrobił kopię; listę `sections` dopisujemy niżej, gdy kopia jest już złożona.
    ...(typeof __APP_BUILD__ === "string" ? { appVersion: __APP_BUILD__.slice(0, 64) } : {}),
    exportedAt: Date.now(),
    // Notatki prywatne są w projekcji puste i niosą tylko szyfrogram (`vault`).
    notes: await withEmbeddedImages(yjsStore.projectNotes()),
    // Sól i klucz danych opakowany hasłem — bez hasła (albo kodu awaryjnego) nic z tego nie odczyta treści.
    ...(yjsStore.getVaultMeta() ? { vault: yjsStore.getVaultMeta() } : {}),
    labels: yjsStore.projectLabels(),
    folders: yjsStore.projectFolders(),
    // Bez definicji nie ma sekcji — kopia bez właściwości wygląda jak dawniej.
    ...(propDefs.length ? { propDefs } : {}),
    versions: versionsStore.all(),
    // Nauka także w dawnym kształcie, wśród ustawień — starsze wersje aplikacji ją odczytają.
    settings: { ...readKeys(SETTINGS_KEYS), [STUDY_STORAGE_KEY]: JSON.stringify(stateFromDump(study)) },
    achievements: readKeys([ACHIEVEMENTS_KEY])[ACHIEVEMENTS_KEY],
    // Ten sam JSON co dawny zapis w localStorage — starsze wersje aplikacji go odczytają.
    // Grafik główny w `shifts` (jak dawniej, starsze wersje go odczytają); pozostałe grafiki osobno.
    shifts: JSON.stringify(mainShiftData()),
    ...(extraSchedulesDump().length ? { shiftSchedules: JSON.stringify(extraSchedulesDump()) } : {}),
    study: JSON.stringify(study),
    // Odżywki i odhaczenia w osobnej sekcji; scalane przy przywracaniu, bez kasowania (stara kopia bez niej działa dalej).
    supplements: JSON.stringify(supplementsDump()),
    diet: JSON.stringify(dietDump()),
    // Masa ciała (C-2): jeden wpis na dzień, scalana przy przywracaniu.
    weight: JSON.stringify(weightDump()),
    training: JSON.stringify(trainingDump()),
    // Długi: pożyczki są w dokumencie Yjs, więc bez tej sekcji kopia by je gubiła.
    debts: JSON.stringify(debtsDump()),
    debtPlans: JSON.stringify(debtPlansDump()),
    debtProofs: JSON.stringify(debtProofsDump()),
    // Lista przed wejściem na budowę (punkty i odhaczenia dni) — osobna mapa, scalana przy przywracaniu.
    entryCheck: JSON.stringify(entryCheckDump()),
    // Zestawy materiału (H1.2) — osobna mapa, scalana przy przywracaniu bez nadpisywania.
    kits: JSON.stringify(kitsDump()),
    // Zapisane widoki (nowy plan 6.1) są w dokumencie Yjs — bez tej sekcji kopia by je gubiła.
    views: JSON.stringify((await import("@/lib/savedViews")).viewsDump()),
    // Punkty w pomieszczeniach budów (H2.1) — osobna mapa, scalana bez nadpisywania.
    points: JSON.stringify(pointsDump()),
    // Sposób rozliczenia budów (H3.1) — osobna mapa, scalana bez nadpisywania.
    billing: JSON.stringify(billingDump()),
    // Zlecenia własne — fuchy (H3.4): status, wycena; osobna mapa, scalana bez nadpisywania.
    jobs: JSON.stringify(jobsDump()),
    invoices: JSON.stringify(invoicesDump()),
    // Kartoteka klientów (Etap 1 planu wycen): klienci i powiązania z budowami, scalane bez nadpisywania.
    clients: JSON.stringify(clientsDump()),
    // Cenniki (4.1): robocizna i ceny kształtek są w dokumencie Yjs, scalane przy przywracaniu bez nadpisywania.
    pricing: JSON.stringify(pricingDump()),
    // Materiał w aucie (H1.3): pozycje i zdarzenia (inwentaryzacje, przyjęcia), scalane bez nadpisywania.
    van: JSON.stringify(vanDump()),
    // Analizy planów (mapa `plans`) — scalane bez nadpisywania.
    plans: JSON.stringify(plansDump()),
    ...(Object.keys(blobs).length ? { attachmentBlobs: blobs } : {}),
    // Same liczby (bez treści) — okno przywracania mówi, czego w pliku nie ma; zera = nic nie pominięto.
    skipped: { tooLarge: report.tooLarge.length, missing: report.missing.length, journalPhotos: report.journalPhotos, siteDocs: report.siteDocs, recordings: report.recordings, plans: report.plans + (report.plansExcluded ?? 0) },
  };
  // Z-18.2: spis sekcji w samej kopii — starsza wersja aplikacji wymieni te, których nie zna (bez zmiany koperty 3).
  backup.sections = Object.keys(backup).filter((k) => k !== "sections");
  return { backup, attachments: report };
}

export async function buildFullBackup(): Promise<FullBackup> {
  return (await buildFullBackupWithReport()).backup;
}

/** Największa wartość jednego ustawienia przy przywracaniu kopii (znaki). */
export const SETTING_VALUE_MAX = 2_500_000;

/**
 * Ustawienia wchodzące do pełnego backupu — z rejestru kluczy (`backup: true` w `src/lib/storage/keys.ts`, D6.5).
 * Świadomie **bez** `kaczy.sync.v1` (kod parowania to sekret, a na nowym urządzeniu paruje się od nowa) i bez
 * znaczników „kiedy ostatnio przypominano”.
 */
export const SETTINGS_KEYS: string[] = backupKeyNames();
export const ACHIEVEMENTS_KEY = DANE.achievements;

function readKeys(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    try { const v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch { /* ignore */ }
  }
  return out;
}
