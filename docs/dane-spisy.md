# Spisy danych lokalnych (D0.2–D0.4)

Stan na 2026-11-23. Spisy do planu `docs/plan-migracje-yjs-2026-11-15.md` (Etap D0). Zasady zmian kształtu danych są w `docs/dane-wersje.md`. Spis map Yjs (D0.1) pilnuje test `src/lib/docMapsInventory.test.ts`.

## D0.2: bazy IndexedDB i pamięć podręczna

| Baza / magazyn | Moduł | Zawartość | Brak lub uszkodzenie |
|---|---|---|---|
| `kaczy-yjs-v1` (y-indexeddb) | `src/lib/yjsStore.ts`, podmiana: `src/lib/yjs/docFile.ts` | Cały dokument Yjs (notatki, Praca, Grafik, Długi…) | Pusty dokument; dane wracają z synchronizacji albo kopii. `ErrorBoundary` pozwala ją usunąć. |
| `kaczy-images-v1` / `images` | `src/lib/imageStore.ts` | Obrazy notatek (SHA-256 → Blob) | Notatka pokazuje brakujący obraz; hash zostaje w `imageHashes`, obraz może wrócić z kopii ZIP lub z innego urządzenia. |
| `kaczy-images-v1-thumbs` / `thumbs` | `src/lib/imageStore.ts` | Miniatury | Odtwarzane z obrazów. |
| `keyval-store` (domyślny `idb-keyval`) | kilka modułów | Klucze niżej | Zależnie od klucza. |
| ↳ `kaczy.versions.<id notatki>` | `src/lib/versionsStore.ts` | Historia wersji notatki (tylko to urządzenie) | Brak historii; notatka bez zmian. |
| ↳ `kaczy.notes.v1`, `kaczy.labels.v1`, `kaczy.folders.v1` | `src/lib/notesStore.ts` | Dawny magazyn sprzed Yjs — tylko źródło migracji | Nic — migracja pomija. |
| ↳ `kaczy.images.v1`, `kaczy.images.v2:<id>` | `src/lib/yjs/migrations.ts` | Dawne obrazy jako data URL — tylko źródło migracji, kasowane po przeniesieniu | Nic. |
| ↳ `kaczy.backupFileHandle` | `src/lib/backupFileHandle.ts` | Uchwyt pliku kopii (File System Access) | Kopia pyta o plik od nowa. |
| `kaczy-relay` / `state` | `src/lib/sync/relayRuntime.ts` | Stan przekaźnika E2E (kursory, kolejka) | Pełne pobranie z przekaźnika przy następnym połączeniu. |
| `kaczy-note-index-v1` / `index` | `src/workers/noteSearchHandlers.ts` | Zrzut indeksu wyszukiwania (MiniSearch) z odciskami | Indeks budowany od nowa w Workerze. |
| `kaczy-push-keys` / `keys` (wersja 1, gołe API) | `src/lib/push/seal.ts`, `public/sw-notifications.js` | Klucz do szyfrowania treści push (`content-v1`), kolejka ponowień (`resend`) | Powiadomienia push bez treści do czasu ponownego włączenia. |
| Cache `share-inbox-v1` | `public/sw-share.js` | Pliki udostępnione do aplikacji, przed odebraniem | Udostępnienie przepada; użytkownik udostępnia ponownie. |
| Cache `notki-push` | `public/sw-notifications.js`, `src/lib/push/shown.ts` | Ostatnie 200 pokazanych powiadomień (bez dubli) | Możliwy dubel powiadomienia. |
| Cache Workboxa (`ocr-engine`, `mermaid-engine`, `pdf-fonts`, `skin-fonts`, `html-navigations`, `static-assets`, `media-assets`) | `vite.config.ts` | Zasoby aplikacji | Pobierane z sieci. |

Bez wersji schematu są wszystkie bazy `idb-keyval` (zawsze wersja 1). `docFile.ts` podnosi wersję bazy dokumentu tylko po to, żeby zamknąć ją w innych kartach przy podmianie — numer nic nie znaczy dla formatu.

## D0.3: klucze `localStorage`

