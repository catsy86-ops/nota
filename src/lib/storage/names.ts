/**
 * D6.2: nazwy kluczy `localStorage`, zdarzeń i kanałów — bez importów, żeby każdy moduł (też `diagnostics.ts`, którego
 * używa `keys.ts`) mógł je czytać bez cyklu. Flagi kopii i wrażliwości są w `keys.ts`.
 */
/**
 * Nazwy kluczy Wyglądu (D6.2: moduły biorą nazwę stąd, nie z literału). Kolejność = kolejność w kopii i w kodzie
 * wyglądu (`appearanceCode.ts`, plan motywów 3.5).
 */
export const APPEARANCE = {
  skin: "kaczy.skin.v1",
  theme: "kaczy-theme",
  skinScheme: "kaczy.skinScheme.v1",
  // Q3.3: godziny jasnego przy jasności „Według pory”.
  themeHours: "kaczy.themeHours.v1",
  accent: "kaczy.accent.v1",
  shape: "kaczy.shape.v1",
  backdrop: "kaczy.backdrop.v1",
  font: "kaczy.font.v1",
  textSize: "kaczy.textSize.v1",
  skinSchedule: "kaczy.skinSchedule.v1",
  // Ramki i poświata: siła ramek, kolor krawędzi i tło kart, siła i barwa poświaty.
  frames: "kaczy.frames.v1",
  frameLook: "kaczy.frames.look.v1",
  glow: "kaczy.glow.v1",
  // Plan motywów 2026-10-30 (1.5): tryb budowa, ruch i pora roku też są wyglądem.
  siteMode: "kaczy.siteMode.v1",
  motion: "kaczy.motion.v1",
  seasonTheme: "kaczy.seasonTheme.v1",
  // Czarne tło w ciemnym (3.3), podkreślenia działów (3.4), gęstość (4.2), własny motyw (4.1).
  oled: "kaczy.oled.v1",
  sectionColors: "kaczy.sectionColors.v1",
  uiDensity: "kaczy.uiDensity.v1",
  customTheme: "kaczy.customTheme.v1",
} as const;

/** Nazwy kluczy Pracy (D6.2): magazyn wpisów, firma, cennik, KSeF, przypomnienia raportów, widok tablicy. */
export const PRACA = {
  entryPick: "kaczy.study.entryPick.v1",
  levelOffset: "kaczy.level.offset.v1",
  siteArrivalAsked: "kaczy.study.siteArrivalAsked.v1",
  boardColumn: "kaczy.study.boardColumn.v1",
  seller: "kaczy.study.seller.v1",
  ksefSeries: "kaczy.ksef.series.v1",
  ksefDeviceId: "kaczy.ksef.deviceId.v1",
  catalog: "kaczy.study.catalog.v1",
  companyName: "kaczy.study.companyName.v1",
  bankAccount: "kaczy.study.bankAccount.v1",
  quoteTerms: "kaczy.study.quoteTerms.v1",
  mileage: "kaczy.study.mileage.v1",
  sitePatterns: "kaczy.study.sitePatterns.v1",
  author: "kaczy.study.author.v1",
  fingerprints: "kaczy.study.fingerprints.v1",
  store: "kaczy.study.v1",
  journalDraft: "kaczy.study.draft.v1",
  pricing: "kaczy.study.pricing.v1",
  prices: "kaczy.study.prices.v1",
  reportNudged: "kaczy.study.reportNudged.v1",
  weekReportNudged: "kaczy.study.weekReportNudged.v1",
  reportNudges: "kaczy.study.reportNudges.v1",
  siteArrival: "kaczy.study.siteArrival.v1",
  oneHand: "kaczy.study.oneHand.v1",
  oneHandOffered: "kaczy.study.oneHandOffered.v1",
  tab: "kaczy.study.tab.v1",
  usage: "kaczy.study.usage.v1",
} as const;

/** Skarbiec: PIN, próby, auto-blokada, kod awaryjny. (D6.2) */
export const SKARBIEC = {
  attempts: "kaczy.vault.attempts.v1",
  autoLock: "kaczy.vault.autolock.v1",
  hiddenLock: "kaczy.vault.hiddenLock.v1",
  pin: "kaczy.vault.pin.v1",
  recoveryCheck: "kaczy.vault.recoveryCheck.v1",
} as const;

