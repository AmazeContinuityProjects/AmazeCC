# 07 — Suite Map (all 205 test files)

> One line per suite, grouped by family. Regenerate with `node grounding/suite-map.mjs`.
> Run a family: `pnpm run test -- <family>` (filename substring).

## `a11yClickable*` (1)

- `a11yClickable.test.tsx` — clickable non-button elements fire like buttons

## `analytics*` (1)

- `analytics.test.ts` — GA consent-gated queue

## `analyzeCalendar*` (1)

- `analyzeCalendar.test.ts` — _(scenario pins — see file)_

## `appHousing*` (1)

- `appHousing.test.tsx` — _(scenario pins — see file)_

## `attendancePredictor*` (1)

- `attendancePredictor.test.ts` — _(scenario pins — see file)_

## `attendanceTimetable*` (1)

- `attendanceTimetable.test.ts` — _(scenario pins — see file)_

## `bottomSheetDismiss*` (1)

- `bottomSheetDismiss.test.tsx` — _(scenario pins — see file)_

## `bugRecordingFloatingBar*` (1)

- `bugRecordingFloatingBar.test.tsx` — _(scenario pins — see file)_

## `busDetailSheet*` (1)

- `busDetailSheet.test.tsx` — _(scenario pins — see file)_

## `calendarDay*` (1)

- `calendarDay.test.ts` — calendar classification model (working/instructional/CAT days) ~1.7k lines

## `calendarVtopMonth*` (1)

- `calendarVtopMonth.test.ts` — _(scenario pins — see file)_

## `changelogModal*` (1)

- `changelogModal.test.tsx` — _(scenario pins — see file)_

## `chunkRecovery*` (1)

- `chunkRecovery.test.ts` — stale-chunk detect → purge+reload once per 10s

## `classDetailsModal*` (1)

- `classDetailsModal.test.tsx` — _(scenario pins — see file)_

## `common*` (1)

- `common-free-timetable.test.tsx` — _(scenario pins — see file)_

## `connectionBanner*` (1)

- `connectionBanner.test.tsx` — _(scenario pins — see file)_

## `courseDetailSharedDayCards*` (1)

- `courseDetailSharedDayCards.test.tsx` — _(scenario pins — see file)_

## `courseDetailsEnhanced*` (1)

- `courseDetailsEnhanced.test.tsx` — _(scenario pins — see file)_

## `coursePredictorScope*` (1)

- `coursePredictorScope.test.ts` — _(scenario pins — see file)_

## `courseTypeChips*` (1)

- `courseTypeChips.test.tsx` — _(scenario pins — see file)_

## `credential*` (1)

- `credential-manager.test.ts` — session restore, single-flight refresh, backoff/lockout

## `credentialVault*` (1)

- `credentialVault.test.ts` — AES-GCM encrypt→decrypt roundtrip; migration of plaintext

## `csp*` (1)

- `csp.test.ts` — CSP meta contains every required directive

## `curriculum*` (1)

- `curriculum.test.ts` — _(scenario pins — see file)_

## `dashboardScreenHistory*` (1)

- `dashboardScreenHistory.test.tsx` — _(scenario pins — see file)_

## `dayDetailSheet*` (1)

- `dayDetailSheet.test.tsx` — _(scenario pins — see file)_

## `desktopCourseDetail*` (1)

- `desktopCourseDetail.test.tsx` — _(scenario pins — see file)_

## `errorDiagnosticCard*` (1)

- `errorDiagnosticCard.test.tsx` — _(scenario pins — see file)_

## `eventhub*` (2)

- `eventhub-metrics.test.ts` — _(scenario pins — see file)_
- `eventhub-request.test.ts` — _(scenario pins — see file)_

## `examSchedule*` (1)

- `examSchedule.test.ts` — _(scenario pins — see file)_

## `examScheduleDisplay*` (1)

- `examScheduleDisplay.filter.test.tsx` — _(scenario pins — see file)_

## `exportClashReport*` (1)

- `exportClashReport.test.ts` — clash report content invariants

## `exportDossierWidget*` (1)

- `exportDossierWidget.render.test.tsx` — _(scenario pins — see file)_

## `exportTimetable*` (1)

- `exportTimetable.test.ts` — export artifact shapes (html/json/unsafe strings)

## `facultyGroups*` (1)

- `facultyGroups.test.ts` — _(scenario pins — see file)_

## `facultyReviewPaneZIndex*` (1)

- `facultyReviewPaneZIndex.test.tsx` — _(scenario pins — see file)_