146 kluczy z literałów w `src/` (bez testów), wygenerowane skryptem; nazwy z `${…}` to rodziny kluczy. Kolumna „W kopii” mówi, czy klucz wchodzi do pełnej kopii JSON (`SETTINGS_KEYS` w `src/lib/backup/build.ts` z `APPEARANCE_KEYS` z `src/lib/appearanceCode.ts`). Walidację przy odczycie każdego klucza opisze rejestr kluczy (D6.1) — tu jej nie spisano, bo wymaga przeczytania każdego czytnika.

| Klucz | Moduły | W kopii |
|---|---|---|
| `kaczy-notes-data` | `lib/notesStore.ts` | — |
| `kaczy-notes-folders` | `lib/notesStore.ts` | — |
| `kaczy-notes-labels` | `lib/notesStore.ts` | — |
| `kaczy-notes-versions` | `lib/versionsStore.ts` | — |
| `kaczy-theme` | `hooks/useTheme.ts`, `lib/appearanceCode.ts`, `lib/appearancePresets.ts` … | tak |
| `kaczy:badge.enabled` | `lib/storage/names.ts`, `lib/overdueBadge.ts` | tak |
| `kaczy:guide` | `lib/guides.ts` | — |
| `kaczy:review.closed` | `lib/weeklyReview.ts` | — |
| `kaczy:review.day` | `lib/storage/names.ts`, `lib/weeklyReview.ts` | tak |
| `kaczy:review.snoozeUntil` | `lib/weeklyReview.ts` | — |
| `kaczy:shifts` | `lib/shifts/store.ts` | — |
| `kaczy:shifts.active` | `lib/shifts/store.ts` | — |
| `kaczy:shifts.eveningNudge` | `lib/shifts/eveningNudge.ts` | — |
| `kaczy:shifts.eveningNudged` | `lib/shifts/eveningNudge.ts` | — |
| `kaczy:tour` | `components/AppSidebar.tsx`, `components/BottomNav.tsx`, `components/OnboardingTour.tsx` | — |
| `kaczy.accent.v1` | `lib/accent.ts`, `lib/appearanceCode.ts` | tak |
| `kaczy.achievements.v1` | `lib/achievements.ts`, `lib/storage/names.ts` | tak (osobne pole) |
| `kaczy.alarms.v1` | `lib/reminders/sink.ts` | — |
| `kaczy.appearance.advanced.v1` | `components/settings/AppearanceSettings.tsx` | — |
| `kaczy.appearance.slot.${n}.v1` | `lib/appearancePresets.ts` | — |
| `kaczy.autoBackupDone` | `hooks/useBackupReminders.ts` | — |
| `kaczy.backdrop.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/backdrop.ts` | tak |
| `kaczy.backupFileLast.v1` | `lib/backupFileHandle.ts` | — |
| `kaczy.backupNudge` | `hooks/useBackupReminders.ts` | — |
| `kaczy.badge.inbox.v1` | `lib/overdueBadge.ts` | — |
| `kaczy.bottomSlot.v1` | `lib/bottomSlot.ts` | — |
| `kaczy.calendar.dayView` | `components/calendar/DayPanel.tsx` | — |
| `kaczy.calendar.layers` | `lib/calendarLayers.ts` | — |
| `kaczy.calendar.phoneView` | `components/calendar/ReminderCalendarView.tsx` | — |
| `kaczy.clients.importDismissed.v1` | `components/clients/ClientsView.tsx` | — |
| `kaczy.confirmPrefs.v1` | `lib/confirmPrefs.ts`, `lib/storage/names.ts` | tak |
| `kaczy.customTheme.v1` | `lib/appearanceCode.ts`, `lib/customTheme.ts` | tak |
| `kaczy.data.cleared.v1` | `lib/docReplaceCore.ts` | — |
| `kaczy.dataloss.dismissed.v1` | `components/DocReplaceBanners.tsx` | — |
| `kaczy.dayDone.v1` | `lib/dayDone.ts` | — |
| `kaczy.autoUpdate.v1` | `lib/storage/names.ts`, `lib/autoUpdate.ts` | tak |
| `kaczy.debts.formOpen.v1` | `components/debts/DebtsView.tsx` | — |
| `kaczy.debts.payment.v1` | `lib/storage/names.ts`, `lib/debts/payment.ts` | — (wrażliwy, L2.3) |
| `kaczy.debtsHideAmounts.v1` | `lib/debts/hideAmounts.ts` | — |
| `kaczy.device.id.v1` | `lib/deviceRegistry.ts` | — |
| `kaczy.dictation.consent` | `lib/dictationConsent.ts` | — |
| `kaczy.dictation.local.v1` | `lib/localSpeech.ts` | — |
| `kaczy.doc.generation.v1` | `lib/docReplaceCore.ts` | — |
| `kaczy.docformat.ignore.v1` | `lib/docFormat.ts` | — |
| `kaczy.draft.v1` | `components/AddNoteBar.tsx` | — |
| `kaczy.drafts.v1` | `components/AddNoteBar.tsx` | — |
| `kaczy.effectsSettings.defaults2` | `lib/effectsSettings.ts` | — |
| `kaczy.effectsSettings.v1` | `lib/effectsSettings.ts`, `lib/storage/names.ts` | tak |
| `kaczy.fab.hint.v1` | `components/BottomNav.tsx` | — |
| `kaczy.fab.last.v1` | `lib/fabRecent.ts` | — |
| `kaczy.features.v1` | `lib/storage/names.ts`, `lib/featureFlags.ts` | tak |
| `kaczy.font.v1` | `lib/appearanceCode.ts`, `lib/appFont.ts` | tak |
| `kaczy.frames.look.v1` | `lib/appearanceCode.ts`, `lib/frameLook.ts` | tak |
| `kaczy.frames.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/frames.ts` | tak |
| `kaczy.glow.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/glowLook.ts` | tak |
| `kaczy.guides.force` | `lib/guides.ts` | — |
| `kaczy.guides.seen.v1` | `lib/guides.ts` | — |
| `kaczy.hiddenViews.v1` | `lib/hiddenViews.ts` | — |
| `kaczy.idb.migrated.v1` | `lib/notesStore.ts` | — |
| `kaczy.import.last.v1` | `lib/import/commit.ts` | — |
| `kaczy.installBanner.dismissed.v1` | `components/InstallBanner.tsx` | — |
| `kaczy.ksef.deviceId.v1` | `lib/ksef/sellerPrefs.ts` | — |
| `kaczy.ksef.series.v1` | `lib/ksef/sellerPrefs.ts` | — |
| `kaczy.lastAutoExport` | `lib/backupReminder.ts` | — |
| `kaczy.lastOpened.v1` | `lib/lastOpened.ts` | — |
| `kaczy.lastSeen.v1` | `lib/resumeView.ts` | — |
| `kaczy.lastSeenVersion.v1` | `lib/whatsNew.ts` | — |
| `kaczy.legacyRoomIdle.v1` | `lib/legacyRoomIdle.ts` | — |
| `kaczy.level.offset.v1` | `components/study/LevelMeter.tsx` | — |
| `kaczy.logo.drawn.v1` | `components/NotkiLogo.tsx` | — |
| `kaczy.migrations.failures.v1` | `lib/migrations/start.ts` | — |
| `kaczy.migrations.giveup.v1` | `lib/migrations/start.ts` | — |
| `kaczy.motion.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/storage/names.ts` … | tak |
| `kaczy.olderDeviceBanner.v1` | `components/sync/OlderDeviceBanner.tsx` | — |
| `kaczy.oled.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/oled.ts` | tak |
| `kaczy.plans.rotateHint.v1` | `components/plans/PlanEditor.tsx` | — |
| `kaczy.push.token.v1` | `lib/push/prefs.ts` | — |
| `kaczy.push.v1` | `lib/push/prefs.ts` | tak (push wyłączany) |
| `kaczy.recentCommands.v1` | `lib/recentCommands.ts` | — |
| `kaczy.recentSearches.v1` | `lib/recentSearches.ts` | — |
| `kaczy.relay.v1` | `lib/sync/relayRuntime.ts` | — |
| `kaczy.reminder.lastTime` | `lib/reminderTime.ts` | — |
| `kaczy.reminderLeads.v1` | `lib/reminderLead.ts` | — |
| `kaczy.remindersLayout.v1` | `lib/remindersLayout.ts` | — |
| `kaczy.restore.pending.v1` | `lib/docReplaceCore.ts` | — |
| `kaczy.restore.result.v1` | `lib/docReplaceCore.ts` | — |
| `kaczy.restore.running.v1` | `lib/restoreMarker.ts` | — |
| `kaczy.savedFilters.v1` | `lib/savedFilters.ts` | — |
| `kaczy.seasonTheme.v1` | `lib/appearanceCode.ts`, `lib/storage/names.ts`, `lib/seasonTheme.ts` | tak |
| `kaczy.sectionColors.v1` | `lib/appearanceCode.ts`, `lib/sectionColors.ts` | tak |
| `kaczy.errors.log.v1` | `lib/diagnostics.ts` (Q1.6, pierścień 50 nieobsłużonych błędów) | — |
| `kaczy.security.log.v1` | `lib/diagnostics.ts` | — |
| `kaczy.shape.v1` | `lib/appearanceCode.ts`, `lib/shape.ts` | tak |
| `kaczy.share.last` | `lib/shareTarget.ts` | — |
| `kaczy.shifts.layout.v1` | `components/shifts/ShiftsView.tsx` | — |
| `kaczy.shifts.moveHint.v1` | `components/shifts/ShiftsView.tsx` | — |
| `kaczy.sidebarGroups.v1` | `components/AppSidebar.tsx` | — |
| `kaczy.sig.dawn.v1` | `lib/skinSignal.ts` | — |
| `kaczy.siteMode.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/storage/names.ts` … | tak |
| `kaczy.skin.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/skins.ts` | tak |
| `kaczy.skinSchedule.v1` | `lib/appearanceCode.ts`, `lib/skinSchedule.ts` | tak |
| `kaczy.skinScheme.v1` | `hooks/useTheme.ts`, `lib/appearanceCode.ts`, `lib/appearancePresets.ts` … | tak |
| `kaczy.snapshot.last.v1` | `components/DocReplaceBanners.tsx`, `lib/dailySnapshot.ts` | — |
| `kaczy.snapshot.status.v1` | `lib/dailySnapshot.ts` | — |
| `kaczy.study.author.v1` | `lib/storage/names.ts`, `lib/study/companyPrefs.ts` | tak |
| `kaczy.study.bankAccount.v1` | `lib/storage/names.ts`, `lib/study/companyPrefs.ts` | — |
| `kaczy.study.boardColumn.v1` | `components/study/StudyBoard.tsx` | — |
| `kaczy.study.catalog.v1` | `lib/study/catalog.ts` | — |
| `kaczy.study.companyName.v1` | `lib/storage/names.ts`, `lib/study/companyPrefs.ts` | tak |
| `kaczy.study.draft.v1` | `lib/study/keys.ts` | — |
| `kaczy.study.entryPick.v1` | `components/study/EntryCheck.tsx` | — |
| `kaczy.study.fingerprints.v1` | `lib/study/fingerprintStore.ts` | — |
| `kaczy.study.mileage.v1` | `lib/storage/names.ts`, `lib/study/companyPrefs.ts` | tak |
| `kaczy.study.sitePatterns.v1` | `lib/study/sitePatterns.ts` (R4.4, wzorce budów) | tak |
| `kaczy.study.prices.v1` | `lib/storage/names.ts`, `lib/study/pricingStore.ts` | tak |
| `kaczy.study.oneHand.v1` | `lib/study/oneHandPrefs.ts` (R4.1) | — |
| `kaczy.study.oneHandOffered.v1` | `lib/study/oneHandPrefs.ts` (R4.1) | — |
| `kaczy.study.pricing.v1` | `lib/storage/names.ts`, `lib/study/pricingStore.ts` | tak |
| `kaczy.study.quoteTerms.v1` | `lib/storage/names.ts`, `lib/study/companyPrefs.ts` | tak |
| `kaczy.study.reportNudges.v1` | `lib/study/reportNudgePrefs.ts` | — |
| `kaczy.study.seller.v1` | `lib/storage/names.ts`, `lib/ksef/sellerPrefs.ts` | tak |
| `kaczy.study.siteArrival.v1` | `lib/study/siteArrivalPrefs.ts` | — |
| `kaczy.study.siteArrivalAsked.v1` | `components/study/SiteArrivalPrompt.tsx` | — |
| `kaczy.study.tab.v1` | `lib/study/tab.ts` | — |
| `kaczy.study.usage.v1` | `lib/study/usage.ts` | — |
| `kaczy.study.v1` | `components/settings/BackupSettings.tsx`, `lib/storage/names.ts`, `lib/study/keys.ts` … | tak (z dokumentu) |
| `kaczy.swipeHints.v1` | `lib/swipeHint.ts` | — |
| `kaczy.sync.deviceName` | `lib/yjsSync.ts` | — |
| `kaczy.sync.rekey.v1` | `lib/sync/rekey.ts` | — |
| `kaczy.sync.seen.v1` | `lib/syncSeen.ts` | — |
| `kaczy.sync.v1` | `lib/storage/names.ts`, `lib/yjsSync.ts` | — |
| `kaczy.sync.v2only.v1` | `lib/sync/v2Window.ts` | — |
| `kaczy.templates.v1` | `lib/customTemplates.ts`, `lib/storage/names.ts` | tak |
| `kaczy.textSize.v1` | `lib/appearanceCode.ts`, `lib/appearancePresets.ts`, `lib/textSize.ts` | tak |
| `kaczy.themeHours.v1` | `lib/themeHours.ts`, `lib/appearanceCode.ts`, `public/prepaint.js` | tak |
| `kaczy.today.timeline.v1` | `components/review/TodayTimeline.tsx` | — |
| `kaczy.todayCards.v1` | `lib/todayCards.ts` | — |
| `kaczy.todayNudgeAt` | `hooks/useDailyWeeklyNudges.tsx` | — |
| `kaczy.todaySnoozeUntil` | `hooks/useDailyWeeklyNudges.tsx` | — |
| `kaczy.tour.seen.v1` | `lib/guides.ts` | — |
| `kaczy.training.deloadDismissed.v1` | `lib/training/deload.ts` (C2.5, poniedziałek tygodnia z odrzuconą podpowiedzią) | — |
| `kaczy.training.restSeconds.v1` | `lib/training/restPrefs.ts` | — |
| `kaczy.uiDensity.v1` | `lib/appearanceCode.ts`, `lib/uiDensity.ts` | tak |
| `kaczy.vault.attempts.v1` | `lib/privateNotes.ts` | — |
| `kaczy.vault.autolock.v1` | `lib/storage/names.ts`, `lib/vaultAutoLock.ts` | tak |
| `kaczy.vault.hiddenLock.v1` | `lib/storage/names.ts`, `lib/vaultAutoLock.ts` | tak |
| `kaczy.vault.pin.v1` | `lib/vaultPin.ts` | — |
| `kaczy.vault.pin.prev.v1` | `lib/vaultPin.ts` (K1: poprzednie nagłówki skarbca, wrażliwe) | — |
| `kaczy.vault.retired.v1` | `lib/privateNotes.ts` (K2: kopia lokalna łańcucha wycofanych kluczy, wrażliwe) | — |
| `kaczy.vault.recoveryCheck.v1` | `lib/storage/names.ts`, `lib/vaultRecoveryCheck.ts` | tak |
| `kaczy.viewMemory.v1:` | `lib/viewMemory.ts` | — |
| `kaczy.viewPrefs.v1` | `lib/storage/names.ts`, `lib/viewPrefs.ts` | tak |
| `kaczy.voice.liveText.v1` | `lib/liveTranscript.ts` | — |
| `kaczy.weekNudgeAt` | `hooks/useDailyWeeklyNudges.tsx` | — |
| `kaczy.weekSnoozeUntil` | `hooks/useDailyWeeklyNudges.tsx` | — |
| `kaczy.yjs.migrated.v1.${dbName}` | `lib/yjsStore.ts` | — |