/** Grafik: zmiany (stary zapis), aktywny grafik, układ, podpowiedzi, eksport .ics. (D6.2) */
export const GRAFIK = {
  layout: "kaczy.shifts.layout.v1",
  moveHint: "kaczy.shifts.moveHint.v1",
  eveningNudge: "kaczy:shifts.eveningNudge",
  eveningNudged: "kaczy:shifts.eveningNudged",
  icsExported: "kaczy:shifts.icsExported",
  active: "kaczy:shifts.active",
  shifts: "kaczy:shifts",
} as const;

/** Ćwiczenia: przerwa między seriami. (D6.2) */
export const CWICZENIA = {
  restSeconds: "kaczy.training.restSeconds.v1",
  /** C2.5: poniedziałek tygodnia, w którym odrzucono „tydzień lżej” (`YYYY-MM-DD`). */
  deloadDismissed: "kaczy.training.deloadDismissed.v1",
} as const;

/** Nazwy zdarzeń okna i kanałów BroadcastChannel — nie klucze pamięci, ale ta sama przestrzeń nazw. (D6.2) */
export const SIGNALS = {
  vaultChannel: "kaczy-vault",
  studyCustomPrefill: "kaczy:study-custom-prefill",
  tour: "kaczy:tour",
  /** Okno „O aplikacji” (`components/about/AboutHost.tsx`). */
  about: "kaczy:about",
  /** Otwórz Ustawienia na karcie (`detail` = `SettingsTab`) spoza `Index` — np. z samouczka (U3.4). */
  openSettings: "kaczy:open-settings",
  /** Q4.2: lista notatek zmienionych na innym urządzeniu (`detail` = `AwayNote[]`, `AwayChangesHost`). */
  awayChanges: "kaczy:away-changes",
  importExternal: "kaczy:import-external",
  launchFiles: "kaczy:launch-files",
  guide: "kaczy:guide",
  quickPresets: "kaczy:quick-presets",
  swUpdateAvailable: "kaczy:sw-update-available",
} as const;

/** Powłoka i ustawienia interfejsu: szkice, wskazówki, widoki, filtry, flagi funkcji. (D6.2) */
export const POWLOKA = {
  draft: "kaczy.draft.v1",
  drafts: "kaczy.drafts.v1",
  sidebarGroups: "kaczy.sidebarGroups.v1",
  fabHint: "kaczy.fab.hint.v1",
  clientsImportDismissed: "kaczy.clients.importDismissed.v1",
  debtsFormOpen: "kaczy.debts.formOpen.v1",
  /** Auto-aktualizacja aplikacji (`lib/autoUpdate.ts`), domyślnie włączona. */
  autoUpdate: "kaczy.autoUpdate.v1",
  // L2.3: konto i BLIK do wiadomości o długu — wrażliwe (`keys.ts`), poza kopią.
  debtsPayment: "kaczy.debts.payment.v1",
  installBannerDismissed: "kaczy.installBanner.dismissed.v1",
  logoDrawn: "kaczy.logo.drawn.v1",
  plansRotateHint: "kaczy.plans.rotateHint.v1",
  appearanceAdvanced: "kaczy.appearance.advanced.v1",
  olderDeviceBanner: "kaczy.olderDeviceBanner.v1",
  bottomSlot: "kaczy.bottomSlot.v1",
  confirmPrefs: "kaczy.confirmPrefs.v1",
  templates: "kaczy.templates.v1",
  debtsHideAmounts: "kaczy.debtsHideAmounts.v1",
  dictationConsent: "kaczy.dictation.consent",
  effectsSettingsDefaults2: "kaczy.effectsSettings.defaults2",
  effectsSettings: "kaczy.effectsSettings.v1",
  fabLast: "kaczy.fab.last.v1",
  features: "kaczy.features.v1",
  tourSeen: "kaczy.tour.seen.v1",
  guidesSeen: "kaczy.guides.seen.v1",
  guidesForce: "kaczy.guides.force",
  hiddenViews: "kaczy.hiddenViews.v1",
  voiceLiveText: "kaczy.voice.liveText.v1",
  dictationLocal: "kaczy.dictation.local.v1",
  recentCommands: "kaczy.recentCommands.v1",
  recentSearches: "kaczy.recentSearches.v1",
  savedFilters: "kaczy.savedFilters.v1",
  shareLast: "kaczy.share.last",
  sigDawn: "kaczy.sig.dawn.v1",
  swipeHints: "kaczy.swipeHints.v1",
  viewMemoryPrefix: "kaczy.viewMemory.v1:",
  viewPrefs: "kaczy.viewPrefs.v1",
  lastSeenVersion: "kaczy.lastSeenVersion.v1",
} as const;

