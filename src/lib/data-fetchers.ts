import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";
import { loginToEventHub } from "./event-hub";
import type { LoginCredentials } from "./auth";

async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetchWithTimeout(`${API_BASE}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface AttendanceVerifyResult {
  attRes: object;
  marksRes: object;
}

export async function fetchAttendanceAndMarks(
  creds: LoginCredentials,
  currSemesterID: string,
): Promise<AttendanceVerifyResult> {
  const res = await apiPost("attendance", {
    cookies: creds.cookies,
    authorizedID: creds.authorizedID,
    csrf: creds.csrf,
    semesterId: currSemesterID,
  });
  const data = await res.json();

  if (!data.attRes || !data.attRes.attendance) {
    throw new Error("Session verification failed. Please try again.");
  }
  if (data.marksRes && typeof data.marksRes === "string") {
    throw new Error(`Marks fetch failed: ${data.marksRes}`);
  }

  return { attRes: data.attRes as object, marksRes: data.marksRes as object };
}

export interface CoreDataResult {
  gradesRes: object;
  scheduleRes: object;
  hostelRes: object;
  calendarRes: object;
  allGradesRes: object;
  profileImagesRes: object | null;
}

export async function fetchCoreData(
  creds: LoginCredentials,
  currSemesterID: string,
  calendarType: string,
  isHosteller: boolean,
): Promise<CoreDataResult> {
  const [gradesRes, scheduleRes, hostelRes, calendarRes, allGradesRes, profileImagesRes] = await Promise.all([

    apiPost("grades", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: currSemesterID }).then(r => r.json()),

    apiPost("schedule", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: currSemesterID }).then(r => r.json()),

    isHosteller
      ? apiPost("hostel", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json())
      : Promise.resolve({}),

    apiPost("calendar", {
      cookies: creds.cookies,
      authorizedID: creds.authorizedID,
      csrf: creds.csrf,
      type: calendarType || "ALL",
      semesterId: currSemesterID,
    }).then(r => r.json()),

    apiPost("all-grades", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),

    apiPost("profile-images", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf })
      .then(async r => {
        if (!r.ok) return null;
        const j = await r.json();
        if (j?.success) {
          storage.profileImages.set(j);
          return j;
        }
        return null;
      })
      .catch(() => null),
  ]);

  storage.grades.set(gradesRes);
  storage.schedule.set(scheduleRes);
  storage.hostel.set(hostelRes);
  storage.calendar.set(calendarRes);
  storage.allGrades.set(allGradesRes);

  return { gradesRes: gradesRes as object, scheduleRes: scheduleRes as object, hostelRes: hostelRes as object, calendarRes: calendarRes as object, allGradesRes: allGradesRes as object, profileImagesRes: profileImagesRes as object | null };
}

export interface EventDataResult {
  registeredEvents: unknown[];
  eventHubEvents: unknown[];
}

export async function fetchEventData(
  ids: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
): Promise<EventDataResult> {
  const [eventsRes, publicEvents] = await Promise.all([
    (async () => {
      try {
        const jsessionid = await loginToEventHub(ids, demoMode);
        if (!jsessionid) return { events: [] };
        const r = await fetchWithTimeout(`${API_BASE}/api/events/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsessionid }),
        });
        if (!r.ok) return { events: [] };
        return await r.json();
      } catch {
        return { events: [] };
      }
    })(),
    fetch(`${API_BASE}/api/events`)
      .then(async r => {
        if (!r.ok) return [];
        const events = await r.json();
        return Array.isArray(events) ? events : [];
      })
      .catch(() => []),
  ]);

  if (eventsRes?.events) storage.registeredEvents.set(eventsRes.events);

  return {
    registeredEvents: eventsRes?.events || [],
    eventHubEvents: publicEvents,
  };
}

export async function fetchStudentProfile(
  creds: LoginCredentials,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiPost("student", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf });
    const data = await res.json();
    if (data?.profile) {
      storage.profile.set(data.profile);
      return data.profile;
    }
  } catch {
    /* background fetch */
  }
  return null;
}

export async function fetchPastAttendance(
  creds: LoginCredentials,
  allGradesRes: { grades?: Record<string, unknown> },
  currSemesterID: string,
): Promise<void> {
  const pastSemesters = Object.keys(allGradesRes?.grades || {}).filter(sem => sem !== currSemesterID);
  if (pastSemesters.length === 0) return;

  await Promise.allSettled(
    pastSemesters.map(sem =>
      apiPost("attendance", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: sem })
        .then(r => r.json())
        .then(data => {
          if (data?.attendance) {
            storage.frozenAttendance.set(sem, data);
          }
        })
        .catch(() => {})
    )
  );
}

export async function fetchFresherData(creds: LoginCredentials): Promise<void> {
  try {
    const [eptRes, ackRes] = await Promise.all([
      apiPost("ept-schedule", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),
      apiPost("acknowledgement", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),
    ]);
    if (eptRes.success) storage.cache.set("ept_schedule", eptRes);
    if (ackRes.success) storage.cache.set("acknowledgement", ackRes);
  } catch {
    /* fail silently */
  }
}

export async function fetchBusRoutes(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/buses`);
    const data = await res.json();
    if (data.success) storage.cache.set("buses", data.buses);
  } catch {
    /* fail silently */
  }
}

type BulkSettings = {
  syncArrearData?: boolean;
  syncAdditionalData?: boolean;
  syncCourseOptionChange?: boolean;
  syncExcRegistration?: boolean;
  syncMinorHonour?: boolean;
  syncCourseCompletion?: boolean;
  syncWishlist?: boolean;
  syncAdditionalLearning?: boolean;
  syncProject?: boolean;
  syncProjectCourse?: boolean;
  syncExamData?: boolean;
  syncProfileData?: boolean;
};

export async function fetchBulkEndpoints(
  creds: LoginCredentials,
  settings: BulkSettings,
): Promise<void> {
  const bulkEndpoints: string[] = [];

  if (settings.syncArrearData !== false) {
    bulkEndpoints.push("arrear-schedule", "arrear-details", "arrear-grade");
  }
  if (settings.syncAdditionalData !== false) {
    if (settings.syncCourseOptionChange !== false) bulkEndpoints.push("course-option-change");
    if (settings.syncExcRegistration !== false) bulkEndpoints.push("exc-registration");
    if (settings.syncMinorHonour !== false) bulkEndpoints.push("minor-honour");
    if (settings.syncCourseCompletion !== false) bulkEndpoints.push("course-completion");
    if (settings.syncWishlist !== false) bulkEndpoints.push("wishlist");
    if (settings.syncAdditionalLearning !== false) bulkEndpoints.push("additional-learning");
    if (settings.syncProject !== false) bulkEndpoints.push("project");
    if (settings.syncProjectCourse !== false) bulkEndpoints.push("project-course");
  }
  if (settings.syncExamData !== false) {
    bulkEndpoints.push("makeup-exam", "makeup-schedule", "compre-info");
  }
  if (settings.syncProfileData !== false) {
    bulkEndpoints.push("credentials", "registration-schedule", "dayboarder", "bank-info", "library-due", "hostel-counselling");
  }

  await Promise.allSettled(
    bulkEndpoints.map(path =>
      apiPost(path, { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf })
        .then(r => r.json())
        .then(data => {
          if (data.success !== false) {
            storage.cache.set(path, data);
          }
        })
        .catch(() => {})
    )
  );
}
