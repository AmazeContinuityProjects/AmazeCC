import { api } from "@/lib/sync-engine";
import { appendSyncLine } from "@/lib/sync-engine/sync-session";

export async function syncPastSemesters(allGradesData: any, creds: any): Promise<void> {
  if (!allGradesData?.grades || !creds) return;

  let pastSemesters: string[] = [];
  if (Array.isArray(allGradesData.grades)) {
    pastSemesters = allGradesData.grades.map((sem: any) => sem.semesterSubId || sem.semSubId || sem.semesterId).filter(Boolean);
  } else {
    pastSemesters = Object.keys(allGradesData.grades);
  }
  
  if (pastSemesters.length === 0) return;

  let fetched = 0;
  let failed = 0;
  for (const semId of pastSemesters) {
    if (semId === "Current" || semId === "curriculum" || semId === "effectiveGrades") continue;

    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    if (!localStorage.getItem(attKey) || !localStorage.getItem(marksKey)) {
      console.log(`Fetching frozen data for past semester: ${semId}`);
      try {
        const res = (await api("attendance", {
          method: "POST",
          body: {
            cookies: creds.cookies,
            authorizedID: creds.authorizedID,
            csrf: creds.csrf,
            semesterId: semId,
          },
          parse: "raw",
        })) as Response;

        if (res.ok) {
          const data = await res.json();
          if (data.attRes?.attendance) {
            localStorage.setItem(attKey, JSON.stringify(data.attRes));
          }
          if (data.marksRes?.courses) {
            localStorage.setItem(marksKey, JSON.stringify(data.marksRes));
          }
          fetched++;
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Failed to fetch frozen data for ${semId}`, err);
        failed++;
      }
    }
  }

  if (fetched > 0 || failed > 0) {
    appendSyncLine(
      failed > 0
        ? `Past semester data synced (${fetched} ok, ${failed} failed)`
        : `Past semester data synced (${fetched} semester${fetched === 1 ? "" : "s"})`,
      failed > 0 ? "error" : "success"
    );
  }
}

export function loadFrozenPastSemesters(allGradesData: any) {
  if (!allGradesData?.grades) return {};

  let pastSemesters: string[] = [];
  if (Array.isArray(allGradesData.grades)) {
    pastSemesters = allGradesData.grades.map((sem: any) => sem.semesterSubId || sem.semSubId || sem.semesterId).filter(Boolean);
  } else {
    pastSemesters = Object.keys(allGradesData.grades);
  }
  
  const frozenData: Record<string, { attendance: any; marks: any }> = {};

  for (const semId of pastSemesters) {
    if (semId === "Current" || semId === "curriculum" || semId === "effectiveGrades") continue;
    
    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    const attStr = localStorage.getItem(attKey);
    const marksStr = localStorage.getItem(marksKey);

    if (attStr || marksStr) {
      try {
        frozenData[semId] = {
          attendance: attStr ? JSON.parse(attStr) : null,
          marks: marksStr ? JSON.parse(marksStr) : null,
        };
      } catch (e) {
        console.error(`Failed to parse frozen data for ${semId}`);
      }
    }
  }

  return frozenData;
}
