# Academics — UI Map (annotated, with line counts)

| File                                | ~Lines | Job                                                                                          |
| ----------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `exams/CourseDetailSubpage.tsx`     | ~2,881 | per-course deep-dive: hero, marks breakdown, attendance overlap, FAT predictor, faculty card |
| `exams/CurriculumPage.tsx`          | ~1,578 | degree catalog browser + credit math                                                         |
| `exams/ScheduleDisplay.tsx`         | ~1,000 | exam schedule: view, export PDF/image/iCal                                                   |
| `exams/MarksHistoryTab.tsx`         | ~900   | historical analytics, per-semester table + trend                                             |
| `exams/MarksPredictorTab.tsx`       | ~700   | predictor UI (see 05-marks-predictor/)                                                       |
| `exams/SimplifiedAcademicsPage.tsx` | ~600   | marks list by course type                                                                    |
| `exams/GradesModal.tsx`             | ~500   | grade breakdown sheet                                                                        |
| `exams/CourseDashboard.tsx`         | ~200   | screen switcher with course-dashboard hand-off                                               |
| `exams/VitolDisplay.tsx`            | ~300   | Vitol portal assignments                                                                     |
| `exams/MoodleDisplay.tsx`           | ~700   | Moodle/LMS assignments list (switches to Tasks import)                                       |
| `exams/CircularsTab.tsx`            | ~600   | circulars tree viewer                                                                        |
| `exams/CourseQBankTab.tsx`          | ~700   | papers & questions (see 05-qbank/)                                                           |
| `exams/CourseFacultyCard.tsx`       | ~400   | faculty info card for any course                                                             |

## The course-dashboard hand-off (this is load-bearing)

```ts
// producer (SimplifiedMobileHome, attendance, OD):
setCourseDashboardTarget({ courseCode, targetTab: "overview" }); setActiveSubTab("academics");
// consumer (CourseDashboard):
const { target, clear } = useCourseDashboardTarget(); useEffect(() => { if (target) ... }, [target]);
```

Targets older than one semester are discarded — do not persist deliberately.
