'use client';
import { useState, useEffect, useMemo } from "react";
import LoginForm from "./loginForm";
import DashboardContent from "./Dashboard";
import LoginFooter from "./footer/LoginFooter";
import config from "../../../config.json";
import { attendanceRes, ODListItem, ODListRaw } from "@/types/data/attendance";
import { AllGradesRes } from "@/types/data/allgrades";
import { loadActivityTree, saveActivityTree } from "@/lib/activit-tree";
import demoData from '../../data/demoData.json';
import { AnimatePresence, motion } from "framer-motion";
import { syncMarksDiff } from "@/lib/marksSync";
import { syncPastSemesters } from "@/lib/pastDataSync";
import { CommandPalette } from "@/components/custom/shared";
import LibrarySearchPalette from "./palette/LibrarySearchPalette";
import EventSearchPalette from "./palette/EventSearchPalette";
import SyncNotification from "@/components/custom/shared/SyncNotification";
import { useTheme } from "next-themes";
import { X, Keyboard } from "lucide-react";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";

const FETCH_TIMEOUT = 90000;

let globalLoginPromise: Promise<any> | null = null;
let cachedVTOPCredentials: { cookies: string[], authorizedID: string, csrf: string } | null = null;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

type settings = {
  decimalValues: boolean;
  CGPAHidden: boolean;
  attendancePercentageOrString: "percentage" | "str";
  currSemesterID: string;
  calendarType: "ALL" | "ALL02" | "ALL03" | "ALL05" | "ALL06" | "ALL08" | "ALL11" | "WEI";
  loadingScreen: boolean;
  isDayscholarWithBus: boolean;
  residentialStatus?: "hosteller" | "dayscholar";
  friendlyName?: string;
  syncProfileData?: boolean;
  syncArrearData?: boolean;
  syncExamData?: boolean;
  syncAdditionalData?: boolean;
  syncCourseOptionChange?: boolean;
  syncExcRegistration?: boolean;
  syncMinorHonour?: boolean;
  syncCourseCompletion?: boolean;
  syncWishlist?: boolean;
  syncAdditionalLearning?: boolean;
  syncProject?: boolean;
  syncProjectCourse?: boolean;
}

type IDs = {
  VtopUsername: string;
  VtopPassword: string;
  MoodleUsername: string;
  MoodlePassword: string;
}

const defaultSettings: settings = {
  decimalValues: false,
  CGPAHidden: false,
  attendancePercentageOrString: "percentage",
  currSemesterID: config.semesterIDs[config.semesterIDs.length - 2],
  calendarType: "ALL",
  loadingScreen: false,
  isDayscholarWithBus: false,
  residentialStatus: "hosteller",
  friendlyName: "",
  syncProfileData: true,
  syncArrearData: true,
  syncExamData: true,
  syncAdditionalData: true,
  syncCourseOptionChange: true,
  syncExcRegistration: true,
  syncMinorHonour: true,
  syncCourseCompletion: true,
  syncWishlist: true,
  syncAdditionalLearning: true,
  syncProject: true,
  syncProjectCourse: true
};

const defaultIDs: IDs = {
  VtopUsername: "",
  VtopPassword: "",
  MoodleUsername: "",
  MoodlePassword: "",
}

