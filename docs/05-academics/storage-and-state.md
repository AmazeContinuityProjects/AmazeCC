# Academics — Storage & State

Atoms: `marksDataAtom`, `marksStatsAtom`, `gradesDataAtom`, `allGradesDataAtom`, `scheduleDataAtom`, `qcmDataAtom`.
Caches: `allGrades`, `schedule`, frozen grade snapshots under `frozen_grade_*`.
Exam schedule lives in the same FFCS bundle cache (`cache_exams_pdf_*` for blobs; ephemeral).
