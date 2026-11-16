import { api } from "@/lib/sync-engine";
import type { QBankCourse, QBankPaper, QBankQuestion } from "@/types/qbank.types";

export interface QBankUpload {
  courseCode: string;
  title: string;
  paperType: string;
  examSemester: string;
  examYear: string;
  uploaderRegNo: string;
  fileUrl: string;
}

/** Public QBank reads are served by Hono's native catalogue routes. */
export function getQBankCourses() {
  return api("qbank/courses", { method: "GET", auth: "none" }) as Promise<{
    success: boolean;
    data: QBankCourse[];
  }>;
}

export function getQBankPapers(course: string) {
  return api("qbank/papers", {
    method: "GET",
    auth: "none",
    query: { course },
  }) as Promise<{ success: boolean; data: QBankPaper[] }>;
}

export function getQBankQuestions(course: string) {
  return api("qbank/questions", {
    method: "GET",
    auth: "none",
    query: { course },
  }) as Promise<{ success: boolean; data: QBankQuestion[] }>;
}

/** Hono requires a DPoP-bound Amaze ID for paper submissions. */
export function uploadQBankPaper(payload: QBankUpload) {
  return api("qbank/upload", {
    method: "POST",
    auth: "amazeId",
    body: payload,
  }) as Promise<{ success: boolean; error?: string }>;
}
