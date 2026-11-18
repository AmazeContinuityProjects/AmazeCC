import { type PredictorAssessment } from "./marksPredictor";
import { getTypedStorageItem, setTypedStorageItem, removeTypedStorageItem } from "./storage";

export interface CustomCourseMock {
  courseCode: string;
  courseTitle: string;
  courseType: "Theory Only" | "Lab Only" | "Embedded Theory" | "Project" | "Soft Skill";
  theoryCredits: number;
  labCredits: number;
  isCustom: boolean;
}

export interface StoredCourseState {
  regimenPresetId?: string;
  theoryAssessments?: PredictorAssessment[];
  labAssessments?: PredictorAssessment[];
  projectAssessments?: PredictorAssessment[];
  theoryCredits?: number;
  labCredits?: number;
  simulations?: Record<string, number>; // assessmentId -> simulated raw mark
  targetScore?: number;
  /**
   * The reader's own class mean and σ for this course, used in place of the
   * synced class statistics until cleared (null). Read through
   * `manualClassStats`, which rejects out-of-range values.
   */
  classStatsOverride?: { mean: number; sd: number } | null;
  /**
   * The user's choice to hold the subject out of the SGPA/CGPA aggregation.
   * The row stays on the list (marked as ignored) but the GPA pair reads only
   * courses that are not ignored.
   */
  ignored?: boolean;
  lastUpdated?: number;
}

const STORAGE_KEY = "uni_cc_marks_predictor_state";
const CUSTOM_COURSES_KEY = "uni_cc_marks_predictor_custom_courses";

export const getStoredPredictorState = (): Record<string, StoredCourseState> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = getTypedStorageItem(STORAGE_KEY as any);
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error("Error reading marks predictor state:", e);
    return {};
  }
};

export const saveCoursePredictorState = (courseCode: string, state: StoredCourseState): void => {
  if (typeof window === "undefined" || !courseCode) return;
  try {
    const all = getStoredPredictorState();
    all[courseCode] = {
      ...all[courseCode],
      ...state,
      lastUpdated: Date.now(),
    };
    setTypedStorageItem(STORAGE_KEY as any, all as any);
  } catch (e) {
    console.error("Error saving course predictor state:", e);
  }
};

export const getCoursePredictorState = (courseCode: string): StoredCourseState | null => {
  if (typeof window === "undefined" || !courseCode) return null;
  const all = getStoredPredictorState();
  return all[courseCode] || null;
};

export const resetCoursePredictorState = (courseCode: string): void => {
  if (typeof window === "undefined" || !courseCode) return;
  try {
    const all = getStoredPredictorState();
    delete all[courseCode];
    setTypedStorageItem(STORAGE_KEY as any, all as any);
  } catch (e) {
    console.error("Error resetting course predictor state:", e);
  }
};

/**
 * Toggle the user's "leave this subject out of the GPA pair" choice — an
 * exclusion of the aggregation, not of the list: the row stays visible and
 * keeps its own prediction, only the SGPA/CGPA cards stop reading it. Dropped
 * whenever the course's whole state is reset.
 */
export const setCourseIgnored = (courseCode: string, ignored: boolean): void => {
  if (typeof window === "undefined" || !courseCode) return;
  try {
    const all = getStoredPredictorState();
    all[courseCode] = {
      ...all[courseCode],
      ignored,
      lastUpdated: Date.now(),
    };
    setTypedStorageItem(STORAGE_KEY as any, all as any);
  } catch (e) {
    console.error("Error setting course ignored state:", e);
  }
};

/**
 * The overall reset: every course's saved what-ifs, custom regimens, sims and
 * goals go together with the custom subjects (whose regimens live entirely in
 * this store, so dropping only the sim state would leave them hollow). Every
 * course row then re-derives straight from VTOP's published marks.
 */
export const resetAllCoursePredictorState = (): void => {
  if (typeof window === "undefined") return;
  try {
    removeTypedStorageItem(STORAGE_KEY as any);
    removeTypedStorageItem(CUSTOM_COURSES_KEY as any);
  } catch (e) {
    console.error("Error resetting all marks predictor state:", e);
  }
};

// ── Custom Mock Courses ──
export const getCustomCourses = (): CustomCourseMock[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = getTypedStorageItem(CUSTOM_COURSES_KEY as any);
    if (!raw) return [];
    return typeof raw === "string" ? JSON.parse(raw) : (raw as CustomCourseMock[]);
  } catch (e) {
    console.error("Error reading custom courses:", e);
    return [];
  }
};

export const saveCustomCourse = (course: CustomCourseMock): void => {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomCourses();
    const filtered = list.filter((c) => c.courseCode !== course.courseCode);
    filtered.push(course);
    setTypedStorageItem(CUSTOM_COURSES_KEY as any, filtered as any);
  } catch (e) {
    console.error("Error saving custom course:", e);
  }
};

export const deleteCustomCourse = (courseCode: string): void => {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomCourses().filter((c) => c.courseCode !== courseCode);
    setTypedStorageItem(CUSTOM_COURSES_KEY as any, list as any);
    resetCoursePredictorState(courseCode);
  } catch (e) {
    console.error("Error deleting custom course:", e);
  }
};