/** Dziś, Terminy, Kalendarz i przegląd: przypomnienia, alarmy, push, odznaki, podsumowania. (D6.2) */
export const DZIEN = {
  calendarDayView: "kaczy.calendar.dayView",
  calendarPhoneView: "kaczy.calendar.phoneView",
  todayTimeline: "kaczy.today.timeline.v1",
  todayNudgeAt: "kaczy.todayNudgeAt",
  todaySnoozeUntil: "kaczy.todaySnoozeUntil",
  weekNudgeAt: "kaczy.weekNudgeAt",
  weekSnoozeUntil: "kaczy.weekSnoozeUntil",
  calendarLayers: "kaczy.calendar.layers",
  dayDone: "kaczy.dayDone.v1",
  lastOpened: "kaczy.lastOpened.v1",
  badgeEnabled: "kaczy:badge.enabled",
  badgeInbox: "kaczy.badge.inbox.v1",
  push: "kaczy.push.v1",
  pushToken: "kaczy.push.token.v1",
  pushSummary: "kaczy.push.summary.v1",
  reminderLeads: "kaczy.reminderLeads.v1",
  alarms: "kaczy.alarms.v1",
  remindersLayout: "kaczy.remindersLayout.v1",
  reminderLastTime: "kaczy.reminder.lastTime",
  lastSeen: "kaczy.lastSeen.v1",
  todayCards: "kaczy.todayCards.v1",
  reviewDay: "kaczy:review.day",
  reviewSnoozeUntil: "kaczy:review.snoozeUntil",
  reviewClosed: "kaczy:review.closed",
} as const;

/** Dane: kopie, odtwarzanie, migwawki, import, migracje, stare magazyny notatek i obrazów, dziennik bezpieczeństwa. (D6.2) */
export const DANE = {
  yjsMigratedPrefix: "kaczy.yjs.migrated.v1.",
  snapshotLast: "kaczy.snapshot.last.v1",
  datalossDismissed: "kaczy.dataloss.dismissed.v1",
  autoBackupDone: "kaczy.autoBackupDone",
  backupNudge: "kaczy.backupNudge",
  achievements: "kaczy.achievements.v1",
  backupFileHandle: "kaczy.backupFileHandle",
  backupFileLast: "kaczy.backupFileLast.v1",
  lastAutoExport: "kaczy.lastAutoExport",
  snapshotStatus: "kaczy.snapshot.status.v1",
  securityLog: "kaczy.security.log.v1",
  errorLog: "kaczy.errors.log.v1",
  docformatIgnore: "kaczy.docformat.ignore.v1",
  restorePending: "kaczy.restore.pending.v1",
  restoreResult: "kaczy.restore.result.v1",
  docGeneration: "kaczy.doc.generation.v1",
  dataCleared: "kaczy.data.cleared.v1",
  importLast: "kaczy.import.last.v1",
  migrationsFailures: "kaczy.migrations.failures.v1",
  migrationsGiveup: "kaczy.migrations.giveup.v1",
  notes: "kaczy.notes.v1",
  labels: "kaczy.labels.v1",
  folders: "kaczy.folders.v1",
  idbMigrated: "kaczy.idb.migrated.v1",
  restoreRunning: "kaczy.restore.running.v1",
  versionsPrefix: "kaczy.versions.",
  images: "kaczy.images.v1",
  imagesV2Prefix: "kaczy.images.v2:",
} as const;

/** Synchronizacja: kod pary, przekaźnik, urządzenie, okno v2, zmiana klucza. (D6.2) */
export const SYNC = {
  deviceId: "kaczy.device.id.v1",
  legacyRoomIdle: "kaczy.legacyRoomIdle.v1",
  syncRekey: "kaczy.sync.rekey.v1",
  relay: "kaczy.relay.v1",
  syncV2only: "kaczy.sync.v2only.v1",
  syncSeen: "kaczy.sync.seen.v1",
  sync: "kaczy.sync.v1",
  syncDeviceName: "kaczy.sync.deviceName",
} as const;

/** Miejsca na zapisane zestawy wyglądu (poza kopią — dane tego urządzenia). */
export const appearanceSlotKey = (n: number): string => `kaczy.appearance.slot.${n}.v1`;

export const APPEARANCE_KEYS = Object.values(APPEARANCE);
