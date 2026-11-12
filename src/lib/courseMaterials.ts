/**
 * Course-material download helpers.
 *
 * Two modes:
 * 1. Server proxy (`amazecc-api /api/course-page/material`) - works with the
 *    same VTOP session supplied by `/api/login`; the browser receives the file
 *    directly via an attachment response.
 * 2. Browser-direct VTOP POST - only works when the page already has a live
 *    VTOP session AND the hidden form fields (or equivalent values like
 *    `_csrf`, `classId`, `materialId`, `materialDate`) are available. Without
 *    them this cannot produce a working direct link.
 */

import { api } from "@/lib/sync-engine";

export type CourseMaterialAction =
  "reference-material" | "syllabus" | "course-plan" | "all-materials" | "general-materials";

export interface CourseMaterialParams {
  cookies?: string | string[];
  authorizedID: string;
  csrf: string;
  action: CourseMaterialAction;
  semSubId?: string;
  semesterSubId?: string;
  semesterId?: string;
  classId?: string;
  courseID?: string;
  courseTYPE?: string;
  materialId?: string;
  materialDate?: string;
  /** Suggested filename for the saved file; the server falls back to VTOP's content-disposition. */
  filename?: string;
}

/**
 * Server proxy: the API does the authenticated VTOP POST and streams the file
 * bytes back. Routed through `api()` like every other call so the API base,
 * failover and timeout behavior stay consistent — a bare relative `/api/...`
 * fetch lands on the static site origin, where nothing is listening.
 */
export async function downloadCourseMaterialProxy(params: CourseMaterialParams): Promise<void> {
  const res: Response = await api("course-page/material", {
    method: "POST",
    body: params,
    parse: "raw",
  });

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const json = await res.json();
      message = json?.error || json?.message || message;
    } catch {
      /* non-json error body */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = filenameMatch?.[1] || `vtop-${params.action}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface DirectVtopFormFields {
  _csrf: string;
  authorizedID: string;
  semSubId?: string;
  semesterSubId?: string;
  semesterId?: string;
  classId?: string;
  courseID?: string;
  courseTYPE?: string;
  materialId?: string;
  materialDate?: string;
  materialMode?: string;
  uploadView?: string;
}

function buildVtopAction(action: CourseMaterialAction): string {
  switch (action) {
    case "reference-material":
      return "https://vtopcc.vit.ac.in/vtop/downloadPdf";
    case "syllabus":
      return "https://vtopcc.vit.ac.in/vtop/courseSyllabusDownload";
    case "course-plan":
      return "https://vtopcc.vit.ac.in/vtop/academics/common/CoursePlanExcelDownload";
    case "all-materials":
    case "general-materials":
      return "https://vtopcc.vit.ac.in/vtop/academics/common/allCourseMeterialDownload";
  }
}

/**
 * Browser-direct VTOP POST. This submits a real form to VTOP, so the browser
 * must already have an active VTOP session cookie for vtopcc.vit.ac.in.
 * Callers must supply the hidden form fields; AmazeCC cannot extract them
 * from the cross-origin VTOP page by itself.
 */
export function downloadCourseMaterialDirect(action: CourseMaterialAction, fields: DirectVtopFormFields): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = buildVtopAction(action);
  form.style.display = "none";
  form.acceptCharset = "UTF-8";

  const merged: Record<string, string> = { ...fields };
  merged.materialMode = fields.materialMode ?? (action === "all-materials" ? "2" : (fields.materialMode ?? "1"));
  if (action === "all-materials" || action === "general-materials") {
    merged.uploadView = fields.uploadView ?? "1";
    merged.semesterSubId = fields.semesterSubId ?? fields.semSubId ?? "";
  }

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
