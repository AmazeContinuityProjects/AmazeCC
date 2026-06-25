'use client';
import { useState, useEffect, useMemo } from "react";
import { ReloadModal } from "./reloadModel";
import LoginForm from "./loginForm";
import DashboardContent from "./Dashboard";
import LoginFooter from "./footer/LoginFooter";
import config from "../../../config.json";
import { attendanceRes, ODListItem, ODListRaw } from "@/types/data/attendance";
import { AllGradesRes } from "@/types/data/allgrades";
import { loadActivityTree, saveActivityTree } from "@/lib/activit-tree";
import demoData from '../../app/demoData.json';
import { AnimatePresence, motion } from "framer-motion";
import { syncMarksDiff } from "@/lib/marksSync";
import { CommandPalette } from "@/components/custom/shared";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";

const FETCH_TIMEOUT = 90000;

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
  friendlyName: ""
};

const defaultIDs: IDs = {
  VtopUsername: "",
  VtopPassword: "",
  MoodleUsername: "",
  MoodlePassword: "",
}

export default function LoginPage() {
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
  const [activeTab, setActiveTab] = useState<string>("attendance");
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
    }
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
    setIsLoggedIn((storedUsername && storedPassword) || (JSON.parse(IDs)?.VtopUsername && JSON.parse(IDs)?.VtopPassword) ? true : false);
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  let loginPromise: Promise<any> | null = null;

  const loginToVTOP = async (retry = false) => {
    if (loginPromise) return loginPromise;
    loginPromise = (async () => {
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
          loginPromise = null;
          return await loginToVTOP(true);
        }

        if (!data.success || !data.authorizedID || !data.cookies)
          throw new Error(data.message || "Login failed.");

        setMessage((prev) => prev + "\n✅ Login successful");
        setProgressBar((prev) => prev + 30);

        return {
          cookies: data.cookies,
          authorizedID: data.authorizedID,
          csrf: data.csrf,
        };
      } finally {
        loginPromise = null;
      }
    })();
    return loginPromise;
  };

  const handleLogin = async (currSemesterID = config.semesterIDs[config.semesterIDs.length - 2]) => {
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
      const bulkEndpoints = [
        "arrear-schedule", "arrear-details", "arrear-grade",
        "course-option-change", "exc-registration", "minor-honour", "course-completion",
        "wishlist", "additional-learning",
        "project", "project-course",
        "makeup-exam", "makeup-schedule", "compre-info",
        "hostel-counselling",
        "credentials", "registration-schedule", "dayboarder", "bank-info",
        "library-due",
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

  const fetchProfileData = async () => {
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const endpoints = [
        "ept-schedule", "registration-schedule", "bank-info",
        "dayboarder", "acknowledgement", "credentials",
      ];
      const results = await Promise.allSettled(
        endpoints.map(path =>
          fetch(`${API_BASE}/api/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cookies, authorizedID, csrf }),
          }).then(r => r.json())
        )
      );
      endpoints.forEach((path, i) => {
        if (results[i].status === "fulfilled") {
          localStorage.setItem(`cache_${path.replace(/-/g, "_")}`, JSON.stringify((results[i] as any).value));
        }
      });
      setMessage(prev => prev + "\n✅ Profile data fetched");
      setProgressBar(prev => prev + 10);
    } catch (err) {
      console.error("Failed to fetch profile data:", err);
    }
  };

  // --- Event Handlers ---
  const handleReloadRequest = async () => {
    setIsReloading(true);
    setProgressBar(10);
    setMessage("Reloading data...");
    localStorage.setItem("IDs", JSON.stringify(IDs));

    try {
      if ((settings as any).reloadAllData) {
        await handleLogin(settings.currSemesterID || config.semesterIDs[config.semesterIDs.length - 2]);
        await fetchTransportData();
        await fetchProfileData();
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
      tasks.push(fetchProfileData());

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
    handleLogin();
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
    let timer;

    if (isReloading) {
      setShowReloadBanner(true);
    } else {
      timer = setTimeout(() => {
        setShowReloadBanner(false);
      }, 500);
    }

    return () => clearTimeout(timer);
  }, [isReloading]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Dynamic palette search (KOHA catalog via "koha" prefix) ──
  useEffect(() => {
    if (!commandPaletteOpen) { setKohaBooks([]); setKohaLoading(false); return; }
    const lower = paletteQuery.toLowerCase();
    const kohaIdx = lower.indexOf("koha");
    if (kohaIdx === -1) { setKohaBooks([]); setKohaLoading(false); return; }
    const searchTerm = paletteQuery.slice(kohaIdx + 4).trim().replace(/^[:;,\-\s]+/, "");
    if (!searchTerm) { setKohaBooks([]); setKohaLoading(true); return; }
    setKohaLoading(true);
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
      const canMiss = t > 0 ? Math.max(0, Math.floor((a - 0.75 * t) / 0.75)) : 0;
      const needAttend = canMiss === 0 && t > 0 ? Math.ceil((0.75 * t - a) / 0.25) : 0;
      return (
        <div className="text-xs space-y-1.5">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.courseTitle}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400 midnight:text-gray-400">
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Code</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.courseCode}</span>
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Slot</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.slotName || course.slotVenue || "N/A"}</span>
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Attendance</span><span className={`font-bold ${parseFloat(p) >= 80 ? "text-green-600 dark:text-green-400 midnight:text-green-300" : parseFloat(p) >= 75 ? "text-yellow-600 dark:text-yellow-400 midnight:text-yellow-300" : "text-red-600 dark:text-red-400 midnight:text-red-300"}`}>{p}%</span>
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Classes</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{a}/{t}</span>
            {course.faculty && <><span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Faculty</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.faculty}</span></>}
          </div>
          {canMiss > 0 && <p className="text-green-600 dark:text-green-400 midnight:text-green-300 font-medium mt-1">✅ You can miss {canMiss} more class{canMiss > 1 ? "es" : ""}</p>}
          {needAttend > 0 && <p className="text-red-600 dark:text-red-400 midnight:text-red-300 font-medium mt-1">⚠️ Need to attend {needAttend} more to reach 75%</p>}
        </div>
      );
    };
    const markDetail = (course: any) => {
      const assessments = course.assessments || [];
      return (
        <div className="text-xs space-y-1.5">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.courseTitle}</p>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400 midnight:text-gray-400">
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Code</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.courseCode}</span>
            <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Type</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.courseType || "N/A"}</span>
            {course.credits && <><span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Credits</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{course.credits}</span></>}
          </div>
          {assessments.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-400 dark:text-gray-500 midnight:text-gray-500 font-semibold mb-1">Assessments ({assessments.length})</p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {assessments.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-gray-100/50 dark:bg-gray-800/40 midnight:bg-gray-800/50 text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                    <span className="truncate mr-2">{a.name || `Assessment ${i + 1}`}</span>
                    <span className="font-medium shrink-0 text-gray-900 dark:text-gray-100 midnight:text-gray-100">{a.scoredMark || "?"}/{a.maxMark || "?"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    };
    const gradeDetail = (g: any) => (
      <div className="text-xs space-y-1.5">
        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100">{g.courseTitle}</p>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-gray-600 dark:text-gray-400 midnight:text-gray-400">
          <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Code</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{g.courseCode}</span>
          <span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Grade</span><span className="font-bold text-lg text-gray-900 dark:text-gray-100 midnight:text-gray-100">{g.grade || "N/A"}</span>
          {g.grandTotal && <><span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Total</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{g.grandTotal}</span></>}
          {g.courseType && <><span className="text-gray-400 dark:text-gray-500 midnight:text-gray-500">Type</span><span className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{g.courseType}</span></>}
        </div>
      </div>
    );

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
      { id: "acad-timetable", label: "Timetable & Schedule", description: "Exam schedule & timetable", icon: "🗓️", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("timetable"); } },
      { id: "acad-grades", label: "Grade History", description: "All semester grades & CGPA", icon: "🎓", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("grades"); } },
      { id: "acad-gpa-predictor", label: "GPA Predictor", description: "Predict your GPA for this semester", icon: "📈", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("gpa"); } },
      { id: "acad-course-dashboard", label: "Course Dashboard", description: "Detailed per-course view", icon: "📘", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("course-dashboard"); } },
      { id: "acad-circulars", label: "Academic Circulars", description: "View academic circulars & notices", icon: "📢", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("circulars"); } },
      { id: "acad-faculty", label: "Faculty Info", description: "Faculty contact & information", icon: "👨‍🏫", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("faculty"); } },
      { id: "acad-qcm", label: "QCM View", description: "Question category mapping view", icon: "📝", category: "Academics", onSelect: () => { setActiveTab("academics"); setActiveSubTab("qcm"); } },
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
      { id: "qbank-archive", label: "Question Bank Archive", description: "Previous year question papers", icon: "📄", category: "QBank", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("qbank"); setActiveQBankSubTab("archive"); } },
      { id: "qbank-pure", label: "Pure QBank", description: "Subject-wise question banks", icon: "❓", category: "QBank", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("qbank"); setActiveQBankSubTab("pure"); } },
      { id: "more-social", label: "Social & Schedules", description: "Events, friends & schedules", icon: "👥", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("social"); } },
      { id: "more-events", label: "Events Hub", description: "Registered events & activities", icon: "🎉", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("events"); } },
      { id: "more-schedules", label: "My Schedules", description: "Personal schedules & plans", icon: "🗓️", category: "More", onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("schedules"); } },
    );

    // ── Tools & Modals ──
    result.push(
      { id: "tool-od-hours", label: "OD Hours Display", description: "View on-duty hours breakdown", icon: "⏰", category: "Tools", onSelect: () => setODhoursIsOpen(true) },
      { id: "tool-grades-modal", label: "Grades Details Modal", description: "Open detailed grade breakdown", icon: "📊", category: "Tools", onSelect: () => setGradesDisplayIsOpen(true) },
      { id: "tool-gpa-predictor", label: "GPA Predictor Tool", description: "Calculate and predict your GPA", icon: "🔮", category: "Tools", onSelect: () => { setActiveTab("academics"); setActiveSubTab("gpa"); } },
      { id: "tool-feedback-status", label: "Feedback Status", description: "Check course feedback submission status", icon: "💬", category: "Tools", onSelect: () => setActiveTab("profile") },
      { id: "tool-reload", label: "Reload All Data", description: "Refresh all data from VTOP", icon: "🔄", category: "Tools", onSelect: () => handleReloadRequest() },
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
        rightSlot: <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${current ? "text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : "text-gray-500 dark:text-gray-400 midnight:text-gray-400 bg-gray-100 dark:bg-gray-800 midnight:bg-gray-800"}`}>{current ? "ON" : "OFF"}</span>,
        onSelect: () => {
          const newVal = !current as any;
          setSettings(prev => ({ ...prev, [key]: newVal }));
          localStorage.setItem("settings", JSON.stringify({ ...settings, [key]: newVal }));
        }
      });
    };
    toggle("Decimal Values in Attendance", "decimalValues", "Settings", "🔢");
    toggle("Hide CGPA", "CGPAHidden", "Settings", "🙈");
    toggle("Loading Screen Animation", "loadingScreen", "Settings", "🎬");
    toggle("Dayscholar Bus Mode", "isDayscholarWithBus", "Settings", "🚌");

    // ── Settings: Attendance Display Mode ──
    ["percentage", "str"].forEach(mode => {
      result.push({
        id: `setting-att-display-${mode}`,
        label: `Show Attendance as ${mode === "percentage" ? "Percentage" : "Fraction (X/Y)"}`,
        description: settings.attendancePercentageOrString === mode ? "Currently active" : "Switch to this display mode",
        icon: mode === "percentage" ? "📊" : "📏",
        category: "Settings",
        rightSlot: settings.attendancePercentageOrString === mode ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20">Active</span> : undefined,
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
        rightSlot: settings.residentialStatus === status ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20">Active</span> : undefined,
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
        rightSlot: settings.calendarType === ct ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20">Active</span> : undefined,
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
          rightSlot: settings.currSemesterID === sem ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20">Active</span> : undefined,
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
        const percColor = percNum >= 80 ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : percNum >= 75 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20";
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
          const newColor = newPerc >= 75 ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20";
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
            rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20">🎯 75%</span>,
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
      const overallColor = parseFloat(overallPerc) >= 80 ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : parseFloat(overallPerc) >= 75 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20";
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
          rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20">{p}%</span>,
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
        const scoreColor = scorePerc >= 80 ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : scorePerc >= 60 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20";
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
          const gradeColor = grade === "S" ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : grade === "A" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20" : grade === "B" ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20" : grade === "C" ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 midnight:bg-orange-900/20" : grade === "F" || grade === "N" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20" : "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 midnight:bg-gray-800";
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
        const gradeColor = grade === "S" ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : grade === "A" ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20" : grade === "B" ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20" : grade === "C" ? "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 midnight:bg-orange-900/20" : grade === "F" || grade === "N" ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20" : "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 midnight:bg-gray-800";
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

    // ── Registered Events ──
    if (Array.isArray(registeredEvents)) {
      registeredEvents.forEach((ev, idx) => {
        const posterUrl = ev.poster || ev.image || ev.coverUrl || "";
        result.push({
          id: `event-${idx}`,
          label: `Event: ${ev.name || ev.title || "Untitled"}`,
          description: `${ev.date || ""} · ${ev.time || ""} · ${ev.venue || ""}`,
          icon: "🎉",
          category: "Events",
          detail: (
            <div className="space-y-2">
              {posterUrl ? (
                <img src={posterUrl} alt="" className="w-full h-28 object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-full h-20 rounded-xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <span className="text-3xl">🎉</span>
                </div>
              )}
              <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1">
                {ev.description && <p className="font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{ev.description}</p>}
                {ev.date && <p>📅 {ev.date}{ev.time ? ` · ${ev.time}` : ""}</p>}
                {ev.venue && <p>📍 {ev.venue}</p>}
                {ev.paymentStatus && <p>💰 {ev.paymentStatus}</p>}
              </div>
            </div>
          ),
          onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("events"); }
        });
      });
    }

    // ── EventHub Events (with poster preview) ──
    if (Array.isArray(eventHubEvents)) {
      eventHubEvents.forEach((ev: any, idx: number) => {
        result.push({
          id: `eh-event-${idx}`,
          label: `🎪 ${ev.title || ev.name || "Untitled Event"}`,
          description: `${ev.date || ""} · ${ev.location || ev.venue || ""} · ${ev.price || ev.type || ""}`,
          icon: "🎪",
          category: "EventHub · Discover",
          rightSlot: ev.price ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 midnight:text-purple-300 bg-purple-50 dark:bg-purple-900/20 midnight:bg-purple-900/20">{ev.price}</span> : undefined,
          detail: ev.eid ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{ev.title}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400">{ev.eligibility || ev.type || ""}</p>
            </div>
          ) : undefined,
          onSelect: () => { setActiveTab("more"); setActiveMoreSubTab("events"); }
        });
      });
    }

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
              <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100">{exam.courseTitle}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-gray-400">Code</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.courseCode}</span>
                  <span className="text-gray-400">Date</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.examDate}</span>
                  <span className="text-gray-400">Session</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.examSession}</span>
                  {exam.examTime && <><span className="text-gray-400">Time</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.examTime}</span></>}
                  {exam.venue && <><span className="text-gray-400">Venue</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.venue}</span></>}
                  {exam.seatNo && <><span className="text-gray-400">Seat</span><span className="font-medium text-gray-900 dark:text-gray-100">{exam.seatNo}</span></>}
                </div>
              </div>
            ),
            onSelect: () => { setActiveTab("academics"); setActiveSubTab("timetable"); }
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
                <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm">{ev.text}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-gray-400">Date</span><span className="font-medium text-gray-900 dark:text-gray-100">{day.date} {month.month} {month.year || ""}</span>
                    <span className="text-gray-400">Type</span><span className="font-medium text-gray-900 dark:text-gray-100">{ev.type || "N/A"}</span>
                    {ev.category && <><span className="text-gray-400">Category</span><span className="font-medium text-gray-900 dark:text-gray-100">{ev.category}</span></>}
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
            <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {hData.blockName && <><span className="text-gray-400">Block</span><span className="font-medium text-gray-900 dark:text-gray-100">{hData.blockName}</span></>}
                {hData.roomNo && <><span className="text-gray-400">Room</span><span className="font-medium text-gray-900 dark:text-gray-100">{hData.roomNo}</span></>}
                {hData.messInfo && <><span className="text-gray-400">Mess</span><span className="font-medium text-gray-900 dark:text-gray-100">{hData.messInfo}</span></>}
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
                <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {l.reason && <><span className="text-gray-400">Reason</span><span className="font-medium text-gray-900 dark:text-gray-100">{l.reason}</span></>}
                    {l.visitPlace && <><span className="text-gray-400">Place</span><span className="font-medium text-gray-900 dark:text-gray-100">{l.visitPlace}</span></>}
                    {l.from && <><span className="text-gray-400">From</span><span className="font-medium text-gray-900 dark:text-gray-100">{l.from}</span></>}
                    {l.to && <><span className="text-gray-400">To</span><span className="font-medium text-gray-900 dark:text-gray-100">{l.to}</span></>}
                    {l.status && <><span className="text-gray-400">Status</span><span className={`font-medium ${l.status === "Approved" ? "text-green-600" : l.status === "Pending" ? "text-yellow-600" : "text-red-600"}`}>{l.status}</span></>}
                  </div>
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
          rightSlot: <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 midnight:text-orange-300 bg-orange-50 dark:bg-orange-900/20 midnight:bg-orange-900/20">{pending.length}</span>,
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
          rightSlot: a.due ? <span className={`inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold ${a.done ? "text-green-600 dark:text-green-400 midnight:text-green-300 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20" : "text-yellow-600 dark:text-yellow-400 midnight:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20"}`}>{a.due}</span> : undefined,
          detail: (
            <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100">{shortName}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {courseCode && <><span className="text-gray-400">Course</span><span className="font-medium text-gray-900 dark:text-gray-100">{courseCode}</span></>}
                {a.due && <><span className="text-gray-400">Due</span><span className="font-medium text-gray-900 dark:text-gray-100">{a.due}</span></>}
                <span className="text-gray-400">Status</span><span className={`font-medium ${a.done ? "text-green-600" : "text-orange-600"}`}>{a.done ? "Completed" : "Pending"}</span>
                {a.teachers?.length > 0 && <><span className="text-gray-400">Faculty</span><span className="font-medium text-gray-900 dark:text-gray-100">{a.teachers.join(", ")}</span></>}
              </div>
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
                  <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span className="text-gray-400">Type</span><span className="font-medium text-gray-900 dark:text-gray-100">{type || "N/A"}</span>
                      {desc && <><span className="text-gray-400">Description</span><span className="font-medium text-gray-900 dark:text-gray-100">{desc}</span></>}
                      <span className="text-gray-400">Amount</span><span className="font-medium text-gray-900 dark:text-gray-100">₹{parseFloat(amount || "0").toFixed(2)}</span>
                      {outstanding && <><span className="text-gray-400">Outstanding</span><span className={`font-medium ${paidOff ? "text-green-600" : "text-red-600"}`}>₹{parseFloat(outstanding).toFixed(2)}</span></>}
                      {created && <><span className="text-gray-400">Created</span><span className="font-medium text-gray-900 dark:text-gray-100">{created}</span></>}
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
                  <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{title}</p>
                    {author && <p className="italic">by {author}</p>}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
                      {callNo && <><span className="text-gray-400">Call No</span><span className="font-medium text-gray-900 dark:text-gray-100">{callNo}</span></>}
                      {itemType && <><span className="text-gray-400">Type</span><span className="font-medium text-gray-900 dark:text-gray-100">{itemType}</span></>}
                      {date && !date.includes("Check-in") && <><span className="text-gray-400">Date</span><span className="font-medium text-gray-900 dark:text-gray-100">{date}</span></>}
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
                <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{b.title}</p>
                  {b.author && <p>by {b.author}</p>}
                  {b.isbn && <p>ISBN: {b.isbn}</p>}
                  {b.daysOverdue ? <p className="text-red-500 font-medium">⏰ {b.daysOverdue} days overdue</p> : null}
                  <p className="font-bold text-red-600">Due: ₹{parseFloat(b.dueAmount || "0").toFixed(2)}</p>
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
              <div className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400 space-y-1.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {p.name && <><span className="text-gray-400">Name</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.name}</span></>}
                  {p.regNo && <><span className="text-gray-400">Reg No</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.regNo}</span></>}
                  {p.email && <><span className="text-gray-400">Email</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.email}</span></>}
                  {p.mobile && <><span className="text-gray-400">Mobile</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.mobile}</span></>}
                  {p.program && <><span className="text-gray-400">Program</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.program}</span></>}
                  {p.campus && <><span className="text-gray-400">Campus</span><span className="font-medium text-gray-900 dark:text-gray-100">{p.campus}</span></>}
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
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                  {b.startPoint && b.endPoint && <p>📍 {b.startPoint} → {b.endPoint}</p>}
                  {b.timing && <p>🕐 {b.timing}</p>}
                  {b.stops?.length > 0 && <p className="text-gray-400 mt-1">Stops: {b.stops.join(", ")}</p>}
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
    ODhoursData, setODhoursIsOpen, setGradesDisplayIsOpen, setSettings, handleReloadRequest, handleLogOutRequest
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
        rightSlot: book.isbn ? <span className="inline-flex items-center justify-center min-w-[3.25rem] h-9 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 midnight:text-blue-300 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/20">ISBN</span> : undefined,
        detail: (
          <div className="flex gap-3 text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400">
            {book.coverUrl && (
              <div className="shrink-0 w-20 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900">
                <img src={book.coverUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 leading-tight">{book.title}</p>
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 midnight:bg-black">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-gray-500"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading app...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 midnight:bg-black flex flex-col text-gray-900 dark:text-gray-100 midnight:text-gray-100 transition-colors"
    >
      {isAPIworking && !isOffline && (
        <div className="top-0 left-0 w-full bg-yellow-500 text-black text-center py-2 font-medium">
          ⚠️ Unable to connect to API services. Please check back later. ⚠️
        </div>
      )}
      <motion.div layout>
        <AnimatePresence>
          {showReloadBanner && (
            settings.loadingScreen ? (
              <ReloadModal
                message={message}
                onClose={() => setIsReloading(false)}
                progressBar={progressBar}
              />
            ) : (
              <motion.div
                layout
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full z-50 bg-blue-500 text-white shadow-lg"
              >
                <div className="flex flex-col items-center justify-center py-2 px-4 text-sm font-medium">
                  <span className="whitespace-pre-wrap">{message}</span>

                  {progressBar !== undefined && (
                    <div className="w-full max-w-xl mt-2 h-2 bg-blue-300/40 rounded overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progressBar}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full bg-blue-100"
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </motion.div>

      {(!isLoggedIn && !demoMode) && (
        <div className="flex-grow flex items-center justify-center p-4">
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
            progressBar={progressBar}
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
        </div>
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
    </motion.div>
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
  if (loading) return <div className="w-full h-20 rounded-xl bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 animate-pulse" />;
  if (!data?.imageSrc) return null;
  return (
    <div className="space-y-2">
      <img src={data.imageSrc} alt="" className="w-full h-28 object-cover rounded-xl" />
      {data.description && <p className="text-xs font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{data.description}</p>}
      {data.metaDetails && Object.entries(data.metaDetails).map(([k, v]) => (
        <p key={k} className="text-xs text-gray-600 dark:text-gray-400 midnight:text-gray-400"><span className="text-gray-400">{k}:</span> {v}</p>
      ))}
    </div>
  );
}