## `facultyScheduleModal*` (1)

- `facultyScheduleModal.render.test.tsx` — _(scenario pins — see file)_

## `facultyScheduleTab*` (1)

- `facultyScheduleTab.render.test.tsx` — _(scenario pins — see file)_

## `feedbackModal*` (1)

- `feedbackModal.test.tsx` — _(scenario pins — see file)_

## `feedbackReportPage*` (1)

- `feedbackReportPage.test.tsx` — _(scenario pins — see file)_

## `fetch*` (3)

- `fetch-utils-loopback.test.ts` — _(scenario pins — see file)_
- `fetch-utils-unicc-guard.test.ts` — _(scenario pins — see file)_
- `fetch-utils.test.ts` — failoverBackupUrl, primary/backup SWAP rules

## `ffcs*` (4)

- `ffcs-embedded.test.ts` — embedded CSVs parse to valid ParsedCourse rows
- `ffcs-generate-stream.test.ts` — batched worker protocol (one-shot + stream)
- `ffcs-generate.facultyPriority.test.ts` — faculty priority ordering effects
- `ffcs-generate.test.ts` — timetable search: clash-free, deterministic, sheet caps

## `ffcsCatalogCurriculum*` (1)

- `ffcsCatalogCurriculum.hook.test.tsx` — _(scenario pins — see file)_

## `ffcsCatalogFilters*` (1)

- `ffcsCatalogFilters.test.ts` — _(scenario pins — see file)_

## `ffcsCatalogGrades*` (1)

- `ffcsCatalogGrades.hook.test.tsx` — _(scenario pins — see file)_

## `ffcsClashPairs*` (1)

- `ffcsClashPairs.test.ts` — _(scenario pins — see file)_

## `ffcsClassmates*` (2)

- `ffcsClassmates.render.test.tsx` — friend picker UI behavior
- `ffcsClassmates.test.ts` — ffcs-match call shape + error handling

## `ffcsCodechefCatalogue*` (1)

- `ffcsCodechefCatalogue.test.ts` — catalogue CSV integrity vs CodeChef-VIT source

## `ffcsCourseCatalogFilters*` (1)

- `ffcsCourseCatalogFilters.render.test.tsx` — _(scenario pins — see file)_

## `ffcsDossierSubpage*` (1)

- `ffcsDossierSubpage.render.test.tsx` — _(scenario pins — see file)_

## `ffcsDropPolicy*` (1)

- `ffcsDropPolicy.test.ts` — _(scenario pins — see file)_

## `ffcsFacultyPriority*` (1)

- `ffcsFacultyPriority.test.ts` — _(scenario pins — see file)_

## `ffcsFacultyRanking*` (1)

- `ffcsFacultyRanking.test.ts` — _(scenario pins — see file)_

## `ffcsFriendsSubpage*` (1)

- `ffcsFriendsSubpage.render.test.tsx` — _(scenario pins — see file)_

## `ffcsGenerationRun*` (1)

- `ffcsGenerationRun.dropLadder.test.ts` — drop ladder: when we drop and how it's reported

## `ffcsGeneratorSubpage*` (1)

- `ffcsGeneratorSubpage.render.test.tsx` — _(scenario pins — see file)_

## `ffcsGeneratorTargets*` (1)

- `ffcsGeneratorTargets.test.ts` — generator target lock semantics

## `ffcsGeneratorViewModeModal*` (1)

- `ffcsGeneratorViewModeModal.test.tsx` — _(scenario pins — see file)_

## `ffcsGuidedSelector*` (1)

- `ffcsGuidedSelector.render.test.tsx` — _(scenario pins — see file)_

## `ffcsLayoutModeModal*` (1)

- `ffcsLayoutModeModal.test.tsx` — _(scenario pins — see file)_

## `ffcsPageView*` (1)

- `ffcsPageView.render.test.tsx` — _(scenario pins — see file)_

## `ffcsPlannerGrades*` (1)

- `ffcsPlannerGrades.test.ts` — _(scenario pins — see file)_

## `ffcsRanking*` (1)

- `ffcsRanking.test.ts` — _(scenario pins — see file)_

## `ffcsReports*` (1)

- `ffcsReports.test.ts` — _(scenario pins — see file)_

## `ffcsResultFilters*` (1)

- `ffcsResultFilters.test.ts` — _(scenario pins — see file)_

## `ffcsSettings*` (1)

- `ffcsSettings.test.ts` — settings sanitize/restore/defaults

## `ffcsSettingsModal*` (1)

