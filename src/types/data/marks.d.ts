export type CourseItem = {
    slNo: string;
    classNbr: string;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    courseSystem: string;
    credits?: number | string;
    faculty: string;
    slot: string;
    courseMode: string;
    assessments: AssessmentItem[];
};

export type AssessmentItem = {
    slNo: string;
    title: string;
    maxMark: string;
    weightagePercent: string;
    status: string;
    scoredMark: string;
    weightageMark: string;
};

export type CGPA = {
    creditsRequired?: string;
    creditsEarned?: string;
    cgpa?: string;
    nonGradedRequirement?: string;
    /**
     * Credits enrolled so far. Published by the `/api/grades` CGPA Details
     * table only, and deliberately NOT interchangeable with `creditsEarned` or
     * `creditsRequired` — a failed or withdrawn course makes registered lower
     * than earned.
     */
    creditsRegistered?: string;
};