export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  // --- State Management ---
  const [IDs, setIDs] = useState<IDs>(defaultIDs);
  const [message, setMessage] = useState<string>("");
  const [attendanceData, setAttendanceData] = useState<attendanceRes | null>({});
  const [marksData, setMarksData] = useState<object>({});
  const [GradesData, setGradesData] = useState<object>({});
  const [AllGradesData, setAllGradesData] = useState<AllGradesRes>({});
  const [ScheduleData, setScheduleData] = useState<object>({});
  const [hostelData, sethostelData] = useState<object>({});
  const [Calender, setCalender] = useState<object>({});
  const [activeDay, setActiveDay] = useState<string>("");
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("home");
  const [attendancePercentage, setattendancePercentage] = useState<object>({});
  const [ODhoursData, setODhoursData] = useState<object>({});
  const [ODhoursIsOpen, setODhoursIsOpen] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [GradesDisplayIsOpen, setGradesDisplayIsOpen] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<string>("overview");
  const [HostelActiveSubTab, setHostelActiveSubTab] = useState<string>("mess");
  const [activeAttendanceSubTab, setActiveAttendanceSubTab] = useState<string>("attendance");
  const [activeDayscholarSubTab, setActiveDayscholarSubTab] = useState<string>("finder");
  const [activeQBankSubTab, setActiveQBankSubTab] = useState<string>("archive");
  const [activeMoreSubTab, setActiveMoreSubTab] = useState<string>("social");
  const [activeProfileSubTab, setActiveProfileSubTab] = useState<string>("info");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [progressBar, setProgressBar] = useState<number>(0);
  const [moodleData, setMoodleData] = useState([]);
  const [vitolData, setVitolData] = useState([]);
  const [isAPIworking, setIsAPIworking] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [settings, setSettings] = useState<settings>(defaultSettings);
  const [registeredEvents, setRegisteredEvents] = useState<any[]>([]);
  const [eventHubEvents, setEventHubEvents] = useState<any[]>([]);
  const [eventPreviewCache, setEventPreviewCache] = useState<Record<string, { imageSrc: string; description: string; metaDetails: Record<string, string> }>>({});
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [kohaBooks, setKohaBooks] = useState<any[]>([]);
  const [kohaLoading, setKohaLoading] = useState(false);

  useEffect(() => {
    const day = new Date().toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    setActiveDay(day);
    const checkAPIStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();
        setIsAPIworking(data.text === "API is working" ? false : true);
      } catch (err) {
        setIsAPIworking(true);
      }
    };
    checkAPIStatus();
  }, []);

  function setAttendanceAndOD(attendance: attendanceRes): void {
    setAttendanceData(attendance);
    
    // Check for dynamic OD changes (Present -> OD = Wasted) (OD -> Present = Recovered)
    const prevAttRaw = localStorage.getItem("attendance");
    if (prevAttRaw) {
      try {
        const prevAttRes: attendanceRes = JSON.parse(prevAttRaw);
        const trackerRaw = localStorage.getItem("wastedODsTracker");
        const tracker = trackerRaw ? JSON.parse(trackerRaw) : {};
        let trackerUpdated = false;

        attendance.attendance?.forEach(newCourse => {
          const oldCourse = prevAttRes.attendance?.find(c => c.courseCode === newCourse.courseCode);
          if (oldCourse && Array.isArray(oldCourse.viewLink) && Array.isArray(newCourse.viewLink)) {
            newCourse.viewLink.forEach((newDay: any) => {
              const oldDay = (oldCourse.viewLink as any[]).find((d: any) => d.date === newDay.date);
              if (oldDay) {
                const oldStatus = oldDay.status.toLowerCase();
                const newStatus = newDay.status.toLowerCase();

                if (!tracker[newDay.date]) tracker[newDay.date] = {};

                if (oldStatus === "present" && (newStatus === "on duty" || newStatus === "partial od")) {
                  tracker[newDay.date][newCourse.courseCode] = {
                    courseTitle: newCourse.courseTitle,
                    type: newCourse.courseType,
                    slotName: newCourse.slotName,
                    status: "wasted"
                  };
                  trackerUpdated = true;
                } else if ((oldStatus === "on duty" || oldStatus === "partial od") && newStatus === "present") {
                  if (tracker[newDay.date][newCourse.courseCode] && tracker[newDay.date][newCourse.courseCode].status === "wasted") {
                    tracker[newDay.date][newCourse.courseCode].status = "recovered";
                    trackerUpdated = true;
                  }
                }
              }
            });
          }
        });

        if (trackerUpdated) {
          localStorage.setItem("wastedODsTracker", JSON.stringify(tracker));
        }
      } catch (e) {
        console.error("Error comparing attendance states:", e);
      }
    }
    let totalClass = 0;
    let attendedClasses = 0;
    attendance.attendance?.forEach(course => {
      totalClass += course.totalClasses || 0;
      attendedClasses += course.attendedClasses || 0;
    });
    setattendancePercentage({ "percentage": Math.round(attendedClasses * 10000 / totalClass) / 100, "str": `${attendedClasses}/${totalClass}` });

    let ODList: ODListRaw = {};
    attendance.attendance.forEach(course => {
      if (!course.viewLink || !Array.isArray(course.viewLink)) return;

      course.viewLink.forEach(day => {
        if (day.status === "On Duty") {
          if (!ODList[day.date]) {
            ODList[day.date] = [];
          }
          let hours = course.slotName.startsWith("L") ? 2 : 1;
          ODList[day.date].push({
            title: course.courseTitle,
            type: course.slotName.startsWith("L") ? "LAB" : "TH",
            hours
          });
        }
      });
    });
    const formattedList: ODListItem[] = Object.entries(ODList)
      .map(([date, courses]) => ({
        date,
        courses,
        total: courses.reduce((sum, c) => sum + c.hours, 0)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setODhoursData(formattedList);
  }

  // --- Effects ---
  useEffect(() => {
    const storedAttendance = localStorage.getItem("attendance");
    const storedMarks = localStorage.getItem("marks");
    const storedGrades = localStorage.getItem("grades");
    const storedAllGrades = localStorage.getItem("allGrades");
    const storedUsername = localStorage.getItem("username");
    const storedPassword = localStorage.getItem("password");
    const storedMoodleUsername = localStorage.getItem("moodle_username");
    const storedMoodlePassword = localStorage.getItem("moodle_password");
    const storedSchedule = localStorage.getItem("schedule");
    const storedHoste = localStorage.getItem("hostel");
    const calendar = localStorage.getItem("calender");
    const MoodleData = localStorage.getItem("moodleData");
    const VitolData = localStorage.getItem("vitolData");
    const settings = localStorage.getItem("settings");
    const IDs = localStorage.getItem("IDs");
    const storedRegisteredEvents = localStorage.getItem("registeredEvents");

    const parsedStoredAttendance: attendanceRes | null = storedAttendance ? JSON.parse(storedAttendance) : null;
    if (parsedStoredAttendance && parsedStoredAttendance.attendance) {
      setAttendanceAndOD(parsedStoredAttendance);
    }
    if (storedMarks) setMarksData(JSON.parse(storedMarks));
    if (storedSchedule) setScheduleData(JSON.parse(storedSchedule));
    if (storedGrades) setGradesData(JSON.parse(storedGrades));
    if (storedAllGrades) setAllGradesData(JSON.parse(storedAllGrades));
    if (storedHoste) sethostelData(JSON.parse(storedHoste));
    if (calendar) setCalender(JSON.parse(calendar));
    if (MoodleData) setMoodleData(JSON.parse(MoodleData));
    if (VitolData) setVitolData(JSON.parse(VitolData));
    if (storedRegisteredEvents) setRegisteredEvents(JSON.parse(storedRegisteredEvents));
    
    setIDs({
      VtopUsername: storedUsername || "",
      VtopPassword: storedPassword || "",
      MoodleUsername: storedMoodleUsername || "",
      MoodlePassword: storedMoodlePassword || ""
    })
    if (IDs) setIDs(JSON.parse(IDs));
    if (settings) {
      const parsedSettings = JSON.parse(settings);
      setSettings({
        ...defaultSettings,
        ...parsedSettings
      });
    }
    const isDemoStored = localStorage.getItem("demoMode") === "true";
    if (isDemoStored) {
      setDemoMode(true);
      setIsLoggedIn(true);
    } else {
      let hasVtop = false;
      try {
        const parsedIDs = IDs ? JSON.parse(IDs) : null;
        if (parsedIDs?.VtopUsername && parsedIDs?.VtopPassword) {
          hasVtop = true;
        }
      } catch (e) {}
      setIsLoggedIn((storedUsername && storedPassword) || hasVtop ? true : false);
    }
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  const loginToVTOP = async (retry = false, forceNew = false) => {
    if (demoMode || IDs.VtopUsername === "demo") {
      return { cookies: [], authorizedID: "DEMO123", csrf: "" };
    }
    if (cachedVTOPCredentials && !forceNew && !retry) return cachedVTOPCredentials;
    if (globalLoginPromise) return globalLoginPromise;
    globalLoginPromise = (async () => {
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
        setProgressBar(10);
        setMessage("Logging in and fetching data...");
        const loginRes = await fetchWithTimeout(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: IDs.VtopUsername,
            password: IDs.VtopPassword
          }),
        }, 60000);

        const data = await loginRes.json();

        if (data.message?.includes("Invalid Captcha") && !retry) {
          globalLoginPromise = null;
          return await loginToVTOP(true, forceNew);
        }

        if (!data.success || !data.authorizedID || !data.cookies)
          throw new Error(data.message || "Login failed.");

        setMessage((prev) => prev + "\n✅ Login successful");
        setProgressBar((prev) => prev + 30);

        cachedVTOPCredentials = {
          cookies: data.cookies,
          authorizedID: data.authorizedID,
          csrf: data.csrf,
        };
        return cachedVTOPCredentials;
      } finally {
        globalLoginPromise = null;
      }
    })();
    return globalLoginPromise;
  };

  const handleLogin = async (currSemesterID = config.semesterIDs[config.semesterIDs.length - 2]) => {
    if (demoMode || IDs.VtopUsername === "demo") {
      setDemoMode(true);
      localStorage.setItem("demoMode", "true");
      setIsReloading(true);
      setProgressBar(10);
      setMessage("Initializing Demo environment...");
      
      const stages = [
        { progress: 30, msg: "Initializing Demo environment...\n✅ Demo container ready" },
        { progress: 60, msg: "Initializing Demo environment...\n✅ Demo container ready\n✅ Mock attendance & marks loaded" },
        { progress: 85, msg: "Initializing Demo environment...\n✅ Demo container ready\n✅ Mock attendance & marks loaded\n✅ Mock grades & exam schedule loaded" },
        { progress: 100, msg: "Initializing Demo environment...\n✅ Demo container ready\n✅ Mock attendance & marks loaded\n✅ Mock grades & exam schedule loaded\n✅ Demo mode ready" }
      ];
      
      for (let i = 0; i < stages.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressBar(stages[i].progress);
        setMessage(stages[i].msg);
      }
      
      setAttendanceData(demoData.attendance);
      setMarksData(demoData.marks);
      setGradesData(demoData.grades);
      setAllGradesData(demoData.allGrades);
      setScheduleData(demoData.schedule);
      sethostelData(demoData.hostel);
      setCalender(demoData.calender);
      setIsLoggedIn(true);
      setIsReloading(false);
      return;
    }

    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      localStorage.setItem("IDs", JSON.stringify(IDs));

      const verifyRes = await fetchWithTimeout(`${API_BASE}/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf, semesterId: currSemesterID }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyData.attRes || !verifyData.attRes.attendance) {
        throw new Error("Session verification failed. Please try again.");
      }

      if (verifyData.marksRes && typeof verifyData.marksRes === 'string') {
        throw new Error(`Marks fetch failed: ${verifyData.marksRes}`);
      }

      const attRes = verifyData.attRes;
      const marksRes = verifyData.marksRes;
      setMessage(prev => prev + "\n✅ Attendance/Marks fetched");
      setProgressBar(prev => prev + 10);

      let profileRes = JSON.parse(localStorage.getItem("profile") || "null");
      try {
        const studentFetch = await fetchWithTimeout(`${API_BASE}/api/student`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies, authorizedID, csrf }),
        });
        const studentData = await studentFetch.json();
        if (studentData && studentData.profile) {
          profileRes = studentData.profile;
          localStorage.setItem("profile", JSON.stringify(profileRes));
          setMessage(prev => prev + "\n✅ Profile details fetched");
          setProgressBar(prev => prev + 5);
        }
      } catch (e) {
        console.error("Failed to fetch profile", e);
      }

      const [gradesRes, ScheduleRes, HostelRes, calenderRes, allGradesRes, eventsRes, eventHubRes, profileImagesRes] = await Promise.all([

        fetchWithTimeout(`${API_BASE}/api/grades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: cookies, authorizedID, csrf, semesterId: currSemesterID }),
        }).then(async r => {
          const j = await r.json();
          setMessage(prev => prev + "\n✅ Grades fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }),

        fetchWithTimeout(`${API_BASE}/api/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: cookies, authorizedID, csrf, semesterId: currSemesterID }),
        }).then(async r => {
          const j = await r.json();
          setMessage(prev => prev + "\n✅ Exam schedule fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }),

        (profileRes?.isHosteller) ? fetchWithTimeout(`${API_BASE}/api/hostel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: cookies, authorizedID, csrf }),
        }).then(async r => {
          const j = await r.json();
          setMessage(prev => prev + "\n✅ Hostel details fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }) : Promise.resolve({}),

        fetchWithTimeout(`${API_BASE}/api/calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: cookies,
            authorizedID, csrf,
            type: settings.calendarType || "ALL",
            semesterId: currSemesterID
          }),
        }).then(async r => {
          const j = await r.json();
          setMessage(prev => prev + "\n✅ Calendar fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }),
        fetchWithTimeout(`${API_BASE}/api/all-grades`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: cookies, authorizedID, csrf }),
        }).then(async r => {
          const j = await r.json();
          setMessage(prev => prev + "\n✅ All grades fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }),
        fetchWithTimeout(`${API_BASE}/api/events/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: IDs.VtopUsername, password: IDs.VtopPassword }),
        }).then(async r => {
          if (!r.ok) return { events: [] };
          const j = await r.json();
          setMessage(prev => prev + "\n✅ Event Hub data fetched");
          setProgressBar(prev => prev + 5);
          return j;
        }).catch(() => ({ events: [] })),
        fetch(`${API_BASE}/api/events`).then(async r => {
          if (!r.ok) return [];
          const events = await r.json();
          if (Array.isArray(events)) {
            setEventHubEvents(events);
            setMessage(prev => prev + `\n✅ ${events.length} EventHub events loaded`);
          }
          return events;
        }).catch(() => []),
        fetchWithTimeout(`${API_BASE}/api/profile-images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies, authorizedID, csrf }),
        }).then(async r => {
          if (!r.ok) return null;
          const j = await r.json();
          if (j?.success) {
            setMessage(prev => prev + "\n✅ Profile images cached");
            setProgressBar(prev => prev + 3);
            return j;
          }
          return null;
        }).catch(() => null),
      ]);

      setMessage(prev => prev + "\nFinalizing and saving data...");

      setAttendanceAndOD(attRes);
      setMarksData(marksRes);
      setGradesData(gradesRes);
      setAllGradesData(allGradesRes);
      setScheduleData(ScheduleRes);
      sethostelData(HostelRes);
      setCalender(calenderRes);
      if (eventsRes?.events) setRegisteredEvents(eventsRes.events);
      if (profileImagesRes?.success) localStorage.setItem("profileImages", JSON.stringify(profileImagesRes));

      const oldMarks = JSON.parse(localStorage.getItem("marks") || "{}");
      syncMarksDiff(oldMarks, marksRes, IDs.VtopUsername);

      localStorage.setItem("attendance", JSON.stringify(attRes));
      localStorage.setItem("marks", JSON.stringify(marksRes));
      localStorage.setItem("grades", JSON.stringify(gradesRes));
      localStorage.setItem("allGrades", JSON.stringify(allGradesRes));
      localStorage.setItem("schedule", JSON.stringify(ScheduleRes));
      localStorage.setItem("hostel", JSON.stringify(HostelRes));
      localStorage.setItem("calender", JSON.stringify(calenderRes));
      if (eventsRes?.events) localStorage.setItem("registeredEvents", JSON.stringify(eventsRes.events));
      // Past Semester Attendance Fetch
      try {
        const pastSemesters = Object.keys(allGradesRes?.grades || {}).filter(sem => sem !== currSemesterID);
        if (pastSemesters.length > 0) {
          setMessage(prev => prev + `\nFetching past attendance for ${pastSemesters.length} semesters...`);
          await Promise.allSettled(
            pastSemesters.map(sem =>
              fetch(`${API_BASE}/api/attendance`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cookies, authorizedID, csrf, semesterId: sem }),
              })
                .then(r => r.json())
                .then(data => {
                  if (data && data.attendance) {
                    localStorage.setItem(`frozen_att_${sem}`, JSON.stringify(data));
                  }
                  setProgressBar(prev => Math.min(prev + 2, 95));
                })
                .catch(() => {})
            )
          );
        }
      } catch (e) {
        console.error("Failed past attendance", e);
      }

      // Fresher / EPT data
      try {
        const [eptRes, ackRes] = await Promise.all([
          fetch(`${API_BASE}/api/ept-schedule`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          }).then(r => r.json()),
          fetch(`${API_BASE}/api/acknowledgement`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          }).then(r => r.json()),
        ]);
        if (eptRes.success) localStorage.setItem("cache_ept_schedule", JSON.stringify(eptRes));
        if (ackRes.success) localStorage.setItem("cache_acknowledgement", JSON.stringify(ackRes));
        setMessage(prev => prev + "\n✅ Fresher / EPT data fetched");
      } catch {}

      // Bus routes
      try {
        const busesRes = await fetch(`${API_BASE}/api/buses`).then(r => r.json());
        if (busesRes.success) localStorage.setItem("cache_buses", JSON.stringify(busesRes.buses));
        setMessage(prev => prev + "\n✅ Bus routes fetched");
      } catch {}

      // All other VTOP-scoped endpoints (cached for GenericApiView)
      const bulkEndpoints: string[] = [];
      if (settings.syncArrearData !== false) {
        bulkEndpoints.push("arrear-schedule", "arrear-details", "arrear-grade");
      }
      // We still check syncAdditionalData as a master toggle for this section,
      // but also respect the individual toggles. If syncAdditionalData is false, it skips all of them.
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
        bulkEndpoints.push(
          "credentials", "registration-schedule", "dayboarder", "bank-info", 
          "library-due", "hostel-counselling"
        );
      }
      
      await Promise.allSettled(
        bulkEndpoints.map(path =>
          fetch(`${API_BASE}/api/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.success !== false) {
                localStorage.setItem("cache_" + path, JSON.stringify(data));
              }
              setMessage(prev => prev + `\n✅ ${path} fetched`);
              setProgressBar(prev => Math.min(prev + 1, 95));
            })
            .catch(() => {})
        )
      );
      setMessage(prev => prev + "\n✅ All tab data cached");

      setMessage(prev => prev + "\n✅ All data loaded successfully!");
      setProgressBar(100);
      setIsLoggedIn(true);
      setIsReloading(false);

      const tree = loadActivityTree();
      tree.increment();
      saveActivityTree(tree);

      return true;
    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Login failed")
      );
      setProgressBar(0);
      setIsReloading(false);
      throw err;
    }
  };

  const fetchTransportData = async () => {
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const res = await fetch(`${API_BASE}/api/transport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      });
      const result = await res.json();
      localStorage.setItem("transportData", JSON.stringify(result));

      if (result.success && result.hasRegistration === true) {
        if (true !== settings.isDayscholarWithBus) {
          setSettings(prev => ({
            ...prev,
            isDayscholarWithBus: true,
            residentialStatus: "dayscholar",
          }));
          const updated = {
            ...settings,
            isDayscholarWithBus: true,
            residentialStatus: "dayscholar",
          };
          localStorage.setItem("settings", JSON.stringify(updated));
        }
      }

      setMessage(prev => prev + "\n✅ Transport data fetched");
      setProgressBar(prev => prev + 5);
    } catch (err) {
      console.error("Failed to fetch transport data:", err);
    }
  };

  // --- Event Handlers ---
  const handleReloadRequest = async () => {
    if (demoMode) {
      setIsReloading(true);
      setProgressBar(10);
      setMessage("Reloading demo environment...");
      
      const stages = [
        { progress: 40, msg: "Reloading demo environment...\n✅ Refreshed mock attendance" },
        { progress: 70, msg: "Reloading demo environment...\n✅ Refreshed mock attendance\n✅ Refreshed mock grades" },
        { progress: 100, msg: "Reloading demo environment...\n✅ Refreshed mock attendance\n✅ Refreshed mock grades\n✅ Demo refresh complete" }
      ];
      
      for (let i = 0; i < stages.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressBar(stages[i].progress);
        setMessage(stages[i].msg);
      }
      
      setAttendanceData(demoData.attendance);
      setMarksData(demoData.marks);
      setGradesData(demoData.grades);
      setAllGradesData(demoData.allGrades);
      setScheduleData(demoData.schedule);
      sethostelData(demoData.hostel);
      setCalender(demoData.calender);
      setIsReloading(false);
      return;
    }

    setIsReloading(true);
    setProgressBar(10);
    setMessage("Reloading data...");
    localStorage.setItem("IDs", JSON.stringify(IDs));

    try {
      if ((settings as any).reloadAllData) {
        await handleLogin(settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]);
        await fetchTransportData();
        
        try {
          const { cookies, authorizedID, csrf } = await loginToVTOP();
          const allGradesData = JSON.parse(localStorage.getItem("allGrades") || "{}");
          await syncPastSemesters(allGradesData, { cookies, authorizedID, csrf });
        } catch (err) {
          console.error("Failed to sync past semesters on global reload", err);
        }
        
        return;
      }

      const { cookies, authorizedID, csrf } = await loginToVTOP();

      const coreTask = fetchWithTimeout(`${API_BASE}/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies,
          authorizedID,
          csrf,
          semesterId: settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2],
        }),
      }).then(async r => {
        const { attRes, marksRes } = await r.json();
        setAttendanceAndOD(attRes);
        setMarksData(marksRes);
        const oldMarks = JSON.parse(localStorage.getItem("marks") || "{}");
        syncMarksDiff(oldMarks, marksRes, IDs.VtopUsername);
        localStorage.setItem("attendance", JSON.stringify(attRes));
        localStorage.setItem("marks", JSON.stringify(marksRes));
        setMessage(prev => prev + "\n✅ Attendance & Marks fetched");
        setProgressBar(prev => prev + 30);
      });

      const tasks: Promise<void>[] = [coreTask];
      
      tasks.push(
        fetchWithTimeout(`${API_BASE}/api/events/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: IDs.VtopUsername, password: IDs.VtopPassword }),
        }).then(async r => {
          if (!r.ok) return;
          const { events } = await r.json();
          if (events) {
            setRegisteredEvents(events);
            localStorage.setItem("registeredEvents", JSON.stringify(events));
            setMessage(prev => prev + "\n✅ Registered events fetched");
          }
        }).catch(() => {})
      );

      tasks.push(
        fetch(`${API_BASE}/api/events`).then(async r => {
          if (!r.ok) return;
          const events = await r.json();
          if (Array.isArray(events) && events.length) {
            setEventHubEvents(events);
            setMessage(prev => prev + `\n✅ ${events.length} EventHub events loaded`);
          }
        }).catch(() => {})
      );

      const moodleUsername = IDs.MoodleUsername;
      const moodlePassword = IDs.MoodlePassword;

      tasks.push(fetchTransportData());

      if (moodleUsername && moodlePassword) {
        tasks.push(
          (async () => {
            const res = await fetchWithTimeout(`${API_BASE}/api/lms-data`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username: moodleUsername,
                pass: moodlePassword,
              }),
            });

            const moodleData = await res.json();
            const prevData = JSON.parse(localStorage.getItem("moodleData") || "[]");

            const merged = moodleData.map(item => {
              const prevItem = prevData.find(p => p.url === item.url);
              return {
                ...item,
                hidden: prevItem?.hidden ?? false,
              };
            });

            setMoodleData(merged);
            localStorage.setItem("moodleData", JSON.stringify(merged));
            setMessage(prev => prev + "\n✅ Moodle data fetched");
            setProgressBar(prev => prev + 20);
          })()
        );
      }

      // tasks.push(
      //   (async () => {
      //     const res = await fetch(`${API_BASE}/api/grades`, {
      //       method: "POST",
      //       headers: { "Content-Type": "application/json" },
      //       body: JSON.stringify({ cookies, authorizedID, csrf, semesterId: settings.currSemesterID }),
      //     });
      //     const GradesData = await res.json();
      //     setGradesData(GradesData);
      //     localStorage.setItem("grades", JSON.stringify(GradesData));
      //     setMessage(prev => prev + "\n✅ Grades data fetched");
      //     setProgressBar(prev => prev + 20);
      //   })()
      // )

      // tasks.push(
      //   (async () => {
      //     const res = await fetch(`${API_BASE}/api/schedule`, {
      //       method: "POST",
      //       headers: { "Content-Type": "application/json" },
      //       body: JSON.stringify({ cookies: cookies, authorizedID, csrf, semesterId: settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2] }),
      //     })
      //     const scheduleData = await res.json();
      //     setScheduleData(scheduleData);
      //     localStorage.setItem("schedule", JSON.stringify(scheduleData));
      //     setMessage(prev => prev + "\n✅ Schedule data fetched");
      //     setProgressBar(prev => prev + 20);
      //   })()
      // )
      tasks.push(
        fetchWithTimeout(`${API_BASE}/api/qcm-view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies, authorizedID, csrf, semesterId: "" }),
        }).then(async r => {
          if (!r.ok) return;
          const d = await r.json();
          if (d.success && d.data) {
             localStorage.setItem("qcmData", JSON.stringify(d.data));
             setMessage(prev => prev + "\n✅ QCM data fetched");
          }
        }).catch(() => {})
      );

      await Promise.all(tasks);

      // Fresher / EPT data
      try {
        const [eptRes, ackRes] = await Promise.all([
          fetch(`${API_BASE}/api/ept-schedule`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          }).then(r => r.json()),
          fetch(`${API_BASE}/api/acknowledgement`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          }).then(r => r.json()),
        ]);
        if (eptRes.success) localStorage.setItem("cache_ept_schedule", JSON.stringify(eptRes));
        if (ackRes.success) localStorage.setItem("cache_acknowledgement", JSON.stringify(ackRes));
        setMessage(prev => prev + "\n✅ Fresher / EPT data fetched");
      } catch {}

      // Bus routes
      try {
        const busesRes = await fetch(`${API_BASE}/api/buses`).then(r => r.json());
        if (busesRes.success) localStorage.setItem("cache_buses", JSON.stringify(busesRes.buses));
        setMessage(prev => prev + "\n✅ Bus routes fetched");
      } catch {}

      // Library data
      try {
        const dueRes = await fetch(`${API_BASE}/api/library-due`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies, authorizedID, csrf }),
        });
        const dueData = await dueRes.json();
        if (dueData.success) localStorage.setItem("cache_library_due", JSON.stringify(dueData));
        setMessage(prev => prev + "\n✅ Library data fetched");
      } catch {}

      // All other VTOP-scoped endpoints (cached for GenericApiView)
      const bulkEndpoints = [
        "arrear-schedule", "arrear-details", "arrear-grade",
        "course-option-change", "exc-registration", "minor-honour", "course-completion",
        "wishlist", "additional-learning",
        "project", "project-course",
        "makeup-exam", "makeup-schedule", "compre-info",
        "hostel-counselling",
        "credentials", "registration-schedule", "dayboarder", "bank-info",
      ];
      await Promise.allSettled(
        bulkEndpoints.map(path =>
          fetch(`${API_BASE}/api/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          })
            .then(r => r.json())
            .then(data => {
              if (data.success !== false) {
                localStorage.setItem("cache_" + path, JSON.stringify(data));
              }
            })
            .catch(() => {})
        )
      );
      setMessage(prev => prev + "\n✅ All tab data cached");

      setProgressBar(100);
      setIsLoggedIn(true);
      setIsReloading(false);

    } catch (err) {
      console.error(err);
      setMessage(
        "❌ " + (err instanceof Error ? err.message : "Login failed")
      );
      setProgressBar(0);
    }
  };

  const handleLogOutRequest = () => {
    setIsLoggedIn(false);
    setIDs(defaultIDs);
    setDemoMode(false);

    const keysToKeep = ["theme", "activityTree", "settings"];

    const saved: Record<string, string | null> = {};
    keysToKeep.forEach((key) => {
      saved[key] = localStorage.getItem(key);
    });

    localStorage.clear();

    keysToKeep.forEach((key) => {
      if (saved[key] !== null) {
        localStorage.setItem(key, saved[key]!);
      }
    });

    setAttendanceData({});
    setMarksData({});
    setGradesData({});
    setScheduleData({});
    setMessage("");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!IDs.VtopUsername || !IDs.VtopPassword) {
      return alert("Please fill all the fields!");
    }
    setIsReloading(true);
    handleLogin().catch(() => {});
  };

  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const handleDemoClick = () => {
    setDemoMode(true);
    localStorage.setItem("demoMode", "true");
    setIDs({
      VtopUsername: demoData.username,
      VtopPassword: demoData.password,
      MoodleUsername: "",
      MoodlePassword: ""
    });

    setSettings(defaultSettings);
    setAttendanceData(demoData.attendance);
    setMarksData(demoData.marks);
    setGradesData(demoData.grades);
    setAllGradesData(demoData.allGrades);
    setScheduleData(demoData.schedule);
    sethostelData(demoData.hostel);
    setCalender(demoData.calender);
    setIsLoggedIn(true);
  }

  const [showReloadBanner, setShowReloadBanner] = useState(false);

  useEffect(() => {
    if (isReloading) {
      setShowReloadBanner(true);
      return;
    }

    if (progressBar >= 100 || message.trim().startsWith("❌")) {
      setShowReloadBanner(true);
    }
  }, [isReloading, message, progressBar]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Toggle search palette (Ctrl/Cmd + K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Toggle shortcuts help sheet (Shift + ? or just ?)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setIsShortcutsHelpOpen(false);
      }

      // Ignore shortcuts if typing inside inputs/textareas
      const activeEl = document.activeElement;
      if (activeEl && (
        activeEl.tagName === "INPUT" || 
        activeEl.tagName === "TEXTAREA" || 
        activeEl.getAttribute("contenteditable") === "true"
      )) {
        return;
      }

      // We only listen for Alt (Option) key combinations for global actions
      if (e.altKey) {
        const key = e.key.toLowerCase();
        
        // Navigation Shortcuts
        if (key === "h") {
          e.preventDefault();
          setActiveTab("home");
        } else if (key === "a") {
          e.preventDefault();
          setActiveTab("attendance");
        } else if (key === "e") {
          e.preventDefault();
          setActiveTab("more");
          setActiveMoreSubTab("events");
        } else if (key === "l") {
          e.preventDefault();
          setActiveTab("libraries");
        } else if (key === "g") {
          e.preventDefault();
          setActiveTab("academics");
          setActiveSubTab("grades");
        } else if (key === "s") {
          e.preventDefault();
          setActiveTab("profile");
          setActiveProfileSubTab("settings");
        } 
        
        // Modal & Action Shortcuts
        else if (key === "o") {
          e.preventDefault();
          setODhoursIsOpen(prev => !prev);
        } else if (key === "b") {
          e.preventDefault();
          setSettings(prev => {
            const nextVal = !prev.CGPAHidden;
            localStorage.setItem("settings", JSON.stringify({ ...prev, CGPAHidden: nextVal }));
            return { ...prev, CGPAHidden: nextVal };
          });
        } else if (key === "t") {
          e.preventDefault();
          setTheme(theme === "dark" ? "light" : "dark");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [theme, setTheme, settings, setSettings, setActiveTab, setActiveMoreSubTab, setActiveSubTab, setActiveProfileSubTab, setODhoursIsOpen]);

  // ── Dynamic palette search (KOHA catalog via "koha" prefix) ──
  useEffect(() => {
    if (!commandPaletteOpen) { setKohaBooks([]); setKohaLoading(false); return; }
    const lower = paletteQuery.toLowerCase();
    const kohaIdx = lower.indexOf("koha");
    if (kohaIdx === -1) { setKohaBooks([]); setKohaLoading(false); return; }
    const searchTerm = paletteQuery.slice(kohaIdx + 4).trim().replace(/^[:;,\-\s]+/, "");
    if (!searchTerm) { setKohaBooks([]); setKohaLoading(true); return; }
    setKohaLoading(true);
    if (demoMode || IDs.VtopUsername === "demo") {
      setTimeout(() => {
        const mockResults = [
          { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", availability: "Available (4 copies)" },
          { title: "Computer Networking: A Top-Down Approach", author: "Kurose, Ross", availability: "Reference Only (1 copy)" },
          { title: "Design Patterns: Elements of Reusable Object-Oriented Software", author: "Gamma, Helm, Johnson, Vlissides", availability: "Checked Out (Due 2026-07-10)" }
        ].filter(book => book.title.toLowerCase().includes(searchTerm.toLowerCase()) || book.author.toLowerCase().includes(searchTerm.toLowerCase()));
        setKohaBooks(mockResults);
        setKohaLoading(false);
      }, 150);
      return;
    }
    const controller = new AbortController();
    fetch(`${API_BASE}/api/koha/search?q=${encodeURIComponent(searchTerm)}&count=10`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => { setKohaBooks(data?.success && Array.isArray(data?.books) ? data.books : []); setKohaLoading(false); })
      .catch(() => { if (!controller.signal.aborted) { setKohaBooks([]); setKohaLoading(false); } });
    return () => controller.abort();
  }, [paletteQuery, commandPaletteOpen]);

  const cmds = useMemo(() => {
    const result: any[] = [];

    // ── Detail helper components (used by data commands) ──
    const attDetail = (course: any) => {
      const a = course.attendedClasses || 0;
      const t = course.totalClasses || 0;
      const p = t > 0 ? ((a / t) * 100).toFixed(1) : "N/A";
      const pNum = parseFloat(p);
      const canMiss = t > 0 ? Math.max(0, Math.floor((a - 0.75 * t) / 0.75)) : 0;
      const needAttend = canMiss === 0 && t > 0 ? Math.ceil((0.75 * t - a) / 0.25) : 0;
      const color = pNum >= 80 ? "emerald" : pNum >= 75 ? "amber" : "red";
      const colorClasses = {
        emerald: "text-emerald-700 dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/15 border-emerald-200/50 dark:border-emerald-800/30",
        amber: "text-amber-700 dark:text-amber-400 bg-amber-50  dark:bg-amber-900/15 border-amber-200/50 dark:border-amber-800/30",
        red: "text-red-700 dark:text-red-400 bg-red-50  dark:bg-red-900/15 border-red-200/50 dark:border-red-800/30",
      }[color];
      const barColor = pNum >= 80 ? "bg-emerald-500" : pNum >= 75 ? "bg-amber-500" : "bg-red-500";
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 shrink-0">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200  dark:text-gray-800" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${!isNaN(pNum) ? (pNum / 100) * 97.4 : 0} 97.4`} strokeLinecap="round" className={barColor.replace("bg-", "text-")} />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${color === "red" ? "text-red-600 dark:text-red-400" : color === "amber" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{!isNaN(pNum) ? Math.round(pNum) : "?"}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{course.courseTitle}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-medium text-gray-500  dark:text-gray-400">{course.courseCode}</span>
                <span className="text-[11px] text-gray-400  dark:text-gray-500">·</span>
                <span className="text-[11px] font-medium text-gray-500  dark:text-gray-400">{course.slotName || course.slotVenue || "—"}</span>
                {course.faculty && <><span className="text-[11px] text-gray-400  dark:text-gray-500">·</span><span className="text-[11px] text-gray-500  dark:text-gray-400 truncate">{course.faculty}</span></>}
              </div>
            </div>
          </div>
          <div className={`px-3 py-2 rounded-xl border ${colorClasses}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">Classes attended</span>
              <span className="font-bold">{a}/{t}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-black/10  dark:bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${!isNaN(pNum) ? Math.min(pNum, 100) : 0}%` }} />
            </div>
          </div>
          {canMiss > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-700  dark:text-emerald-300 bg-emerald-50/50  dark:bg-emerald-900/5 px-3 py-2 rounded-xl border border-emerald-200/30 dark:border-emerald-800/20">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              <span className="font-semibold">You can miss {canMiss} more class{canMiss > 1 ? "es" : ""}</span>
            </div>
          )}
          {needAttend > 0 && (
            <div className="flex items-center gap-2 text-xs text-red-700  dark:text-red-300 bg-red-50/50  dark:bg-red-900/5 px-3 py-2 rounded-xl border border-red-200/30 dark:border-red-800/20">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              <span className="font-semibold">Need to attend {needAttend} more to reach 75%</span>
            </div>
          )}
        </div>
      );
    };
    const markDetail = (course: any) => {
      const assessments = course.assessments || [];
      const totalWeighted = assessments.reduce((s: number, a: any) => s + parseFloat(a.scoredMark || "0"), 0);
      const totalMax = assessments.reduce((s: number, a: any) => s + parseFloat(a.maxMark || "0"), 0);
      const scorePerc = totalMax > 0 ? (totalWeighted / totalMax) * 100 : 0;
      const scoreColor = scorePerc >= 80 ? "emerald" : scorePerc >= 60 ? "amber" : "red";
      const scoreBar = scorePerc >= 80 ? "bg-emerald-500" : scorePerc >= 60 ? "bg-amber-500" : "bg-red-500";
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${scoreColor === "emerald" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : scoreColor === "amber" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-red-100 dark:bg-red-900/30 text-red-600"}`}>
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{course.courseTitle}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-medium text-gray-500  dark:text-gray-400">{course.courseCode}</span>
                <span className="text-[11px] text-gray-400  dark:text-gray-500">·</span>
                <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${course.courseType?.toLowerCase().includes("lab") ? "bg-purple-100 text-purple-700   dark:bg-purple-900/20 dark:text-purple-400" : "bg-blue-100 text-blue-700   dark:bg-blue-900/20 dark:text-blue-400"}`}>{course.courseType || "Theory"}</span>
                {course.credits && <><span className="text-[11px] text-gray-400  dark:text-gray-500">·</span><span className="text-[11px] text-gray-500  dark:text-gray-400">{course.credits} cr</span></>}
              </div>
            </div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-gray-500  dark:text-gray-400">Overall Score</span>
              <span className={`font-bold text-sm ${scoreColor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : scoreColor === "amber" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{totalWeighted.toFixed(1)} / {totalMax.toFixed(0)}</span>
            </div>
            <div className="h-2 rounded-full bg-black/10  dark:bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${scoreBar}`} style={{ width: `${Math.min(scorePerc, 100)}%` }} />
            </div>
          </div>
          {assessments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">Assessments</span>
                <span className="text-[10px] font-medium text-gray-400  dark:text-gray-500 bg-gray-100  dark:bg-gray-900 px-1.5 py-0.5 rounded-full">{assessments.length}</span>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {assessments.map((a: any, i: number) => {
                  const aPerc = a.maxMark ? (parseFloat(a.scoredMark || "0") / parseFloat(a.maxMark)) * 100 : 0;
                  const aColor = aPerc >= 80 ? "emerald" : aPerc >= 60 ? "amber" : "red";
                  return (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white  dark:bg-gray-900/60 border border-gray-100  dark:border-gray-800/30">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${aColor === "emerald" ? "bg-emerald-500" : aColor === "amber" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className="flex-1 text-[11px] text-gray-700  dark:text-gray-300 truncate">{a.name || `Assessment ${i + 1}`}</span>
                      <span className={`text-[11px] font-bold shrink-0 ${aColor === "emerald" ? "text-emerald-600 dark:text-emerald-400" : aColor === "amber" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>{a.scoredMark || "?"}/{a.maxMark || "?"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    };
    const gradeDetail = (g: any) => {
      const gradeColors: Record<string, string> = {
        S: "text-emerald-700 dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/20 border-emerald-200/50 dark:border-emerald-800/30",
        A: "text-blue-700 dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/30",
        B: "text-amber-700 dark:text-amber-400 bg-amber-50  dark:bg-amber-900/20 border-amber-200/50 dark:border-amber-800/30",
        C: "text-orange-700 dark:text-orange-400 bg-orange-50  dark:bg-orange-900/20 border-orange-200/50 dark:border-orange-800/30",
        D: "text-red-700 dark:text-red-400 bg-red-50  dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30",
        F: "text-red-800 dark:text-red-300 bg-red-100  dark:bg-red-900/30 border-red-300/50 dark:border-red-800/40",
        N: "text-gray-700 dark:text-gray-400 bg-gray-100  dark:bg-gray-800/40 border-gray-300/50 dark:border-gray-700/30",
      };
      const gc = gradeColors[g.grade] || gradeColors.N;
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${gc}`}>
              {g.grade || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{g.courseTitle}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] font-medium text-gray-500  dark:text-gray-400">{g.courseCode}</span>
                {g.courseType && <><span className="text-[11px] text-gray-400  dark:text-gray-500">·</span><span className="text-[11px] text-gray-500  dark:text-gray-400">{g.courseType}</span></>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2 rounded-xl bg-white  dark:bg-gray-900/60 border border-gray-100  dark:border-gray-800/30">
              <p className="text-[10px] font-medium text-gray-400  dark:text-gray-500 uppercase tracking-wide">Grade</p>
              <p className={`text-lg font-black mt-0.5 ${gc.split(" ")[0]}`}>{g.grade || "N/A"}</p>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white  dark:bg-gray-900/60 border border-gray-100  dark:border-gray-800/30">
              <p className="text-[10px] font-medium text-gray-400  dark:text-gray-500 uppercase tracking-wide">Total</p>
              <p className="text-lg font-black mt-0.5 text-gray-900  dark:text-white">{g.grandTotal || "—"}</p>
            </div>
          </div>
        </div>
      );
    };

    // ── Navigation (main tabs) ──
    const nav = [
      { id: "nav-profile", label: "Profile", description: "View your profile and personal info", icon: "👤", category: "Navigation" },
      { id: "nav-attendance", label: "Attendance", description: "Track your attendance records", icon: "📋", category: "Navigation" },
      { id: "nav-academics", label: "Academics Hub", description: "Marks, curriculum, timetable & more", icon: "📚", category: "Navigation" },
      { id: "nav-payments", label: "Payments", description: "Dues, receipts & wallet", icon: "💳", category: "Navigation" },
      { id: "nav-libraries", label: "Libraries", description: "Search books & library account", icon: "📖", category: "Navigation" },
      { id: "nav-hostel", label: "Hostel", description: "Mess, laundry & leave", icon: "🏠", category: "Navigation" },
      { id: "nav-dayscholar", label: "Day Scholar", description: "Bus finder & transport", icon: "🚌", category: "Navigation" },
      { id: "nav-more", label: "More", description: "Events, social & schedules", icon: "➕", category: "Navigation" },
    ];
    nav.forEach(c => result.push({ ...c, onSelect: () => setActiveTab(c.id.replace("nav-", "")) }));

    // ── All sub-tab navigation ──
    result.push(
      { id: "acad-marks", label: "Marks Overview", description: "Course marks & assessments overview", icon: "📊", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("overview"); } },
      { id: "acad-curriculum", label: "Curriculum", description: "Course curriculum & structure", icon: "📜", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("curriculum"); } },
      { id: "acad-timetable", label: "Timetable & Schedule", description: "Exam schedule & timetable", icon: "🗓️", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("course-dashboard"); } },
      { id: "acad-grades", label: "Grade History", description: "All semester grades & CGPA", icon: "🎓", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("grades"); } },
      { id: "acad-gpa-predictor", label: "GPA Predictor", description: "Predict your GPA for this semester", icon: "📈", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("predictor"); } },
      { id: "acad-course-dashboard", label: "Course Dashboard", description: "Detailed per-course view", icon: "📘", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("course-dashboard"); } },
      { id: "acad-circulars", label: "Academic Circulars", description: "View academic circulars & notices", icon: "📢", category: "Academics", onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("circulars"); } },
      { id: "acad-faculty", label: "Faculty Info", description: "Faculty contact & information", icon: "👨‍🏫", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("faculty-info"); } },
      { id: "acad-qcm", label: "QCM View", description: "Question category mapping view", icon: "📝", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("qcm-view"); } },
      { id: "acad-arrear", label: "Arrear Exams", description: "View arrear examination details", icon: "🔄", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("arrear"); } },
      { id: "acad-makeup-compre", label: "Makeup Compre", description: "Makeup comprehensive exam info", icon: "📋", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("makeup-compre"); } },
      { id: "acad-course-mgmt", label: "Course Management", description: "Manage course registrations", icon: "⚙️", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("course-mgmt"); } },
      { id: "acad-projects", label: "Projects", description: "View project submissions & details", icon: "💻", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("projects"); } },
      { id: "acad-wishlist", label: "Course Wishlist", description: "Wishlist for future courses", icon: "⭐", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("wishlist"); } },
      { id: "attendance-view", label: "Attendance Today", description: "Today's attendance overview", icon: "📋", category: "Attendance", onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); } },
      { id: "attendance-calendar", label: "Calendar View", description: "Academic calendar & events", icon: "📅", category: "Attendance", onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("calendar"); } },
      { id: "attendance-circulars", label: "Attendance Circulars", description: "Circulars related to attendance", icon: "📢", category: "Attendance", onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("circulars"); } },
      { id: "profile-info", label: "Profile Info", description: "View profile information", icon: "👤", category: "Profile", onSelect: () => { setActiveTab("profile"); } },
      { id: "profile-settings", label: "Profile Settings", description: "App settings & preferences", icon: "⚙️", category: "Profile", onSelect: () => { setActiveTab("profile"); } },
    );

    // ── Tabs that depend on residential status ──
    result.push(
      { id: "hostel-mess", label: "Hostel Mess", description: "Mess menu, feedback & details", icon: "🍽️", category: "Hostel", onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("mess"); } },
      { id: "hostel-laundry", label: "Laundry", description: "Laundry service status", icon: "👕", category: "Hostel", onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("laundry"); } },
      { id: "hostel-leave", label: "Leave", description: "Leave applications & history", icon: "✈️", category: "Hostel", onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("leave"); } },
      { id: "hostel-counselling", label: "Hostel Counselling", description: "Hostel counselling sessions", icon: "🤝", category: "Hostel", onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("counselling"); } },
      { id: "ds-bus-finder", label: "Bus Finder", description: "Find your bus route & stops", icon: "🚍", category: "Day Scholar", onSelect: () => { setActiveTab("dayscholar"); setActiveDayscholarSubTab("finder"); } },
      { id: "ds-transport", label: "Transport Registration", description: "Register for transport services", icon: "🚏", category: "Day Scholar", onSelect: () => { setActiveTab("dayscholar"); setActiveDayscholarSubTab("registration"); } },
      { id: "qbank-archive", label: "Question Bank Archive", description: "Previous year question papers", icon: "📄", category: "QBank", onSelect: () => { setActiveTab("academics"); setActiveSubTab("qbank"); setActiveQBankSubTab("archive"); } },
      { id: "qbank-pure", label: "Pure QBank", description: "Subject-wise question banks", icon: "❓", category: "QBank", onSelect: () => { setActiveTab("academics"); setActiveSubTab("qbank"); setActiveQBankSubTab("pure"); } },
      { id: "more-social", label: "Social & Schedules", description: "Events, friends & schedules", icon: "👥", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("social"); } },
      { id: "more-events", label: "Events Hub", description: "Registered events & activities", icon: "🎉", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("events"); } },
      { id: "more-schedules", label: "FFCS Planner", description: "Plan and compare schedules", icon: "🗓️", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("ffcs"); } },
    );

    // ── Tools & Modals ──
    result.push(
      { id: "tool-od-hours", label: "OD Hours Display", description: "View on-duty hours breakdown", icon: "⏰", category: "Tools", onSelect: () => setODhoursIsOpen(true) },
      { id: "tool-grades-modal", label: "Grades Details Modal", description: "Open detailed grade breakdown", icon: "📊", category: "Tools", onSelect: () => setGradesDisplayIsOpen(true) },
      { id: "tool-gpa-predictor", label: "GPA Predictor Tool", description: "Calculate and predict your GPA", icon: "🔮", category: "Tools", onSelect: () => { setActiveTab("academics"); setActiveSubTab("predictor"); } },
      { id: "tool-feedback-status", label: "Feedback Status", description: "Check course feedback submission status", icon: "💬", category: "Tools", onSelect: () => setActiveTab("profile") },
      { id: "tool-reload", label: "Reload All Data", description: "Refresh all data from VTOP", icon: "🔄", category: "Tools", onSelect: () => handleReloadRequest() },
    );

    // ── Quick Search subpages ──
    result.push(
      {
        id: "search-library",
        label: "📖 Search Library Catalog",
        description: "Search books by title, author, or keyword",
        icon: "📖",
        category: "Search",
        onSelect: () => {},
        subpage: <LibrarySearchPalette apiBase={API_BASE} />,
      },
      {
        id: "search-events",
        label: "🎪 Search Events",
        description: "Search through registered & discoverable events",
        icon: "🎪",
        category: "Search",
        onSelect: () => {},
        subpage: <EventSearchPalette apiBase={API_BASE} />,
      },
    );

    // ── Settings toggles ──
    const toggle = (label: string, key: keyof typeof settings, category: string, icon: string, invertDesc = false) => {
      const current = settings[key] as boolean;
      result.push({
        id: `setting-${key}-on`,
        label: `${current ? "✅" : "☐"} ${label}`,
        description: invertDesc
          ? (current ? "Currently on — tap to turn off" : "Currently off — tap to turn on")
          : (current ? "Currently on — tap to turn off" : "Currently off — tap to turn on"),
        icon, category: `Settings`,
        rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${current ? "text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20" : "text-gray-500  dark:text-gray-400 bg-gray-100  dark:bg-gray-800"}`}>{current ? "ON" : "OFF"}</span>,
        onSelect: () => {
          const newVal = !current as any;
          setSettings(prev => ({ ...prev, [key]: newVal }));
          localStorage.setItem("settings", JSON.stringify({ ...settings, [key]: newVal }));
        }
      });
    };
    toggle("Decimal Values in Attendance", "decimalValues", "Settings", "🔢");
    toggle("Loading Screen Animation", "loadingScreen", "Settings", "🎬");
    toggle("Dayscholar Bus Mode", "isDayscholarWithBus", "Settings", "🚌");

    [
      { id: "light", label: "Light", icon: "☀️" },
      { id: "dark", label: "Dark", icon: "🌙" },
      { id: "system", label: "System", icon: "💻" },
    ].forEach(option => {
      result.push({
        id: `theme-${option.id}`,
        label: `Theme: ${option.label}`,
        description: theme === option.id ? "Currently active" : `Switch app theme to ${option.label.toLowerCase()}`,
        icon: option.icon,
        category: "Settings",
        rightSlot: theme === option.id ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-300 bg-green-50 dark:bg-green-900/20">Active</span> : undefined,
        onSelect: () => setTheme(option.id),
      });
    });

    // ── Settings: Attendance Display Mode ──
    ["percentage", "str"].forEach(mode => {
      result.push({
        id: `setting-att-display-${mode}`,
        label: `Show Attendance as ${mode === "percentage" ? "Percentage" : "Fraction (X/Y)"}`,
        description: settings.attendancePercentageOrString === mode ? "Currently active" : "Switch to this display mode",
        icon: mode === "percentage" ? "📊" : "📏",
        category: "Settings",
        rightSlot: settings.attendancePercentageOrString === mode ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20">Active</span> : undefined,
        onSelect: () => {
          setSettings(prev => ({ ...prev, attendancePercentageOrString: mode as "percentage" | "str" }));
          localStorage.setItem("settings", JSON.stringify({ ...settings, attendancePercentageOrString: mode }));
        }
      });
    });

    // ── Settings: Residential Status ──
    ["hosteller", "dayscholar"].forEach(status => {
      result.push({
        id: `setting-res-status-${status}`,
        label: `Set Status: ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        description: settings.residentialStatus === status ? "Currently set" : "Switch to this residential status",
        icon: status === "hosteller" ? "🏠" : "🚶",
        category: "Settings",
        rightSlot: settings.residentialStatus === status ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20">Active</span> : undefined,
        onSelect: () => {
          setSettings(prev => ({ ...prev, residentialStatus: status as "hosteller" | "dayscholar" }));
          localStorage.setItem("settings", JSON.stringify({ ...settings, residentialStatus: status }));
        }
      });
    });

    // ── Settings: Calendar Type ──
    const calTypes = ["ALL", "ALL02", "ALL03", "ALL05", "ALL06", "ALL08", "ALL11", "WEI"];
    calTypes.forEach(ct => {
      result.push({
        id: `setting-cal-${ct}`,
        label: `Calendar: ${ct}`,
        description: settings.calendarType === ct ? "Currently selected" : "Switch to this calendar type",
        icon: "📅",
        category: "Settings",
        rightSlot: settings.calendarType === ct ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20">Active</span> : undefined,
        onSelect: () => {
          setSettings(prev => ({ ...prev, calendarType: ct as any }));
          localStorage.setItem("settings", JSON.stringify({ ...settings, calendarType: ct }));
        }
      });
    });

    // ── Settings: Semester Selection ──
    const semIds = config.semesterIDs as string[];
    if (Array.isArray(semIds)) {
      semIds.forEach(sem => {
        result.push({
          id: `setting-sem-${sem}`,
          label: `Semester: ${sem}`,
          description: settings.currSemesterID === sem ? "Currently active" : "Switch to this semester",
          icon: "📖",
          category: "Settings",
          rightSlot: settings.currSemesterID === sem ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20">Active</span> : undefined,
          onSelect: () => {
            setSettings(prev => ({ ...prev, currSemesterID: sem }));
            localStorage.setItem("settings", JSON.stringify({ ...settings, currSemesterID: sem }));
          }
        });
      });
    }

    // ── Per-Course Attendance Commands (smart) ──
    if (attendanceData?.attendance?.length) {
      attendanceData.attendance.forEach((course, idx) => {
        const attended = course.attendedClasses || 0;
        const total = course.totalClasses || 0;
        const percNum = total > 0 ? (attended / total) * 100 : 0;
        const percStr = course.attendancePercentage || percNum.toFixed(1);
        const shortName = course.courseTitle?.length > 30 ? course.courseTitle.substring(0, 28) + "…" : course.courseTitle;
        const code = course.courseCode;

        let canMiss = 0;
        if (total > 0 && attended > 0) {
          canMiss = Math.max(0, Math.floor((attended - 0.75 * total) / 0.75));
        }
        const percColor = percNum >= 80 ? "text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20" : percNum >= 75 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50  dark:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20";
        result.push({
          id: `course-att-${code}-${idx}`,
          label: `Att: ${shortName} (${code})`,
          description: `${percStr}% · ${attended}/${total} classes`,
          icon: "📋",
          category: `Courses · Attendance`,
          rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${percColor}`}>{percStr}%</span>,
          detail: attDetail(course),
          onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }
        });

        // "Miss N classes" what-if commands (1 through max 5 or canMiss+2)
        const maxMiss = Math.min(canMiss + 2, 5);
        for (let miss = 1; miss <= maxMiss; miss++) {
          const newPerc = total > 0 ? (attended / (total + miss) * 100) : 0;
          const newPercStr = newPerc.toFixed(1);
          const newColor = newPerc >= 75 ? "text-blue-600 dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20" : "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20";
          result.push({
            id: `course-miss-${code}-${miss}`,
            label: `Miss ${miss} class${miss > 1 ? "es" : ""} in ${shortName}`,
            description: `Currently ${percStr}%`,
            icon: "🟡",
            category: `What-If · Attendance`,
            rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${newColor}`}>{newPercStr}%</span>,
            onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }
          });
        }

        // "Recover by attending" for courses below 75%
        if (canMiss === 0 && total > 0) {
          const needToAttend = Math.ceil((0.75 * total - attended) / 0.25);
          result.push({
            id: `course-recover-${code}`,
            label: `Need to attend ${needToAttend} more classes in ${shortName}`,
            description: `To reach 75% · Currently ${percStr}%`,
            icon: "📈",
            category: `What-If · Attendance`,
            rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20">🎯 75%</span>,
            onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }
          });
        }
      });

      // Overall attendance summary
      const overallAttended = attendanceData.attendance.reduce((s, c) => s + (c.attendedClasses || 0), 0);
      const overallTotal = attendanceData.attendance.reduce((s, c) => s + (c.totalClasses || 0), 0);
      const overallPerc = overallTotal > 0 ? ((overallAttended / overallTotal) * 100).toFixed(1) : "N/A";
      const below75 = attendanceData.attendance.filter(c => {
        const a = c.attendedClasses || 0; const t = c.totalClasses || 0; return t > 0 && (a / t) < 0.75;
      });
      const overallColor = parseFloat(overallPerc) >= 80 ? "text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20" : parseFloat(overallPerc) >= 75 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50  dark:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20";
      result.push({
        id: "att-summary",
        label: "📊 Attendance Summary",
        description: `${overallAttended}/${overallTotal} classes · ${below75.length} below 75%`,
        icon: "📊",
        category: `Courses · Attendance`,
        rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${overallColor}`}>{overallPerc}%</span>,
        onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }
      });
      below75.forEach((c, i) => {
        const a = c.attendedClasses || 0; const t = c.totalClasses || 0; const p = t > 0 ? ((a / t) * 100).toFixed(1) : "N/A";
        result.push({
          id: `att-below75-${c.courseCode}-${i}`,
          label: `⚠️ ${c.courseTitle} (${c.courseCode})`,
          description: `${a}/${t} classes`,
          icon: "🔴",
          category: "⚠️ Courses Below 75%",
          rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20">{p}%</span>,
          onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("attendance"); }
        });
      });
    }

    // ── Per-Course Marks Commands ──
    const courses = (marksData as any)?.courses;
    if (Array.isArray(courses)) {
      courses.forEach((course, idx) => {
        const isLab = course.courseType?.toLowerCase().includes("lab") || course.slot?.toLowerCase().startsWith("l");
        const shortName = course.courseTitle?.length > 30 ? course.courseTitle.substring(0, 28) + "…" : course.courseTitle;
        const assessments = course.assessments || [];
        const totalWeighted = assessments.reduce((s: number, a: any) => s + parseFloat(a.weightageMark || "0"), 0);
        const totalMax = assessments.reduce((s: number, a: any) => s + parseFloat(a.weightagePercent || "0"), 0);
        const scorePerc = totalMax > 0 ? ((totalWeighted / totalMax) * 100) : 0;
        const scoreColor = scorePerc >= 80 ? "text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20" : scorePerc >= 60 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50  dark:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20";
        result.push({
          id: `course-mark-${course.courseCode}-${idx}`,
          label: `Mark: ${shortName} (${course.courseCode})`,
          description: isLab ? "Lab course" : `${assessments.length} assessments`,
          icon: "📊",
          category: `Courses · Marks`,
          rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${scoreColor}`}>{totalWeighted.toFixed(1)}/{totalMax.toFixed(0)}</span>,
          detail: markDetail(course),
          onSelect: () => { setActiveTab("academics"); setActiveSubTab("overview"); }
        });
      });
    }

    // ── Per-Course Grade Commands from AllGradesData ──
    if (AllGradesData?.grades) {
      Object.entries(AllGradesData.grades).forEach(([semester, semData]: [string, any]) => {
        if (!semData?.grades) return;
        semData.grades.forEach((g: any, idx: number) => {
          const grade = g.grade || "?";
          const gradeColor = grade === "S" ? "text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20" : grade === "A" ? "text-blue-600 dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20" : grade === "B" ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50  dark:bg-yellow-900/20" : grade === "C" ? "text-orange-600 dark:text-orange-400 bg-orange-50  dark:bg-orange-900/20" : grade === "F" || grade === "N" ? "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20" : "text-gray-600 dark:text-gray-400 bg-gray-50  dark:bg-gray-800";
          result.push({
            id: `grade-${semester}-${g.courseCode}-${idx}`,
            label: `Grade: ${g.courseTitle} (${g.courseCode})`,
            description: semester,
            icon: "🎓",
            category: `Grades · ${semester}`,
            rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${gradeColor}`}>{grade}</span>,
            detail: gradeDetail(g),
            onSelect: () => { setActiveTab("academics"); setActiveSubTab("grades"); }
          });
        });
      });
    }

    // ── Current Semester Grade Commands ──
    if ((GradesData as any)?.courses) {
      (GradesData as any).courses.forEach((g: any, idx: number) => {
        const grade = g.grade || "?";
        const gradeColor = grade === "S" ? "text-green-600 dark:text-green-400 bg-green-50  dark:bg-green-900/20" : grade === "A" ? "text-blue-600 dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20" : grade === "B" ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50  dark:bg-yellow-900/20" : grade === "C" ? "text-orange-600 dark:text-orange-400 bg-orange-50  dark:bg-orange-900/20" : grade === "F" || grade === "N" ? "text-red-600 dark:text-red-400 bg-red-50  dark:bg-red-900/20" : "text-gray-600 dark:text-gray-400 bg-gray-50  dark:bg-gray-800";
        result.push({
          id: `cur-grade-${g.courseCode}-${idx}`,
          label: `Current Grade: ${g.courseTitle} (${g.courseCode})`,
          description: `Total: ${g.grandTotal || "N/A"}`,
          icon: "📊",
          category: "Grades · Current Semester",
          rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${gradeColor}`}>{grade}</span>,
          detail: gradeDetail(g),
          onSelect: () => { setActiveTab("academics"); setActiveSubTab("grades"); }
        });
      });
    }

    // ── Registered Events & EventHub Events removed from main palette ──
    // Event search is handled by the dedicated EventSearchPalette subpage.

    // ── Exam Schedule ──
    const scheduleEntries = ScheduleData as Record<string, any[]>;
    if (scheduleEntries && typeof scheduleEntries === "object") {
      Object.entries(scheduleEntries).forEach(([key, exams]) => {
        if (!Array.isArray(exams)) return;
        exams.forEach((exam: any, idx: number) => {
          result.push({
            id: `exam-${key}-${idx}`,
            label: `📝 Exam: ${exam.courseCode || ""} ${exam.courseTitle || ""}`,
            description: `${exam.examDate || ""} · ${exam.examSession || ""} · ${exam.venue || ""}`,
            icon: "📝",
            category: "Exam Schedule",
            detail: (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${exam.examSession?.toLowerCase().includes("fn") ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"}`}>
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{exam.courseTitle}</p>
                    <p className="text-[11px] text-gray-500  dark:text-gray-400">{exam.courseCode}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {exam.examDate && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-violet-50  dark:bg-violet-900/10 text-violet-700  dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                      {exam.examDate}
                    </span>
                  )}
                  {exam.examSession && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${exam.examSession?.toLowerCase().includes("fn") ? "bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30" : "bg-blue-50  dark:bg-blue-900/10 text-blue-700  dark:text-blue-300 border-blue-200/50 dark:border-blue-800/30"}`}>
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                      {exam.examSession}
                    </span>
                  )}
                  {exam.venue && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-50  dark:bg-rose-900/10 text-rose-700  dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      {exam.venue}
                    </span>
                  )}
                  {exam.seatNo && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" /></svg>
                      Seat: {exam.seatNo}
                    </span>
                  )}
                </div>
                {exam.examTime && (
                  <div className="px-3 py-2 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30 flex items-center justify-between text-xs">
                    <span className="text-gray-500  dark:text-gray-400 font-medium">Exam Time</span>
                    <span className="font-bold text-gray-900  dark:text-white">{exam.examTime}</span>
                  </div>
                )}
              </div>
            ),
            onSelect: () => { setActiveTab("academics"); setActiveSubTab("course-dashboard"); }
          });
        });
      });
    }

    // ── Calendar Events ──
    const calData = Calender as any;
    if (calData?.results && Array.isArray(calData.results)) {
      calData.results.forEach((month: any) => {
        if (!month?.days) return;
        month.days.forEach((day: any) => {
          if (!day?.events) return;
          day.events.forEach((ev: any, ei: number) => {
            result.push({
              id: `cal-${month.month}-${day.date}-${ei}`,
              label: `📅 ${ev.text || "Calendar event"}`,
              description: `${day.date} ${month.month} ${month.year || ""} · ${ev.type || ""}`,
              icon: ev.type === "Holiday" ? "🎉" : ev.type === "Instructional Day" ? "📚" : "📌",
              category: "Academic Calendar",
              detail: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${ev.type === "Holiday" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : ev.type === "Instructional Day" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-purple-100 dark:bg-purple-900/30 text-purple-600"}`}>
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{ev.text}</p>
                      <p className="text-[11px] text-gray-500  dark:text-gray-400">{ev.type || "Event"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-violet-50  dark:bg-violet-900/10 text-violet-700  dark:text-violet-300 border border-violet-200/50 dark:border-violet-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                      {day.date} {month.month} {month.year || ""}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${ev.type === "Holiday" ? "bg-emerald-50  dark:bg-emerald-900/10 text-emerald-700  dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30" : ev.type === "Instructional Day" ? "bg-blue-50  dark:bg-blue-900/10 text-blue-700  dark:text-blue-300 border-blue-200/50 dark:border-blue-800/30" : "bg-purple-50  dark:bg-purple-900/10 text-purple-700  dark:text-purple-300 border-purple-200/50 dark:border-purple-800/30"}`}>
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                      {ev.type || "N/A"}
                    </span>
                    {ev.category && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" /><path d="M3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" /><path d="M14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>
                        {ev.category}
                      </span>
                    )}
                  </div>
                </div>
              ),
              onSelect: () => { setActiveTab("attendance"); setActiveAttendanceSubTab("calendar"); }
            });
          });
        });
      });
    }

    // ── Hostel Data ──
    const hData = hostelData as any;
    if (hData && Object.keys(hData).length > 0) {
      if (hData.blockName || hData.roomNo) {
        result.push({
          id: "hostel-info",
          label: `🏠 Hostel: ${hData.blockName || "N/A"} · Room ${hData.roomNo || "N/A"}`,
          description: `${hData.messInfo || ""}`,
          icon: "🏠",
          category: "Hostel",
          detail: (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl shrink-0 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{hData.blockName || "Hostel"}</p>
                  <p className="text-[11px] text-gray-500  dark:text-gray-400">Room {hData.roomNo || "N/A"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hData.blockName && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50  dark:bg-indigo-900/10 text-indigo-700  dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/30">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                    {hData.blockName}
                  </span>
                )}
                {hData.roomNo && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" /></svg>
                    Room {hData.roomNo}
                  </span>
                )}
                {hData.messInfo && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50  dark:bg-emerald-900/10 text-emerald-700  dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" /></svg>
                    {hData.messInfo}
                  </span>
                )}
              </div>
            </div>
          ),
          onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("mess"); }
        });
      }
      if (hData.leaveHistory || hData.leaves) {
        const leaves = hData.leaves || hData.leaveHistory || [];
        if (Array.isArray(leaves)) {
          leaves.forEach((l: any, i: number) => {
            result.push({
              id: `hostel-leave-${i}`,
              label: `✈️ Leave: ${l.reason || l.visitPlace || "Leave"}`,
              description: `${l.from || ""} → ${l.to || ""} · ${l.status || ""}`,
              icon: l.status === "Approved" ? "✅" : l.status === "Pending" ? "⏳" : "✈️",
              category: "Hostel · Leave",
              detail: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${l.status === "Approved" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : l.status === "Pending" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-red-100 dark:bg-red-900/30 text-red-600"}`}>
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{l.reason || l.visitPlace || "Leave"}</p>
                      <p className="text-[11px] text-gray-500  dark:text-gray-400">{l.from || ""} → {l.to || ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {l.reason && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50  dark:bg-indigo-900/10 text-indigo-700  dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                        {l.reason}
                      </span>
                    )}
                    {l.visitPlace && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-rose-50  dark:bg-rose-900/10 text-rose-700  dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                        {l.visitPlace}
                      </span>
                    )}
                    {l.status && (
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${l.status === "Approved" ? "bg-emerald-50  dark:bg-emerald-900/10 text-emerald-700  dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/30" : l.status === "Pending" ? "bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30" : "bg-red-50  dark:bg-red-900/10 text-red-700  dark:text-red-300 border-red-200/50 dark:border-red-800/30"}`}>
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        {l.status}
                      </span>
                    )}
                  </div>
                  {(l.from || l.to) && (
                    <div className="px-3 py-2 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500  dark:text-gray-400 font-medium">Duration</span>
                        <span className="font-bold text-gray-900  dark:text-white">{l.from || ""} → {l.to || ""}</span>
                      </div>
                    </div>
                  )}
                </div>
              ),
              onSelect: () => { setActiveTab("hostel"); setHostelActiveSubTab("leave"); }
            });
          });
        }
      }
    }

    // ── Moodle / LMS Assignments ──
    if (Array.isArray(moodleData) && moodleData.length > 0) {
      const pending = moodleData.filter((a: any) => !a.done);
      const completed = moodleData.filter((a: any) => a.done);
      if (pending.length > 0) {
        result.push({
          id: "moodle-summary",
          label: `📚 LMS: ${pending.length} pending assignment${pending.length !== 1 ? "s" : ""}`,
          description: `${completed.length} completed · ${moodleData.length} total`,
          icon: "📚",
          category: "LMS · Assignments",
          rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-orange-600  dark:text-orange-300 bg-orange-50  dark:bg-orange-900/20">{pending.length}</span>,
          onSelect: () => {}
        });
      }
      moodleData.forEach((a: any, i: number) => {
        const nameParts = (a.name || "").split("/");
        const shortName = nameParts.length >= 3 ? nameParts[2] : nameParts[nameParts.length - 1] || "Assignment";
        const courseCode = nameParts[0] || "";
        result.push({
          id: `moodle-${i}`,
          label: `${a.done ? "✅" : "📝"} ${shortName}`,
          description: `${courseCode} · Due: ${a.due || "N/A"}`,
          icon: a.done ? "✅" : "📝",
          category: `LMS · ${a.done ? "Completed" : "Pending"}`,
          rightSlot: a.due ? <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${a.done ? "text-green-600  dark:text-green-300 bg-green-50  dark:bg-green-900/20" : "text-yellow-600  dark:text-yellow-300 bg-yellow-50  dark:bg-yellow-900/20"}`}>{a.due}</span> : undefined,
          detail: (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${a.done ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"}`}>
                  <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{shortName}</p>
                  <p className="text-[11px] text-gray-500  dark:text-gray-400">{courseCode || ""}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {courseCode && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50  dark:bg-blue-900/10 text-blue-700  dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30">
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>
                    {courseCode}
                  </span>
                )}
                {a.due && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${a.done ? "bg-green-50  dark:bg-green-900/10 text-green-700  dark:text-green-300 border-green-200/50 dark:border-green-800/30" : "bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border-amber-200/50 dark:border-amber-800/30"}`}>
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                    Due: {a.due}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${a.done ? "bg-green-50  dark:bg-green-900/10 text-green-700  dark:text-green-300 border-green-200/50 dark:border-green-800/30" : "bg-orange-50  dark:bg-orange-900/10 text-orange-700  dark:text-orange-300 border-orange-200/50 dark:border-orange-800/30"}`}>
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  {a.done ? "Completed" : "Pending"}
                </span>
              </div>
              {a.teachers?.length > 0 && (
                <div className="px-3 py-2 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30 flex items-center justify-between text-xs">
                  <span className="text-gray-500  dark:text-gray-400 font-medium">Faculty</span>
                  <span className="font-bold text-gray-900  dark:text-white text-right truncate max-w-[60%]">{a.teachers.join(", ")}</span>
                </div>
              )}
            </div>
          ),
          onSelect: () => { if (a.url) window.open(a.url, "_blank"); }
        });
      });
    }

    try {
      const pagesRaw = localStorage.getItem("koha_patron_pages");
      if (pagesRaw) {
        const pages = JSON.parse(pagesRaw);
        // Charges / dues
        const chargesPage = pages.charges;
        if (chargesPage?.tables) {
          chargesPage.tables.forEach((table: any, ti: number) => {
            (table.rows || []).forEach((row: any[], ri: number) => {
              const gi = (i: string) => { const idx = (table.headers || []).indexOf(i); return idx >= 0 ? row[idx] || "" : ""; };
              const type = gi("Type");
              const desc = gi("Description");
              const amount = gi("Amount");
              const outstanding = gi("Amount outstanding");
              const created = gi("Created");
              const isFine = type?.toLowerCase().includes("fine");
              const paidOff = outstanding === "0.00";
              if (!type && !desc) return;
              result.push({
                id: `lib-charge-${ti}-${ri}`,
                label: `📚 ${isFine ? "Fine" : "Dues"}: ${desc || type || "Library charge"}`,
                description: `₹${parseFloat(amount || "0").toFixed(2)} · ${created || ""}`,
                icon: isFine ? "💰" : "📖",
                category: "Library · Dues & Charges",
                rightSlot: (
                  <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${paidOff ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"}`}>
                    {paidOff ? "Paid" : `₹${parseFloat(outstanding || amount || "0").toFixed(2)}`}
                  </span>
                ),
                detail: (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl shrink-0 ${paidOff ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-red-100 dark:bg-red-900/30 text-red-600"}`}>
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.51-1.31c-.562-.649-1.413-1.076-2.353-1.253V5z" clipRule="evenodd" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{desc || type || "Library charge"}</p>
                        <p className="text-[11px] text-gray-500  dark:text-gray-400">{type || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50  dark:bg-indigo-900/10 text-indigo-700  dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                        ₹{parseFloat(amount || "0").toFixed(2)}
                      </span>
                      {outstanding && (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border ${paidOff ? "bg-green-50  dark:bg-green-900/10 text-green-700  dark:text-green-300 border-green-200/50 dark:border-green-800/30" : "bg-red-50  dark:bg-red-900/10 text-red-700  dark:text-red-300 border-red-200/50 dark:border-red-800/30"}`}>
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                          O/s: ₹{parseFloat(outstanding).toFixed(2)}
                        </span>
                      )}
                      {created && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
                          {created}
                        </span>
                      )}
                    </div>
                  </div>
                ),
                onSelect: () => setActiveTab("libraries")
              });
            });
          });
        }
        // Checkouts (books currently checked out)
        const checkoutsPage = pages.checkouts;
        if (checkoutsPage?.tables) {
          checkoutsPage.tables.forEach((table: any, ti: number) => {
            (table.rows || []).forEach((row: any[], ri: number) => {
              const gi = (i: string) => { const idx = (table.headers || []).indexOf(i); return idx >= 0 ? row[idx] || "" : ""; };
              const title = gi("Title")?.replace(/\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+.*/, "") || "Untitled";
              const author = gi("Author");
              const date = gi("Date");
              const callNo = gi("Call number")?.replace(/^Call number:\s*/i, "");
              const itemType = gi("Item type")?.replace(/^Item type:\s*/i, "");
              result.push({
                id: `lib-checkout-${ti}-${ri}`,
                label: `📕 Checked out: ${title}`,
                description: author ? `by ${author}` : "",
                icon: "📚",
                category: "Library · Checked Out",
                detail: (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl shrink-0 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600">
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{title}</p>
                        {author && <p className="text-[11px] text-gray-500  dark:text-gray-400 truncate">by {author}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {callNo && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" /></svg>
                          {callNo}
                        </span>
                      )}
                      {itemType && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-purple-50  dark:bg-purple-900/10 text-purple-700  dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
                          {itemType}
                        </span>
                      )}
                      {date && !date.includes("Check-in") && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
                          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                          {date}
                        </span>
                      )}
                    </div>
                  </div>
                ),
                onSelect: () => setActiveTab("libraries")
              });
            });
          });
        }
      }
    } catch {}

    // ── Cached library due data ──
    try {
      const libDueRaw = localStorage.getItem("cache_library_due");
      if (libDueRaw) {
        const libDue = JSON.parse(libDueRaw);
        if (libDue?.success && libDue.books?.length > 0) {
          const totalDue = libDue.books.reduce((s: number, b: any) => s + parseFloat(b.dueAmount || "0"), 0);
          result.push({
            id: "lib-due-summary",
            label: `📚 Library Dues Summary`,
            description: `${libDue.books.length} book${libDue.books.length !== 1 ? "s" : ""} · Total: ₹${totalDue.toFixed(2)}`,
            icon: "💰",
            category: "Library · Dues & Charges",
            rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">₹{totalDue.toFixed(2)}</span>,
            onSelect: () => setActiveTab("libraries")
          });
          libDue.books.forEach((b: any, i: number) => {
            result.push({
              id: `lib-due-book-${i}`,
              label: `📖 Due: ${b.title || "Unknown"}`,
              description: `₹${parseFloat(b.dueAmount || "0").toFixed(2)} · ${b.author || ""}`,
              icon: "📖",
              category: "Library · Dues & Charges",
              rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">₹{parseFloat(b.dueAmount || "0").toFixed(2)}</span>,
              detail: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl shrink-0 bg-red-100 dark:bg-red-900/30 text-red-600">
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{b.title || "Unknown"}</p>
                      {b.author && <p className="text-[11px] text-gray-500  dark:text-gray-400 truncate">by {b.author}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.isbn && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /><path d="M2 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2z" /></svg>
                        ISBN: {b.isbn}
                      </span>
                    )}
                    {b.daysOverdue && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-50  dark:bg-red-900/10 text-red-700  dark:text-red-300 border border-red-200/50 dark:border-red-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        {b.daysOverdue} days overdue
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-50  dark:bg-red-900/10 text-red-700  dark:text-red-300 border border-red-200/50 dark:border-red-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      ₹{parseFloat(b.dueAmount || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              ),
              onSelect: () => setActiveTab("libraries")
            });
          });
        }
      }
    } catch {}

    // ── Profile data from localStorage ──
    try {
      const profileRaw = localStorage.getItem("profile");
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        if (p?.regNo) {
          result.push({
            id: "profile-regno",
            label: `👤 Profile: ${p.regNo}`,
            description: `${p.name || ""} · ${p.program || ""} · ${p.campus || ""}`,
            icon: "👤",
            category: "Profile",
            detail: (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{p.name || p.regNo}</p>
                    <p className="text-[11px] text-gray-500  dark:text-gray-400">{p.regNo}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {p.email && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-cyan-50  dark:bg-cyan-900/10 text-cyan-700  dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                      {p.email}
                    </span>
                  )}
                  {p.mobile && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50  dark:bg-emerald-900/10 text-emerald-700  dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>
                      {p.mobile}
                    </span>
                  )}
                  {p.program && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-purple-50  dark:bg-purple-900/10 text-purple-700  dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" /></svg>
                      {p.program}
                    </span>
                  )}
                  {p.campus && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-amber-50  dark:bg-amber-900/10 text-amber-700  dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30">
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                      {p.campus}
                    </span>
                  )}
                </div>
              </div>
            ),
            onSelect: () => setActiveTab("profile")
          });
        }
      }
    } catch {}

    // ── Bus routes from cache ──
    try {
      const busesRaw = localStorage.getItem("cache_buses");
      if (busesRaw) {
        const buses = JSON.parse(busesRaw);
        if (Array.isArray(buses)) {
          const routeLabels = new Set<string>();
          buses.forEach((b: any, i: number) => {
            const label = `${b.routeNo || b.route || b.name || `Route ${i + 1}`}`;
            if (routeLabels.has(label)) return;
            routeLabels.add(label);
            result.push({
              id: `bus-${i}`,
              label: `🚍 Bus: ${label}`,
              description: `${b.startPoint || ""} → ${b.endPoint || ""} · ${b.timing || ""}`,
              icon: "🚍",
              category: "Bus Routes",
              detail: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-600">
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" /></svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900  dark:text-white truncate">{label}</p>
                      <p className="text-[11px] text-gray-500  dark:text-gray-400">{b.timing || ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.startPoint && b.endPoint && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-50  dark:bg-blue-900/10 text-blue-700  dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        {b.startPoint} → {b.endPoint}
                      </span>
                    )}
                    {b.timing && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-gray-100  dark:bg-gray-900 text-gray-600  dark:text-gray-400 border border-gray-200/50  dark:border-gray-800/30">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                        {b.timing}
                      </span>
                    )}
                  </div>
                  {b.stops?.length > 0 && (
                    <div className="px-3 py-2 rounded-xl bg-gray-50/80  dark:bg-gray-900/40 border border-gray-200/50  dark:border-gray-800/30">
                      <p className="text-[10px] font-semibold text-gray-500  dark:text-gray-400 mb-1">Stops</p>
                      <p className="text-xs font-medium text-gray-900  dark:text-white">{b.stops.join(" · ")}</p>
                    </div>
                  )}
                </div>
              ),
              onSelect: () => { setActiveTab("dayscholar"); setActiveDayscholarSubTab("finder"); }
            });
          });
        }
      }
    } catch {}

    return result;
  }, [
    setActiveTab, setActiveSubTab, setHostelActiveSubTab, setActiveAttendanceSubTab,
    setActiveDayscholarSubTab, setActiveMoreSubTab, setActiveQBankSubTab,
    attendanceData, marksData, GradesData, AllGradesData, registeredEvents, eventHubEvents, ScheduleData, Calender, hostelData, moodleData, settings, config,
    ODhoursData, setODhoursIsOpen, setGradesDisplayIsOpen, setSettings, handleReloadRequest, handleLogOutRequest, theme, setTheme
  ]);

  const mergedCommands = useMemo(() => {
    const result = [...cmds];
    const hasKoha = paletteQuery.toLowerCase().indexOf("koha") !== -1;
    if (hasKoha) {
      const searchTerm = paletteQuery.slice(paletteQuery.toLowerCase().indexOf("koha") + 4).trim().replace(/^[:;,\\-s]+/, "");
      if (!searchTerm && !kohaLoading) {
        result.push({ id: "koha-prompt", label: "📖 Type after koha: to search the library catalog", description: "e.g. koha: harry potter", icon: "📖", category: "📚 Library Catalog", onSelect: () => {} });
      } else if (kohaLoading) {
        result.push({ id: "koha-loading", label: "🔍 Searching library catalog...", description: `Looking for "${searchTerm}"`, icon: "🔍", category: "📚 Library Catalog", onSelect: () => {} });
      } else if (searchTerm && kohaBooks.length === 0) {
        result.push({ id: "koha-none", label: "📭 No books found in library catalog", description: "Try different search terms after koha:", icon: "📭", category: "📚 Library Catalog", onSelect: () => {} });
      }
    }
    kohaBooks.forEach((book, i) => {
      result.push({
        id: `koha-${i}`,
        label: `📖 ${book.title || "Unknown Book"}`,
        description: book.author ? `by ${book.author}${book.publisher ? " · " + book.publisher : ""}` : book.publisher || "",
        icon: "📖",
        category: "📚 Library Catalog",
        rightSlot: book.isbn ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-blue-600  dark:text-blue-300 bg-blue-50  dark:bg-blue-900/20">ISBN</span> : undefined,
        detail: (
          <div className="flex gap-3 text-xs text-gray-600  dark:text-gray-400">
            {book.coverUrl && (
              <div className="shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gray-100  dark:bg-gray-900">
                <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-semibold text-sm text-gray-900  dark:text-gray-100 leading-tight">{book.title}</p>
              {book.author && <p className="italic">by {book.author}</p>}
              {book.publisher && <p className="truncate">{book.publisher}</p>}
              {book.isbn && <p>ISBN: {book.isbn}</p>}
              {book.biblionumber && <p className="text-blue-500 mt-1">Click to view details</p>}
            </div>
          </div>
        ),
        onSelect: () => { setActiveTab("libraries"); }
      });
    });
    return result;
  }, [cmds, paletteQuery, kohaBooks, kohaLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#03060F] transition-colors relative overflow-hidden">
        {/* Style block for linear loading bar animation */}
        <style>{`
          @keyframes loaderBar {
            0% { left: -35%; }
            100% { left: 100%; }
          }
          .animate-loaderBar {
            animation: loaderBar 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }
        `}</style>
        
        {/* Abstract background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 blur-[120px] rounded-full -z-10" />

        <div className="flex flex-col items-center space-y-6 max-w-xs text-center z-10">
          {/* Logo container */}
          <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xl animate-pulse">
            <img src="/logo.png" alt="AmazeCC Logo" className="w-14 h-14 object-contain" onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/icons/AmazeCC.png";
            }} />
            <div className="absolute -inset-1.5 rounded-[28px] border border-blue-500/20 animate-ping duration-3000 pointer-events-none" />
          </div>
          
          <div className="space-y-2 pt-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white font-[family-name:var(--font-outfit)]">AmazeCC</h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">Student Operating System</p>
          </div>

          {/* Sleek Progress Bar */}
          <div className="w-40 h-1 bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden relative shadow-inner">
            <div className="absolute top-0 bottom-0 left-0 w-[35%] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-loaderBar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50  dark:bg-black flex flex-col text-gray-900  dark:text-gray-100 transition-colors"
    >
      {isAPIworking && !isOffline && (
        <div className="top-0 left-0 w-full bg-yellow-500 text-black text-center py-2 font-medium">
          ⚠️ Unable to connect to API services. Please check back later. ⚠️
        </div>
      )}
      {showReloadBanner && (
        <SyncNotification
          message={message}
          progress={progressBar}
          active={isReloading}
          onDismiss={() => {
            setShowReloadBanner(false);
            if (isReloading) setIsReloading(false);
          }}
        />
      )}

      {(!isLoggedIn && !demoMode) && (
        <LoginForm
          username={IDs.VtopUsername}
          setUsername={(val: string) =>
            setIDs(prev => ({ ...prev, VtopUsername: val }))
          }
          password={IDs.VtopPassword}
          setPassword={(val: string) =>
            setIDs(prev => ({ ...prev, VtopPassword: val }))
          }
          message={message}
          handleFormSubmit={handleFormSubmit}
          handleDemoClick={handleDemoClick}
          residentialStatus={settings.residentialStatus || "hosteller"}
          setResidentialStatus={(val: "hosteller" | "dayscholar") => {
            setSettings(prev => ({ ...prev, residentialStatus: val }));
            localStorage.setItem("settings", JSON.stringify({ ...settings, residentialStatus: val }));
          }}
          isDayscholarWithBus={settings.isDayscholarWithBus || false}
          setIsDayscholarWithBus={(val: boolean) => {
            setSettings(prev => ({ ...prev, isDayscholarWithBus: val }));
            localStorage.setItem("settings", JSON.stringify({ ...settings, isDayscholarWithBus: val }));
          }}
        />
      )}

      {(isLoggedIn || demoMode) && (
        <>
          {isOffline && <div className="top-0 left-0 w-full bg-yellow-500 text-black text-center py-2 font-medium">
            ⚠️ You’re currently offline. Some features may not work.
          </div>}
          {demoMode && <div className="top-0 left-0 w-full bg-blue-500 text-white text-center py-2 font-medium">
            ℹ️ You are in Demo Mode. Data shown is for demonstration purposes only.
          </div>}
          <DashboardContent
            demoMode={demoMode}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            handleLogOutRequest={handleLogOutRequest}
            handleReloadRequest={handleReloadRequest}
            GradesData={GradesData}
            allGradesData={AllGradesData}
            attendancePercentage={attendancePercentage}
            ODhoursData={ODhoursData}
            ODhoursIsOpen={ODhoursIsOpen}
            setODhoursIsOpen={setODhoursIsOpen}
            GradesDisplayIsOpen={GradesDisplayIsOpen}
            setGradesDisplayIsOpen={setGradesDisplayIsOpen}
            attendanceData={attendanceData}
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            marksData={marksData}
            activeSubTab={activeSubTab}
            setActiveSubTab={setActiveSubTab}
            ScheduleData={ScheduleData}
            hostelData={hostelData}
            HostelActiveSubTab={HostelActiveSubTab}
            setHostelActiveSubTab={setHostelActiveSubTab}
            activeAttendanceSubTab={activeAttendanceSubTab}
            setActiveAttendanceSubTab={setActiveAttendanceSubTab}
            activeDayscholarSubTab={activeDayscholarSubTab}
            setActiveDayscholarSubTab={setActiveDayscholarSubTab}
            activeQBankSubTab={activeQBankSubTab}
            setActiveQBankSubTab={setActiveQBankSubTab}
            activeMoreSubTab={activeMoreSubTab}
            setActiveMoreSubTab={setActiveMoreSubTab}
            activeProfileSubTab={activeProfileSubTab}
            setActiveProfileSubTab={setActiveProfileSubTab}
            calendarData={Calender}
            setCalender={setCalender}
            setIsReloading={setIsReloading}
            setProgressBar={setProgressBar}
            setMessage={setMessage}
            loginToVTOP={loginToVTOP}
            setAllGradesData={setAllGradesData}
            sethostelData={sethostelData}
            setGradesData={setGradesData}
            setScheduleData={setScheduleData}
            handleLogin={handleLogin}
            moodleData={moodleData}
            setMoodleData={setMoodleData}
            IDs={IDs}
            setIDs={setIDs}
            registeredEvents={registeredEvents}
            setRegisteredEvents={setRegisteredEvents}
            vitolData={vitolData}
            setVitolData={setVitolData}
            settings={settings}
            setSettings={setSettings}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenShortcutsHelp={() => setIsShortcutsHelpOpen(true)}
          />
        </>
      )}
      {/* <div className="top-0 left-0 w-full bg-blue-500 text-white text-center py-2 font-medium">
        Scheduled maintenance on December 29, 2025 ( afternoon ). API services will be temporarily unavailable.
      </div> */}

      {!isLoggedIn && (
        <div className={`md:hidden ${demoMode ? 'pb-24' : 'pb-6'}`}>
          <LoginFooter />
        </div>
      )}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        commands={mergedCommands}
        onQueryChange={setPaletteQuery}
      />
      {isShortcutsHelpOpen && (
        <GlobalShortcutsModal onClose={() => setIsShortcutsHelpOpen(false)} />
      )}
    </motion.div>
  );
}

function GlobalShortcutsModal({ onClose }: { onClose: () => void }) {
  const categories = [
    {
      title: "Navigation",
      items: [
        { keys: ["Alt", "H"], desc: "Go to Home Tab" },
        { keys: ["Alt", "A"], desc: "Go to Attendance & Timetable" },
        { keys: ["Alt", "E"], desc: "Go to Event Hub" },
        { keys: ["Alt", "L"], desc: "Go to Koha Library Search" },
        { keys: ["Alt", "G"], desc: "Go to Academic Grades" },
        { keys: ["Alt", "S"], desc: "Go to Settings" },
      ]
    },
    {
      title: "Quick Tools & Actions",
      items: [
        { keys: ["Ctrl", "K"], desc: "Toggle Spotlight Command Palette" },
        { keys: ["Alt", "O"], desc: "Toggle On-Duty (OD) hours popup planner" },
        { keys: ["Alt", "B"], desc: "Toggle privacy blur filter (hides GPA)" },
        { keys: ["Alt", "T"], desc: "Toggle Theme (Light / Dark mode)" },
        { keys: ["?"], desc: "Show this keyboard shortcuts cheat-sheet" },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs pointer-events-auto">
      <div className="bg-white dark:bg-slate-950 rounded-2xl border border-gray-250 dark:border-gray-800 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scaleIn">
        <div className="p-4.5 border-b border-gray-150 dark:border-gray-800/80 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/30">
          <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" /> Keyboard Shortcuts
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-5">
          {categories.map((cat, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{cat.title}</h4>
              <div className="divide-y divide-gray-100 dark:divide-gray-850/40 border border-gray-150 dark:border-gray-800/80 rounded-xl overflow-hidden bg-white/40 dark:bg-slate-900/10">
                {cat.items.map((item, iIdx) => (
                  <div key={iIdx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <span key={kIdx} className="flex items-center gap-1">
                          {kIdx > 0 && <span className="text-[10px] text-gray-400 font-bold px-0.5">+</span>}
                          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-md font-mono text-[10px] font-bold text-gray-800 dark:text-gray-200 shadow-xs">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-3.5 border-t border-gray-150 dark:border-gray-800/80 bg-gray-50/50 dark:bg-slate-900/30 text-right">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Got it, thanks!
          </button>
        </div>
      </div>
    </div>
  );
}

function EventPreviewCard({ eid, username, password }: { eid: string; username: string; password: string }) {
  const [data, setData] = useState<{ imageSrc: string; description: string; metaDetails: Record<string, string> } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    fetch(`${API_BASE}/api/events/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, eid }),
      signal: controller.signal
    }).then(async r => { if (!r.ok) return null; return r.json(); }).then(j => {
      if (!cancelled) { setData(j); setLoading(false); }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [eid, username, password]);
  if (loading) return <div className="w-full h-20 rounded-xl bg-gray-100  dark:bg-gray-900 animate-pulse" />;
  if (!data?.imageSrc) return null;
  return (
    <div className="space-y-2">
      <img src={data.imageSrc} alt="" className="w-full h-28 object-cover rounded-xl" />
      {data.description && <p className="text-xs font-medium text-gray-900  dark:text-gray-100">{data.description}</p>}
      {data.metaDetails && Object.entries(data.metaDetails).map(([k, v]) => (
        <p key={k} className="text-xs text-gray-600  dark:text-gray-400"><span className="text-gray-400">{k}:</span> {v}</p>
      ))}
    </div>
  );
}