- `ffcsSettingsModal.test.tsx` — _(scenario pins — see file)_

## `ffcsShare*` (1)

- `ffcsShare.test.ts` — share-link round-trip: compress→decode→same week

## `ffcsShareInput*` (1)

- `ffcsShareInput.test.ts` — parsing raw short codes into plans

## `ffcsShareView*` (1)

- `ffcsShareView.render.test.tsx` — _(scenario pins — see file)_

## `ffcsSlotFacultySwap*` (1)

- `ffcsSlotFacultySwap.test.tsx` — _(scenario pins — see file)_

## `ffcsTab*` (1)

- `ffcsTab.render.test.tsx` — planner tab mounts; routes to guided/modern

## `ffcsTour*` (1)

- `ffcsTour.test.tsx` — _(scenario pins — see file)_

## `ffcsUnlimitedCapWiring*` (1)

- `ffcsUnlimitedCapWiring.test.tsx` — _(scenario pins — see file)_

## `forgetDevice*` (1)

- `forgetDevice.test.ts` — forget-credentials wipe behavior

## `formDossier*` (1)

- `formDossier.test.ts` — _(scenario pins — see file)_

## `freeClassrooms*` (1)

- `freeClassrooms.test.ts` — _(scenario pins — see file)_

## `freeClassroomsTab*` (1)

- `freeClassroomsTab.switch.test.tsx` — _(scenario pins — see file)_

## `friendFinderLoginModal*` (1)

- `friendFinderLoginModal.test.tsx` — _(scenario pins — see file)_

## `friendFinderRouting*` (1)

- `friendFinderRouting.test.tsx` — _(scenario pins — see file)_

## `friendTimetableCourseList*` (1)

- `friendTimetableCourseList.test.tsx` — _(scenario pins — see file)_

## `generatorTargetCoursesWidget*` (1)

- `generatorTargetCoursesWidget.test.tsx` — _(scenario pins — see file)_

## `gradeBoundaries*` (1)

- `gradeBoundaries.test.ts` — boundary tables & letter assignment

## `gradeHistory*` (1)

- `gradeHistory.test.ts` — _(scenario pins — see file)_

## `gradeInsights*` (2)

- `gradeInsights.render.test.tsx` — _(scenario pins — see file)_
- `gradeInsights.test.ts` — _(scenario pins — see file)_

## `gradeRegulations*` (1)

- `gradeRegulations.test.ts` — _(scenario pins — see file)_

## `gradesEffective*` (1)

- `gradesEffective.test.ts` — CGPA cumulative computation

## `historyStack*` (1)

- `historyStack.test.ts` — _(scenario pins — see file)_

## `homeEntryController*` (1)

- `homeEntryController.test.tsx` — guest vs app gate logic

## `imageDownload*` (1)

- `imageDownload.test.ts` — _(scenario pins — see file)_

## `importFile*` (1)

- `importFile.test.ts` — _(scenario pins — see file)_

## `insightCarousel*` (1)

- `insightCarousel.test.tsx` — _(scenario pins — see file)_

## `intro*` (2)

- `intro-song-hydration.test.tsx` — _(scenario pins — see file)_
- `intro-song.test.ts` — _(scenario pins — see file)_

## `labFatWeek*` (1)

- `labFatWeek.test.ts` — _(scenario pins — see file)_

## `latex*` (1)

- `latex.render.test.tsx` — _(scenario pins — see file)_

## `libraries*` (1)

- `libraries.test.ts` — _(scenario pins — see file)_

## `localStorageSubpage*` (1)

- `localStorageSubpage.test.tsx` — _(scenario pins — see file)_

## `manualClassCurve*` (1)

- `manualClassCurve.test.tsx` — _(scenario pins — see file)_

## `marksPredictor*` (1)

- `marksPredictor.test.ts` — absolute & relative grade ladder math

## `marksPredictorStorage*` (1)

- `marksPredictorStorage.test.ts` — _(scenario pins — see file)_

## `marksStatsOp*` (1)

- `marksStatsOp.test.ts` — class stats op merge/absent behavior

## `marksSync*` (1)

- `marksSync.test.ts` — assessment key parity, frozen receipts, consent flow

## `milestoneDates*` (1)

- `milestoneDates.test.ts` — _(scenario pins — see file)_

## `mobileGlobalCss*` (1)

- `mobileGlobalCss.test.ts` — _(scenario pins — see file)_

## `mobileNavStacking*` (1)

- `mobileNavStacking.test.ts` — _(scenario pins — see file)_

## `onboardingDualPane*` (1)

