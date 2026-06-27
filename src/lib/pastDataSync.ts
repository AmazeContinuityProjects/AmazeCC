import { API_BASE } from "@/components/custom/Main";

export async function syncPastSemesters(allGradesData: any, creds: any): Promise<void> {
  if (!allGradesData?.grades || !creds) return;

  const pastSemesters = Object.keys(allGradesData.grades);
  if (pastSemesters.length === 0) return;

  for (const semId of pastSemesters) {
    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    if (!localStorage.getItem(attKey) || !localStorage.getItem(marksKey)) {
      console.log(`Fetching frozen data for past semester: ${semId}`);
      try {
        const attRes = await fetch(`${API_BASE}/api/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies,
            authorizedID: creds.authorizedID,
            csrf: creds.csrf,
            semesterId: semId,
          }),
        });

        if (attRes.ok) {
          const attData = await attRes.json();
          if (attData.attendance) {
            localStorage.setItem(attKey, JSON.stringify(attData));
          }
        }

        const marksRes = await fetch(`${API_BASE}/api/marks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies,
            authorizedID: creds.authorizedID,
            csrf: creds.csrf,
            semesterId: semId,
          }),
        });

        if (marksRes.ok) {
          const marksData = await marksRes.json();
          if (marksData.courses) {
            localStorage.setItem(marksKey, JSON.stringify(marksData));
          }
        }
      } catch (err) {
        console.error(`Failed to fetch frozen data for ${semId}`, err);
      }
    }
  }
}

export function loadFrozenPastSemesters(allGradesData: any) {
  if (!allGradesData?.grades) return {};

  const pastSemesters = Object.keys(allGradesData.grades);
  const frozenData: Record<string, { attendance: any; marks: any }> = {};

  for (const semId of pastSemesters) {
    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    const attStr = localStorage.getItem(attKey);
    const marksStr = localStorage.getItem(marksKey);

    if (attStr && marksStr) {
      try {
        frozenData[semId] = {
          attendance: JSON.parse(attStr),
          marks: JSON.parse(marksStr),
        };
      } catch (e) {
        console.error(`Failed to parse frozen data for ${semId}`);
      }
    }
  }

  return frozenData;
}
