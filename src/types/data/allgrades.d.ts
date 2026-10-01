export type GradeBreakdown = {
    slNo: string;
    component: string;
    maxMark: string;
    weightagePercent: string;
    status: string;
    scoredMark: string;
    weightageMark: string;
    /**
     * Which segment of the course this assessment belongs to - `"Theory"`,
     * `"Lab"`, or `"Component N"`.
     *
     * The AmazeCC `all-grades` route derives this from VTOP's separate "Mark
     * Title" tables, but it is **not** present in every deployment: the frozen
     * legacy route behind `api.uni-cc.site` returns a flat breakdown with the
     * field stripped, and it cannot be changed (it is shared by both APIs). So
     * this is optional and every reader must cope without it - see
     * `gradeSegments` in `lib/gradeHistory.ts`.
     */
    type?: string;
};

export type GradeRange = {
    S: string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
} | null;

export type GradeItem = {
    slNo: string;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    grandTotal: string;
    grade: string;
    courseId: string | null;
    details?: GradeBreakdown[] | null;
    range?: GradeRange;
};

export type SemesterGradeResult = {
    gpa: string | null;
    grades: GradeItem[];
} | null;

export type GradeResultsMap = Record<string, SemesterGradeResult>;

export type SettledSemesterResult =
    | { status: "fulfilled"; value: SemesterGradeResult }
    | { status: "rejected"; reason: any };

export type AllGradesRes = {
    semesterId?: string;
    grades?: GradeResultsMap;
    error?: string;
};