- `onboardingDualPane.render.test.tsx` — _(scenario pins — see file)_

## `onboardingIntroAuthFailure*` (1)

- `onboardingIntroAuthFailure.test.tsx` — _(scenario pins — see file)_

## `optionPicker*` (1)

- `optionPicker.test.tsx` — _(scenario pins — see file)_

## `overlayStack*` (1)

- `overlayStack.test.tsx` — push/pop ordering; dead-entry pruning

## `page*` (1)

- `page-shell-children.test.ts` — _(scenario pins — see file)_

## `pageSkeleton*` (1)

- `pageSkeleton.test.tsx` — _(scenario pins — see file)_

## `paperScannerPage*` (1)

- `paperScannerPage.render.test.tsx` — _(scenario pins — see file)_

## `parsePastedText*` (1)

- `parsePastedText.test.ts` — _(scenario pins — see file)_

## `pasteRegisteredCoursesModal*` (1)

- `pasteRegisteredCoursesModal.test.tsx` — _(scenario pins — see file)_

## `payments*` (1)

- `payments.test.ts` — _(scenario pins — see file)_

## `pdfGenerationBadge*` (1)

- `pdfGenerationBadge.render.test.tsx` — _(scenario pins — see file)_

## `portraitDossier*` (1)

- `portraitDossier.test.ts` — _(scenario pins — see file)_

## `posthog*` (1)

- `posthog.test.ts` — client config identity hash, turn detection

## `predictorGates*` (1)

- `predictorGates.test.tsx` — _(scenario pins — see file)_

## `predictorGpa*` (1)

- `predictorGpa.test.ts` — _(scenario pins — see file)_

## `predictorTour*` (1)

- `predictorTour.test.tsx` — _(scenario pins — see file)_

## `privacyMode*` (1)

- `privacyMode.test.tsx` — _(scenario pins — see file)_

## `profilePage*` (1)

- `profilePage.navigation.test.tsx` — _(scenario pins — see file)_

## `readBootstrapSnapshot*` (1)

- `readBootstrapSnapshot.test.ts` — _(scenario pins — see file)_

## `roomMerge*` (1)

- `roomMerge.test.ts` — _(scenario pins — see file)_

## `sampleCourseList*` (1)

- `sampleCourseList.test.ts` — _(scenario pins — see file)_

## `scannerExamClassifier*` (1)

- `scannerExamClassifier.test.ts` — _(scenario pins — see file)_

## `scannerImageOps*` (1)

- `scannerImageOps.test.ts` — _(scenario pins — see file)_

## `scannerNn*` (1)

- `scannerNn.test.ts` — _(scenario pins — see file)_

## `scannerOcr*` (1)

- `scannerOcr.test.ts` — _(scenario pins — see file)_

## `scannerPdf*` (1)

- `scannerPdf.test.ts` — _(scenario pins — see file)_

## `scannerPipeline*` (1)

- `scannerPipeline.test.ts` — end-to-end OCR pipeline fixtures

## `scannerRasterIo*` (1)

- `scannerRasterIo.test.ts` — _(scenario pins — see file)_

## `scannerSettings*` (1)

- `scannerSettings.test.ts` — _(scenario pins — see file)_

## `scannerStore*` (1)

- `scannerStore.test.ts` — _(scenario pins — see file)_

## `scannerUpload*` (1)

- `scannerUpload.test.ts` — _(scenario pins — see file)_

## `sectionHome*` (1)

- `sectionHome.test.ts` — _(scenario pins — see file)_

## `selectField*` (1)

- `selectField.test.tsx` — _(scenario pins — see file)_

## `serverLogger*` (1)

- `serverLogger.test.ts` — _(scenario pins — see file)_

## `settingsAtoms*` (1)

- `settingsAtoms.test.ts` — _(scenario pins — see file)_

## `settingsNav*` (1)

- `settingsNav.test.ts` — _(scenario pins — see file)_

## `settingsVisibility*` (1)

- `settingsVisibility.test.ts` — _(scenario pins — see file)_

## `shortcuts*` (1)

- `shortcuts.test.ts` — _(scenario pins — see file)_

## `signInReturn*` (1)

- `signInReturn.test.ts` — return path round-trip through sign-in

## `simplifiedMobileHome*` (3)

- `simplifiedMobileHome.desktop.test.tsx` — _(scenario pins — see file)_
- `simplifiedMobileHome.labFat.test.tsx` — _(scenario pins — see file)_
- `simplifiedMobileHome.weekStrip.test.tsx` — _(scenario pins — see file)_