## D0.4: istniejące migracje

| Migracja | Wyzwalacz | Znacznik | Idempotentna | Od kiedy | Usunąć? |
|---|---|---|---|---|---|
| `localStorage` → IndexedDB notatek (`loadAll` w `src/lib/notesStore.ts`) | Migracja Yjs woła `loadAll` | `kaczy.idb.migrated.v1` | Tak; stary klucz kasowany dopiero po sprawdzeniu zapisu | 2026-09-22 | Po 2027-11 (MG-1); źródło sprzed Yjs |
| Notatki z dawnego IndexedDB do Yjs (`migrateFromLegacyIfNeeded`, `src/lib/yjs/migrations.ts`) | `yjsStore.ready()`, blokada jednej karty | `kaczy.yjs.migrated.v1.<baza>`; pomija, gdy dokument ma dane | Tak | 2026-10 (wydzielona do pliku 2026-11-23) | Razem z poprzednią |
| Obrazy `kaczy.images.v1`/`v2:*` → `imageStore`, FNV → SHA-256 (`migrateImagesToStore`) | Jak wyżej | Brak — obecność starych kluczy; kasowane po przeniesieniu | Tak | 2026-10 | Razem z poprzednią |
| Historia wersji z `kaczy-notes-versions` do IndexedDB (`load` w `src/lib/versionsStore.ts`) | Pierwsze wczytanie historii | Brak — stary klucz kasowany po zapisie | Tak (scalanie po `id`) | 2026-09-28 | Po 2027-10 |
| Grafik z `kaczy:shifts` do map `shift*` (`migrateFromLocalStorage`, `src/lib/shifts/store.ts`) | `yjsStore.ready()` | Mapa `shiftMigrations` (id urządzenia); stary klucz zostaje jako kopia | Tak | 2026-10-09 | Po 2027-10; potem też usunąć `kaczy:shifts` |
| `migrate()` w `src/lib/shifts/model.ts` | Każdy odczyt Grafiku i stary zapis | Brak — to normalizacja, nie jednorazowa migracja | Tak | 2026-10-09 | Nie — pełni rolę `clean*` |
| Praca z `kaczy.study.v1` do map `study*` (`migrateFromLocalStorage`, `src/lib/study/data.ts`) | `studyReady()` | Mapa `studyMigrations`; stary klucz zostaje | Tak | 2026-10-15 | Nie — kopia JSON nadal niesie `kaczy.study.v1` (`dumpFromLegacy`); dopiero po D5.2 |
| Listy z karty budowy do `studySiteItems` (`migrateCardLists`, `src/lib/study/yStudy.ts`) | Zapis karty i scalanie kopii | Wpis `meta` na budowę i rodzaj w `studySiteItems` | Tak | 2026-10 | Nie, dopóki kopie mogą mieć stare karty |
| Cenniki z `kaczy.study.pricing.v1`/`prices.v1` do Yjs (`importLegacyPricing`, `src/lib/study/pricingStore.ts`) | Start po `yjsStore.ready()` i przywrócenie kopii | Brak — stare klucze kasowane | Tak (id z treści) | 2026-11-13 | Nie — kopie zapisują te klucze w ustawieniach |
| Szyfrogramy skarbca v1 → v2 (`migrateToV2`, `src/lib/privateNotes.ts`) | Odblokowanie skarbca, gdy `writeFormatAllowed` | Prefiks `v1.`/`v2.` szyfrogramu; zapis CAS | Tak | 2026-11 (przegląd V-3) | Nie — czytnik v1 musi zostać na zawsze dla starych kopii |
| Rejestr migracji dokumentu (`src/lib/migrations/`) | `startDocMigrations` | Mapa `docMigrations` | Wymagane przez zasady | 2026-11-19 | — (dziś pusty) |

Trzy migracje „na urządzenie” opisuje też `LOCAL_MIGRATIONS` w `src/lib/migrations/registry.ts`. Sprzątanie (D7.3) dopiero po 12 miesiącach i tylko tam, gdzie kolumna „Usunąć?” nie mówi „nie”.
