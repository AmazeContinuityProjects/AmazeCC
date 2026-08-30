import { type PredictorAssessment } from "./marksPredictor";

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
  lastUpdated?: number;
}

const STORAGE_KEY = "uni_cc_marks_predictor_state";
const CUSTOM_COURSES_KEY = "uni_cc_marks_predictor_custom_courses";

export const getStoredPredictorState = (): Record<string, StoredCourseState> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Error reading marks predictor state:", e);
    return {};
  }
};

export const saveCoursePredictorState = (
  courseCode: string,
  state: StoredCourseState
): void => {
  if (typeof window === "undefined" || !courseCode) return;
  try {
    const all = getStoredPredictorState();
    all[courseCode] = {
      ...all[courseCode],
      ...state,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Error saving course predictor state:", e);
  }
};

export const getCoursePredictorState = (
  courseCode: string
): StoredCourseState | null => {
  if (typeof window === "undefined" || !courseCode) return null;
  const all = getStoredPredictorState();
  return all[courseCode] || null;
};

export const resetCoursePredictorState = (courseCode: string): void => {
  if (typeof window === "undefined" || !courseCode) return;
  try {
    const all = getStoredPredictorState();
    delete all[courseCode];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    console.error("Error resetting course predictor state:", e);
  }
};

// ── Custom Mock Courses ──
export const getCustomCourses = (): CustomCourseMock[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_COURSES_KEY);
    return raw ? JSON.parse(raw) : [];
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
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Error saving custom course:", e);
  }
};

export const deleteCustomCourse = (courseCode: string): void => {
  if (typeof window === "undefined") return;
  try {
    const list = getCustomCourses().filter((c) => c.courseCode !== courseCode);
    localStorage.setItem(CUSTOM_COURSES_KEY, JSON.stringify(list));
    resetCoursePredictorState(courseCode);
  } catch (e) {
    console.error("Error deleting custom course:", e);
  }
};