## `single*` (1)

- `single-sync.test.ts` — runPageSync lifecycle

## `slots*` (1)

- `slots.test.ts` — _(scenario pins — see file)_

## `social*` (15)

- `social-classes-and-invites.test.ts` — _(scenario pins — see file)_
- `social-client.test.ts` — _(scenario pins — see file)_
- `social-full-visibility.test.ts` — _(scenario pins — see file)_
- `social-grid.test.ts` — _(scenario pins — see file)_
- `social-groups-hook.test.tsx` — _(scenario pins — see file)_
- `social-groups.test.ts` — _(scenario pins — see file)_
- `social-handle.test.ts` — _(scenario pins — see file)_
- `social-persistence.test.tsx` — _(scenario pins — see file)_
- `social-publish.test.ts` — _(scenario pins — see file)_
- `social-scan-handle.test.ts` — _(scenario pins — see file)_
- `social-schedule.test.ts` — _(scenario pins — see file)_
- `social-sync-button.test.ts` — _(scenario pins — see file)_
- `social-sync-op.test.ts` — social op shape & ordering
- `social-sync-reliability.test.ts` — _(scenario pins — see file)_
- `social.test.ts` — _(scenario pins — see file)_

## `sync*` (3)

- `sync-engine-autologin.test.ts` — login flow captcha→session→op path
- `sync-modes.test.ts` — presets (quick/balanced/full/…) expand, validate, resolve reload modes
- `sync-session.test.ts` — sync sheet lines, progress, close/retry lifecycle

## `syncNotificationRedesign*` (1)

- `syncNotificationRedesign.test.tsx` — _(scenario pins — see file)_

## `syncTimes*` (1)

- `syncTimes.test.ts` — sync timing log recording + failure bookmark

## `targetCourseLockCard*` (1)

- `targetCourseLockCard.curriculumBadge.test.tsx` — _(scenario pins — see file)_

## `targetCourseLocker*` (2)

- `targetCourseLocker.rank.test.tsx` — _(scenario pins — see file)_
- `targetCourseLocker.scrollArea.test.tsx` — _(scenario pins — see file)_

## `tasks*` (1)

- `tasks.test.ts` — _(scenario pins — see file)_

## `tasks_scheduling_moodle*` (1)

- `tasks_scheduling_moodle.test.ts` — _(scenario pins — see file)_

## `timetable*` (4)

- `timetable-horizontal-law.test.tsx` — horizontal layout invariants
- `timetable-metrics.test.ts` — timetable density metrics sorting
- `timetable-vertical-render.test.tsx` — _(scenario pins — see file)_
- `timetable-vertical.test.ts` — _(scenario pins — see file)_

## `timetableDensity*` (1)

- `timetableDensity.test.ts` — _(scenario pins — see file)_

## `timetableGridCourseReference*` (1)

- `timetableGridCourseReference.test.tsx` — _(scenario pins — see file)_

## `tipDeck*` (1)

- `tipDeck.render.test.tsx` — _(scenario pins — see file)_

## `uiTokens*` (1)

- `uiTokens-layout.test.ts` — _(scenario pins — see file)_

## `unicc*` (3)

- `unicc-fallback-callsite.test.ts` — call-site allowlist enforcement
- `unicc-fallback.test.ts` — allowlist paths only; password never sent on failure
- `unicc-target.test.ts` — _(scenario pins — see file)_

## `universalPaste*` (1)

- `universalPaste.test.ts` — _(scenario pins — see file)_

## `useAttendanceState*` (1)

- `useAttendanceState.test.tsx` — _(scenario pins — see file)_

## `useHorizontalSwipe*` (1)

- `useHorizontalSwipe.test.tsx` — _(scenario pins — see file)_

## `useNow*` (1)

- `useNow.test.ts` — _(scenario pins — see file)_

## `utils*` (1)

- `utils.test.ts` — _(scenario pins — see file)_

## `vitfacService*` (1)

- `vitfacService.test.ts` — _(scenario pins — see file)_

## `vtopPaste*` (1)

- `vtopPaste.test.ts` — _(scenario pins — see file)_

## `weekStrip*` (1)

- `weekStrip.test.ts` — _(scenario pins — see file)_

## `worker*` (1)

- `worker-artifact.test.ts` — sw.js artifact integrity

## `workerBase*` (1)

- `workerBase.test.ts` — worker routes allowed/blocked + failover exclusions

## `zinc*` (1)

- `zinc-palette-binding.test.ts` — _(scenario pins — see file)_
