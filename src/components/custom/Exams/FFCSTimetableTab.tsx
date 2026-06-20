"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { PlusCircle, Trash2, AlertTriangle, Info, UploadCloud, Map as MapIcon, Download, Plus, Edit2, Check, Maximize2, Minimize2, Copy, Save, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import * as htmlToImage from "html-to-image";
import { useTheme } from "next-themes";

import timetableSchema from "@/app/data/chennai.json";

// Types
type SlotMap = {
  [day: string]: string;
};

type TimetablePeriod = {
  start?: string;
  end?: string;
  lunch?: boolean;
  days?: SlotMap;
};

type ParsedCourse = {
  CODE: string;
  TITLE: string;
  TYPE: string;
  CREDITS: string;
  ROOM: string;
  SLOT: string;
  FACULTY: string;
};

type AddedCourse = {
  id: string;
  code: string;
  title: string;
  slots: string[];
  faculty: string;
  venue: string;
  credits: string;
  type: string;
  color: string;
};

type TimetableState = {
  id: string;
  name: string;
  courses: AddedCourse[];
};

const DAYS = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

const COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-red-500", 
  "bg-yellow-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500"
];

// Helper to convert time strings (e.g., "8:00 AM", "12:35 PM") to minutes from midnight
const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const isMorningTheory = (slot: string) => {
  const main = slot.split('+')[0];
  return main.includes('1');
};

const isEveningTheory = (slot: string) => {
  const main = slot.split('+')[0];
  return main.includes('2');
};

const isMorningLab = (slot: string) => {
  const main = slot.split('+')[0];
  if (main.startsWith('L')) {
    const num = parseInt(main.replace('L', ''), 10);
    if (isNaN(num)) return false;
    
    if (num <= 30) {
      const periodIndex = ((num - 1) % 6) + 1;
      if (periodIndex <= 4) return true; // 8:00 AM to 11:30 AM
    } else {
      const periodIndex = ((num - 31) % 6) + 1;
      if (periodIndex >= 5) return true; // After 5:40 PM
    }
  }
  return false;
};

const isEveningLab = (slot: string) => {
  const main = slot.split('+')[0];
  if (main.startsWith('L')) {
    const num = parseInt(main.replace('L', ''), 10);
    if (isNaN(num)) return false;

    if (num <= 30) {
      const periodIndex = ((num - 1) % 6) + 1;
      if (periodIndex >= 5) return true; // After 11:40 AM
    } else {
      const periodIndex = ((num - 31) % 6) + 1;
      if (periodIndex <= 4) return true; // 2:00 PM to 5:30 PM
    }
  }
  return false;
};

const processParsedCourses = (parsed: ParsedCourse[]): ParsedCourse[] => {
  // 1. Fix credits
  parsed.forEach(c => {
    if (c.TYPE.toLowerCase().includes('embedded')) {
      const creditsVal = parseFloat(c.CREDITS) || 0;
      if (c.SLOT.startsWith('L')) {
        if (c.SLOT.split('+').length === 2) {
          c.CREDITS = "1.0";
        }
      } else {
        if (creditsVal > 1 && creditsVal <= 4) { // typical logic: embedded courses with >1 credits, deduct 1 for lab
          c.CREDITS = String(creditsVal - 1.0);
        }
      }
    }
  });

  // 2. Combine embedded theory and lab
  const combined: ParsedCourse[] = [];
  const byCode = new Map<string, ParsedCourse[]>();
  parsed.forEach(c => {
    if (!byCode.has(c.CODE)) byCode.set(c.CODE, []);
    byCode.get(c.CODE)!.push(c);
  });

  byCode.forEach((coursesList) => {
    const type = coursesList[0].TYPE;
    if (type.toLowerCase().includes('embedded theory / embedded lab') || type.toLowerCase().includes('embedded')) {
      const byFac = new Map<string, ParsedCourse[]>();
      coursesList.forEach(c => {
        if (!byFac.has(c.FACULTY)) byFac.set(c.FACULTY, []);
        byFac.get(c.FACULTY)!.push(c);
      });

      byFac.forEach((facCourses) => {
        const theorySlots = facCourses.filter(c => !c.SLOT.startsWith('L'));
        const labSlots = facCourses.filter(c => c.SLOT.startsWith('L'));

        if (theorySlots.length === labSlots.length && theorySlots.length > 0) {
          const matched = new Set<number>();
          const matchedLabs = new Set<number>();
          const tempCombined: ParsedCourse[] = [];

          for (let i = 0; i < theorySlots.length; i++) {
            const t = theorySlots[i];
            const isMT = isMorningTheory(t.SLOT);
            const isET = isEveningTheory(t.SLOT);

            let matchIdx = -1;
            for (let j = 0; j < labSlots.length; j++) {
              if (matchedLabs.has(j)) continue;
              const l = labSlots[j];
              const isML = isMorningLab(l.SLOT);
              const isEL = isEveningLab(l.SLOT);

              if ((isMT && isEL) || (isET && isML)) {
                matchIdx = j;
                break;
              }
            }

            if (matchIdx !== -1) {
              matched.add(i);
              matchedLabs.add(matchIdx);
              const l = labSlots[matchIdx];
              tempCombined.push({
                ...t,
                CREDITS: String(parseFloat(t.CREDITS || "0") + parseFloat(l.CREDITS || "0")),
                SLOT: `${t.SLOT} + ${l.SLOT}`,
                ROOM: `${t.ROOM} / ${l.ROOM}`
              });
            }
          }

          if (matched.size === theorySlots.length) {
            combined.push(...tempCombined);
          } else {
            combined.push(...facCourses);
          }
        } else {
          combined.push(...facCourses);
        }
      });
    } else {
      combined.push(...coursesList);
    }
  });

  return combined;
};

export default function FFCSTimetableTab() {
  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";
  const isMidnight = currentTheme === "midnight";
  const isDark = currentTheme === "dark" || isMidnight;
  const themeBgColor = isMidnight ? "#020617" : isDark ? "#0f172a" : "#ffffff";
  const themeTextColor = isDark ? "#ffffff" : "#000000";
  const themeHtmlClass = isMidnight ? "dark midnight" : isDark ? "dark" : "light";

  const [masterCourses, setMasterCourses] = useState<ParsedCourse[]>([]);
  const [rawParsedCourses, setRawParsedCourses] = useState<ParsedCourse[]>([]);
  const [isGroupingEnabled, setIsGroupingEnabled] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  
  // Timetables State
  const [timetables, setTimetables] = useState<TimetableState[]>([
    { id: "default", name: "Timetable 1", courses: [] }
  ]);
  const [activeTimetableId, setActiveTimetableId] = useState<string>("default");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const activeTimetable = timetables.find(t => t.id === activeTimetableId) || timetables[0];
  const courses = activeTimetable.courses;
  
  // Selection states
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState("-1");
  const [slotFilter, setSlotFilter] = useState("all");
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);
  const pdfCaptureRef = useRef<HTMLDivElement>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedRaw = localStorage.getItem("ffcs_raw_courses");
    if (savedRaw) setRawParsedCourses(JSON.parse(savedRaw));

    const savedTimetables = localStorage.getItem("ffcs_timetables");
    if (savedTimetables) {
      const parsed = JSON.parse(savedTimetables);
      if (parsed && parsed.length > 0) {
        setTimetables(parsed);
        setActiveTimetableId(parsed[0].id);
      }
    }
    setIsLoaded(true);
  }, []);

  // Compute masterCourses whenever rawParsedCourses or isGroupingEnabled changes
  useEffect(() => {
    if (rawParsedCourses.length > 0) {
      if (isGroupingEnabled) {
        setMasterCourses(processParsedCourses(rawParsedCourses));
      } else {
        // Just the credit fix, no grouping
        const copy = JSON.parse(JSON.stringify(rawParsedCourses)) as ParsedCourse[];
        copy.forEach(c => {
          if (c.TYPE.toLowerCase().includes('embedded')) {
            const creditsVal = parseFloat(c.CREDITS) || 0;
            if (c.SLOT.startsWith('L')) {
              if (c.SLOT.split('+').length === 2) {
                c.CREDITS = "1.0";
              }
            } else {
              if (creditsVal > 1 && creditsVal <= 4) {
                c.CREDITS = String(creditsVal - 1.0);
              }
            }
          }
        });
        setMasterCourses(copy);
      }
    } else {
      setMasterCourses([]);
    }
  }, [rawParsedCourses, isGroupingEnabled]);

  // Save to local storage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_raw_courses", JSON.stringify(rawParsedCourses));
    }
  }, [rawParsedCourses, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("ffcs_timetables", JSON.stringify(timetables));
    }
  }, [timetables, isLoaded]);

  const updateActiveTimetableCourses = (newCourses: AddedCourse[]) => {
    setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, courses: newCourses } : t));
  };

  const theoryPeriods = (timetableSchema.theory as TimetablePeriod[]).filter(p => !p.lunch);
  const labPeriods = (timetableSchema.lab as TimetablePeriod[]).filter(p => !p.lunch);
  const allPeriods = [...theoryPeriods, ...labPeriods];

  const getPeriodsForSlot = (slotName: string) => {
    const matchedPeriods: { day: string, startMin: number, endMin: number, type: 'theory' | 'lab', pIdx: number }[] = [];
    
    theoryPeriods.forEach((p, pIdx) => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        if (s === slotName) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string), type: 'theory', pIdx });
        }
      });
    });

    labPeriods.forEach((p, pIdx) => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        if (s === slotName) {
          matchedPeriods.push({ day, startMin: timeToMinutes(p.start as string), endMin: timeToMinutes(p.end as string), type: 'lab', pIdx });
        }
      });
    });
    
    return matchedPeriods;
  };

  const checkClashes = (newSlots: string[]) => {
    for (const slot of newSlots) {
      if (blockedSlots.has(slot)) {
        return `Slot ${slot} is blocked.`;
      }
    }

    const newPeriods = newSlots.flatMap(getPeriodsForSlot);

    for (const existingCourse of courses) {
      const existingPeriods = existingCourse.slots.flatMap(getPeriodsForSlot);
      
      for (const np of newPeriods) {
        for (const ep of existingPeriods) {
          if (np.day === ep.day) {
            if (Math.max(np.startMin, ep.startMin) < Math.min(np.endMin, ep.endMin)) {
              return `Time clash on ${np.day.toUpperCase()} between new slot and ${existingCourse.code} (${existingCourse.slots.join("+")})`;
            }
          }
        }
      }
    }
    return null;
  };

  const getCourseForSlot = (slotName: string) => {
    return courses.find(c => c.slots.includes(slotName));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length === 0) {
          setError("The uploaded file is empty.");
          return;
        }

        let parsed: ParsedCourse[] = data.map((row: any) => ({
          CODE: row.CODE || row["COURSE CODE"] || row.Code || "",
          TITLE: row.TITLE || row["COURSE TITLE"] || row.Title || "",
          TYPE: row.TYPE || row.Type || "",
          CREDITS: row.CREDITS || row.Credits || "0",
          ROOM: row.VENUE || row.ROOM || row.Room || row.Venue || "",
          SLOT: row.SLOT || row.Slot || "",
          FACULTY: row.FACULTY || row.Faculty || ""
        })).filter(c => c.CODE);

        setRawParsedCourses(parsed);
        setSuccessMsg(`Successfully loaded ${parsed.length} slots from Excel.`);
      } catch (err) {
        setError("Error parsing the file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleClearMaster = () => {
    if (confirm("Are you sure you want to clear the uploaded course list?")) {
      setMasterCourses([]);
      setSelectedCourseCode("");
      setSelectedSlotIndex("-1");
      setSuccessMsg(null);
    }
  };

  const handleClearTimetable = () => {
    if (confirm(`Are you sure you want to clear ${activeTimetable.name}?`)) {
      updateActiveTimetableCourses([]);
    }
  };

  const createNewTimetable = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newName = `Timetable ${timetables.length + 1}`;
    setTimetables([...timetables, { id: newId, name: newName, courses: [] }]);
    setActiveTimetableId(newId);
  };

  const duplicateTimetable = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    const newName = `${activeTimetable.name} (Copy)`;
    setTimetables([...timetables, { id: newId, name: newName, courses: [...activeTimetable.courses] }]);
    setActiveTimetableId(newId);
  };

  const deleteTimetable = (id: string) => {
    if (timetables.length <= 1) {
      setError("You must have at least one timetable.");
      return;
    }
    if (confirm("Are you sure you want to delete this timetable?")) {
      const newTimetables = timetables.filter(t => t.id !== id);
      setTimetables(newTimetables);
      if (activeTimetableId === id) {
        setActiveTimetableId(newTimetables[0].id);
      }
    }
  };

  const exportTimetables = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(timetables));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "amazecc_timetables.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    setSuccessMsg("Timetable configs exported successfully!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const importTimetables = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && Array.isArray(parsed[0].courses)) {
          setTimetables(parsed);
          setActiveTimetableId(parsed[0].id);
          setSuccessMsg("Timetable configs imported successfully!");
          setTimeout(() => setSuccessMsg(null), 3000);
        } else {
          setError("Invalid config format.");
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        setError("Failed to parse config file.");
        setTimeout(() => setError(null), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRenameSubmit = () => {
    if (editNameValue.trim()) {
      setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, name: editNameValue.trim() } : t));
    }
    setIsEditingName(false);
  };

  const downloadSampleCSV = () => {
    const csvContent = `CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE
CSE1001,Problem Solving and Programming,Theory,3,A1+TA1,John Doe,AB1-101
CSE1001,Problem Solving and Programming,Lab,1,L1+L2,John Doe,AB1-102
CSE1002,Object Oriented Programming,Embedded Theory,3,B1+TB1,Jane Smith,AB1-201
CSE1002,Object Oriented Programming,Embedded Lab,1,L31+L32,Jane Smith,AB1-202`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'sample_ffcs_courses.csv';
    link.click();
  };

  const downloadImage = async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    
    const targetElement = captureRef.current;
    const originalStyle = targetElement.style.cssText;
    
    // Temporarily remove constraints to allow full capture
    const tableContainers = targetElement.querySelectorAll('.overflow-x-auto');
    tableContainers.forEach(container => {
      container.classList.remove('overflow-x-auto');
    });

    // Force the container to expand to fit its largest child, and make it flex
    // so that its children naturally stretch to that maximum width (preventing right-side cutoffs on backgrounds/borders)
    targetElement.classList.add('flex', 'flex-col', 'w-max', 'min-w-full');

    try {
      // Yield to the browser to ensure layout paints the new widths before we measure
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const scrollWidth = targetElement.scrollWidth;
      const scrollHeight = targetElement.scrollHeight;
      
      // Calculate scale to fit within viewport to bypass browser's SVG foreignObject clipping bug
      const viewportWidth = window.innerWidth;
      const safeWidth = viewportWidth * 0.9; // 90% of viewport
      const scale = scrollWidth > safeWidth ? safeWidth / scrollWidth : 1;

      // Use html-to-image as html2canvas cannot parse modern oklch colors used by tailwind
      const dataUrl = await htmlToImage.toJpeg(targetElement, { 
        quality: 0.95,
        backgroundColor: themeBgColor,
        // Multiply by inverse of scale to restore original size, then double for Retina quality
        pixelRatio: (1 / scale) * 2,
        width: scrollWidth * scale,
        height: scrollHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${scrollWidth}px`,
          height: `${scrollHeight}px`,
          padding: '20px',
          margin: '0',
          maxWidth: 'none'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${activeTimetable.name.replace(/\\s+/g, '_')}_FFCS.jpg`;
      link.href = dataUrl;
      link.click();
      setSuccessMsg("Timetable downloaded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to download timetable image.");
    } finally {
      // Cleanup styles and classes
      targetElement.style.cssText = originalStyle;
      targetElement.classList.remove('flex', 'flex-col', 'w-max', 'min-w-full');
      tableContainers.forEach(container => {
        container.classList.add('overflow-x-auto');
      });
      setIsDownloading(false);
    }
  };

  const downloadPDF = async () => {
    if (!pdfCaptureRef.current) return;
    setIsDownloading(true);
    
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError("Please allow popups to export as PDF.");
        setIsDownloading(false);
        return;
      }

      // Get all styles from the current document so Tailwind works in the popup
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      const htmlContent = `
        <!DOCTYPE html>
        <html class="${themeHtmlClass}">
          <head>
            <title>${activeTimetable.name} - FFCS</title>
            ${styles}
            <style>
              body { 
                margin: 0; 
                background-color: ${themeBgColor}; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              @page {
                size: landscape;
                margin: 10mm;
              }
            </style>
          </head>
          <body>
            <div style="background-color: ${themeBgColor}; color: ${themeTextColor}; padding: 40px; width: 100%; box-sizing: border-box;">
              ${pdfCaptureRef.current.innerHTML}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      setSuccessMsg("PDF print dialog opened!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to generate PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Unique Courses for Dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    masterCourses.forEach(c => map.set(c.CODE, c.TITLE));
    return Array.from(map.entries()).map(([code, title]) => ({ code, title })).sort((a, b) => a.code.localeCompare(b.code));
  }, [masterCourses]);

  // Available Slot Rows for Selected Course
  const availableSlots = useMemo(() => {
    if (!selectedCourseCode) return [];
    return masterCourses.filter(c => c.CODE === selectedCourseCode);
  }, [masterCourses, selectedCourseCode]);

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseCode || selectedSlotIndex === "-1") {
      setError("Please select both a course and a specific slot.");
      return;
    }

    const selectedRow = availableSlots[parseInt(selectedSlotIndex, 10)];
    if (!selectedRow) return;

    const slotsArray = selectedRow.SLOT.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL");
    
    const clashError = checkClashes(slotsArray);
    if (clashError) {
      setError(clashError);
      return;
    }

    // Check if exactly this course & slot is already added
    const duplicate = courses.find(c => c.code === selectedRow.CODE && c.slots.join("+") === slotsArray.join("+"));
    if (duplicate) {
      setError("This exact slot is already in your timetable.");
      return;
    }

    const newCourse: AddedCourse = {
      id: Math.random().toString(36).substr(2, 9),
      code: selectedRow.CODE,
      title: selectedRow.TITLE,
      slots: slotsArray,
      faculty: selectedRow.FACULTY,
      venue: selectedRow.ROOM || "TBA",
      credits: selectedRow.CREDITS || "0",
      type: selectedRow.TYPE || "Theory",
      color: COLORS[courses.length % COLORS.length]
    };

    updateActiveTimetableCourses([...courses, newCourse]);
    setSelectedCourseCode("");
    setSelectedSlotIndex("-1");
    setError(null);
    setSuccessMsg(`Successfully added ${newCourse.code} (${newCourse.type}) to ${activeTimetable.name}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRemoveCourse = (id: string) => {
    updateActiveTimetableCourses(courses.filter(c => c.id !== id));
  };

  const toggleBlockSlot = (slotName: string) => {
    if (!slotName) return;
    const newBlocked = new Set(blockedSlots);
    if (newBlocked.has(slotName)) {
      newBlocked.delete(slotName);
    } else {
      newBlocked.add(slotName);
    }
    setBlockedSlots(newBlocked);
  };

  const renderUnifiedGrid = () => {
    return (
      <div className="mb-8 overflow-x-auto rounded-xl border border-border shadow-2xl bg-background backdrop-blur-md">
        <div className="p-4 bg-muted/80 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            Unified Schedule
          </h3>
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm"></div>Theory (Top)</div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/10 border border-white/20 rounded-sm border-dashed"></div>Lab (Bottom)</div>
          </div>
        </div>
        <div className="min-w-max">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-card">
                <th className="p-3 border-b border-r border-border font-semibold text-foreground/80 w-24 text-center">Day</th>
                {theoryPeriods.map((period, idx) => (
                  <th key={idx} className="p-2 border-b border-r border-border text-xs text-center text-muted-foreground font-medium">
                    <div className="flex flex-col">
                      <span>{period.start}</span>
                      <span className="text-[10px] text-muted-foreground">to</span>
                      <span>{period.end}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.id} className="border-b border-border hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 border-r border-border font-semibold text-slate-200 text-center bg-muted/20">
                    {day.name.substring(0, 3).toUpperCase()}
                  </td>
                  {theoryPeriods.map((period, pIdx) => {
                    const theorySlotName = period.days?.[day.id];
                    const labSlotName = labPeriods[pIdx]?.days?.[day.id];
                    
                    if (!theorySlotName && !labSlotName) {
                      return <td key={pIdx} className="p-2 border-r border-border bg-black/20"></td>;
                    }

                    const tCourse = theorySlotName ? getCourseForSlot(theorySlotName) : undefined;
                    const lCourse = labSlotName ? getCourseForSlot(labSlotName) : undefined;

                    const isTBlocked = theorySlotName ? blockedSlots.has(theorySlotName) : false;
                    const isLBlocked = labSlotName ? blockedSlots.has(labSlotName) : false;

                    return (
                      <td key={pIdx} className="border-r border-border text-center relative group min-w-[80px] align-top">
                        <div className="w-full h-full min-h-[70px] flex flex-col items-stretch">
                          {/* Theory Half */}
                          {theorySlotName && (
                            <div 
                              onClick={() => toggleBlockSlot(theorySlotName)}
                              className={`flex-1 p-1 border-b border-border flex flex-col items-center justify-center transition-all duration-300 relative cursor-pointer ${
                                isTBlocked 
                                  ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 border-red-500/30 text-red-200 shadow-inner'
                                  : tCourse 
                                    ? tCourse.color + ' shadow-lg text-foreground z-10' 
                                    : 'bg-muted/20 text-muted-foreground hover:border-border/50 hover:bg-muted/30'
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${tCourse || isTBlocked ? 'opacity-100' : 'opacity-60'}`}>
                                {isTBlocked ? 'Blocked' : theorySlotName}
                              </span>
                              {!isTBlocked && tCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{tCourse.code}</span>}
                              
                              {/* Theory Tooltip */}
                              {!isTBlocked && tCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                  <p className="font-bold">{tCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{tCourse.faculty}</p>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-border"></div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Lab Half */}
                          {labSlotName && (
                            <div 
                              onClick={() => toggleBlockSlot(labSlotName)}
                              className={`flex-1 p-1 flex flex-col items-center justify-center border-t border-dashed border-border transition-all duration-300 relative cursor-pointer ${
                                isLBlocked 
                                  ? 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgogIDxwYXRoIGQ9Ik0tMiAxMEwxMCAteiIgIHN0cm9rZT0iI2ZmZmZmZjIwIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+")] bg-red-950/40 border-red-500/30 text-red-200 shadow-inner'
                                  : lCourse 
                                    ? lCourse.color + ' shadow-lg text-foreground z-10' 
                                    : 'bg-muted/10 text-muted-foreground hover:border-border/40 hover:bg-muted/30'
                              }`}
                            >
                              <span className={`text-[11px] font-bold ${lCourse || isLBlocked ? 'opacity-100' : 'opacity-60'}`}>
                                {isLBlocked ? 'Blocked' : labSlotName}
                              </span>
                              {!isLBlocked && lCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{lCourse.code}</span>}
                              
                              {/* Lab Tooltip */}
                              {!isLBlocked && lCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-[200px] bg-gray-900 text-foreground text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-border text-center">
                                  <p className="font-bold">{lCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{lCourse.faculty}</p>
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-t border-l border-border"></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={`w-full space-y-6 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[100] bg-slate-950 p-4 md:p-8 overflow-y-auto' : ''}`}>
      
      {/* Top Banner / Upload Area */}
      <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MapIcon className="text-blue-400 w-6 h-6" /> FFCS Planner
            </h2>
            <p className="text-muted-foreground text-sm mt-1">Upload the master spreadsheet and plan your perfect semester.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden md:flex items-center gap-2 bg-muted hover:border-border text-foreground px-4 py-2.5 rounded-xl border border-border transition-colors shadow-lg"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {masterCourses.length > 0 ? (
              <div className="flex items-center gap-3 bg-background px-4 py-2 rounded-xl border border-border">
                <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {masterCourses.length} slots loaded
                </span>
                <div className="w-px h-4 bg-white/20 mx-1"></div>
                <button 
                  onClick={handleClearMaster}
                  className="text-muted-foreground hover:text-red-400 text-sm font-medium transition-colors"
                >
                  Clear Data
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadSampleCSV}
                  className="bg-muted hover:bg-muted/80 text-foreground text-sm font-medium py-2.5 px-4 rounded-xl border border-border transition-colors shadow-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Sample CSV
                </button>
                <label 
                  className={`relative flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-medium py-2.5 px-6 rounded-xl shadow-lg transition-all duration-300 cursor-pointer overflow-hidden ${isDragging ? 'ring-4 ring-blue-500/50' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileUpload(event);
                  }
                }}
              >
                <input type="file" accept=".xlsx,.csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                <UploadCloud className="w-5 h-5" />
                <span>Upload Excel / CSV</span>
              </label>
              </div>
            )}
          </div>
        </div>

        {(error || successMsg) && (
          <div className={`mt-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${error ? 'bg-red-500/10 border-red-500/50 text-red-400' : 'bg-green-500/10 border-green-500/50 text-green-400'}`}>
            {error ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> : <Info className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{error || successMsg}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6">
        
        {/* Top Panel: Course Manager */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Timetable Manager */}
          <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
            <h2 className="text-lg font-bold text-foreground mb-4">Timetable Manager</h2>
            <div className="space-y-3">
              <select 
                value={activeTimetableId}
                onChange={e => setActiveTimetableId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
              >
                {timetables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.courses.length} courses)</option>
                ))}
              </select>
              
              <div className="flex gap-2">
                <button 
                  onClick={createNewTimetable}
                  className="flex-1 bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
                <button 
                  onClick={duplicateTimetable}
                  className="flex-1 bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Duplicate
                </button>
                <button 
                  onClick={() => {
                    setEditNameValue(activeTimetable.name);
                    setIsEditingName(true);
                  }}
                  className="flex-1 bg-accent/50 hover:bg-accent text-foreground text-xs font-medium py-2 rounded-lg border border-border transition-colors flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Rename
                </button>
                <button 
                  onClick={() => deleteTimetable(activeTimetableId)}
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-2 rounded-lg border border-red-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>

              <div className="flex gap-2 mt-2">
                <button 
                  onClick={exportTimetables}
                  className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-medium py-2 rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-1"
                >
                  <Save className="w-3 h-3" /> Export Config
                </button>
                <label 
                  className="flex-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium py-2 rounded-lg border border-indigo-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer relative overflow-hidden"
                >
                  <input type="file" accept=".json" onChange={importTimetables} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Upload className="w-3 h-3" /> Import Config
                </label>
              </div>

              {isEditingName && (
                <div className="flex gap-2 mt-2 animate-fadeIn">
                  <input 
                    type="text" 
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50"
                    placeholder="New name..."
                  />
                  <button 
                    onClick={handleRenameSubmit}
                    className="bg-green-500/20 text-green-400 p-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/30"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Course Selector */}
          <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
            <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <PlusCircle className="text-blue-400 w-5 h-5" /> Course Selector
            </h2>
            
            {!masterCourses.length ? (
              <div className="bg-background border border-border p-4 rounded-xl text-center">
                <p className="text-muted-foreground text-sm">Please upload a master slots file first.</p>
              </div>
            ) : (
              <form onSubmit={handleAddCourse} className="space-y-4">
                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    Group Embedded Courses
                  </span>
                  <button 
                    type="button"
                    onClick={() => setIsGroupingEnabled(!isGroupingEnabled)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${isGroupingEnabled ? 'bg-blue-500' : 'bg-muted-foreground'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${isGroupingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">1. Select Course</label>
                  <select 
                    value={selectedCourseCode}
                    onChange={e => {
                      setSelectedCourseCode(e.target.value);
                      setSelectedSlotIndex("-1"); 
                    }}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                  >
                    <option value="">-- Choose Course --</option>
                    {uniqueCourses.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.title.substring(0, 40)}{c.title.length > 40 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedCourseCode && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">2. Select Slot & Faculty</label>
                    <div className="flex gap-2">
                      <select 
                        value={slotFilter}
                        onChange={e => {
                          setSlotFilter(e.target.value);
                          setSelectedSlotIndex("-1");
                        }}
                        className="w-1/3 bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="all">All</option>
                        <option value="morning">Morning Theory</option>
                        <option value="evening">Evening Theory</option>
                        <option value="morning_lab">Morning Lab</option>
                        <option value="evening_lab">Evening Lab</option>
                      </select>
                      
                      <select 
                        value={selectedSlotIndex}
                        onChange={e => setSelectedSlotIndex(e.target.value)}
                        className="w-2/3 bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                      >
                        <option value="-1">-- Choose Component --</option>
                        {availableSlots.map((row, idx) => ({ row, idx })).filter(({ row }) => {
                          if (slotFilter === "all") return true;
                          if (slotFilter === "morning") return isMorningTheory(row.SLOT);
                          if (slotFilter === "evening") return isEveningTheory(row.SLOT);
                          if (slotFilter === "morning_lab") return isMorningLab(row.SLOT);
                          if (slotFilter === "evening_lab") return isEveningLab(row.SLOT);
                          return true;
                        }).map(({ row, idx }) => {
                          const slotsArray = row.SLOT.split("+").map(s => s.trim().toUpperCase()).filter(s => s && s !== "NIL");
                          const clashError = checkClashes(slotsArray);
                          const isBlocked = !!clashError;
                          return (
                            <option key={idx} value={idx.toString()} disabled={isBlocked}>
                              {row.SLOT} - {row.FACULTY} - {row.ROOM} {isBlocked ? `(Unavailable)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 ml-1">
                      * For embedded courses, theory and lab slots taught by the same faculty are automatically linked (if grouping is enabled). Click cells in the timetable grid to block time slots and narrow down valid options.
                    </p>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-foreground font-medium py-2.5 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add to Timetable
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Panel: The Grid and Export */}
        <div className="w-full space-y-6">
          <div className="flex justify-end gap-2 mb-2">
            <button 
              onClick={downloadPDF}
              disabled={isDownloading || courses.length === 0}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
            >
              <Download className="w-4 h-4" /> 
              {isDownloading ? "Exporting..." : "Download PDF"}
            </button>
            <button 
              onClick={downloadImage}
              disabled={isDownloading || courses.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-foreground px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" /> 
              {isDownloading ? "Capturing..." : "Download JPG"}
            </button>
          </div>
          
          <div ref={captureRef} className="space-y-6 rounded-xl">
            {/* Header for the exported image */}
            <div className="hidden print:block p-4 mb-4 bg-muted rounded-xl border border-border text-center">
              <h1 className="text-2xl font-bold text-foreground">{activeTimetable.name}</h1>
              <p className="text-muted-foreground text-sm mt-1">Generated by AmazeCC FFCS Planner</p>
            </div>
            
            {renderUnifiedGrid()}
            
            {/* Bottom Panel: Selected Courses Table inside capture ref to include in image */}
            {courses.length > 0 && (
              <div className="bg-white/60 dark:bg-slate-900/50 midnight:bg-white/[0.03] backdrop-blur-2xl border border-white/40 dark:border-gray-700/50 midnight:border-white/10 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-x-auto">
                <div className="flex items-center justify-between mb-4 min-w-[600px]">
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    Selected Courses
                    <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20">
                      Total Credits: {courses.reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}
                    </span>
                  </h2>
                  <button 
                    onClick={handleClearTimetable}
                    className="text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 print:hidden"
                  >
                    <Trash2 className="w-4 h-4" /> Clear All
                  </button>
                </div>
                
                <div className="min-w-[600px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
                        <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {courses.map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                              <div>
                                <p className="text-foreground font-semibold text-sm">{c.code}</p>
                                <p className="text-muted-foreground text-xs truncate max-w-[200px]">{c.title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80">
                            <span className="bg-accent/50 border border-border text-foreground/80 text-[10px] px-2 py-0.5 rounded-md">
                              {c.type}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80">{c.faculty}</td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {c.slots.map(s => (
                                <span key={s} className="bg-accent/50 border border-border text-foreground/80 text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-foreground/80 truncate max-w-[150px]">{c.venue}</td>
                          <td className="py-3 px-2 text-sm text-foreground/80">{c.credits}</td>
                          <td className="py-3 px-2 text-right print:hidden">
                            <button 
                              onClick={() => handleRemoveCourse(c.id)}
                              className="text-muted-foreground hover:text-red-400 transition-colors p-2"
                              title="Remove Course"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden PDF Capture Container */}
      <div 
        ref={pdfCaptureRef} 
        style={{ 
          display: 'none', 
          position: 'absolute', 
          left: '-9999px', 
          top: '-9999px', 
          width: '1200px', 
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '40px'
        }}
      >
        <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{activeTimetable.name}</h1>
            <p className="text-muted-foreground">Total Credits: {courses.reduce((sum, c) => sum + parseFloat(c.credits || "0"), 0)}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-blue-400">AmazeCC FFCS</h2>
            <p className="text-muted-foreground text-sm">VIT Chennai</p>
          </div>
        </div>

        {/* Selected Courses Table */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">Selected Courses</h2>
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border text-foreground/80">
                <th className="py-3 px-4 font-semibold">Course Code</th>
                <th className="py-3 px-4 font-semibold">Title</th>
                <th className="py-3 px-4 font-semibold">Type</th>
                <th className="py-3 px-4 font-semibold">Faculty</th>
                <th className="py-3 px-4 font-semibold">Slots</th>
                <th className="py-3 px-4 font-semibold text-center">Credits</th>
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">No courses selected</td>
                </tr>
              ) : (
                courses.map((c, i) => (
                  <tr key={i} className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium">{c.code}</td>
                    <td className="py-3 px-4">{c.title}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-muted text-foreground/80">
                        {c.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground/80">{c.faculty}</td>
                    <td className="py-3 px-4 font-mono text-xs">{c.slots.join(" + ")}</td>
                    <td className="py-3 px-4 text-center font-medium">{c.credits}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Timetable Grid Preview */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-foreground mb-4">Schedule</h2>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs text-center border-collapse table-fixed">
              <thead>
                <tr className="bg-muted">
                  <th className="border border-border p-2 w-20 text-muted-foreground">Day</th>
                  {theoryPeriods.map(p => (
                    <th key={p.start} className="border border-border p-2 text-foreground/80">
                      <div>{p.start}</div>
                      <div className="text-muted-foreground font-normal">to {p.end}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day.id} className="border border-border">
                    <td className="border border-border font-bold bg-muted/50 uppercase">
                      {day.id}
                    </td>
                    {theoryPeriods.map((tp, idx) => {
                      const tSlot = tp.days?.[day.id];
                      const lp = labPeriods[idx];
                      const lSlot = lp?.days?.[day.id];
                      
                      const tCourse = tSlot ? getCourseForSlot(tSlot) : null;
                      const lCourse = lSlot ? getCourseForSlot(lSlot) : null;
                      
                      return (
                        <td key={idx} className="border border-border p-0 relative h-16 align-top">
                          {/* Theory Half */}
                          <div className={`h-1/2 w-full border-b border-border/50 flex flex-col items-center justify-center p-0.5 ${tCourse ? 'bg-blue-500/20 text-blue-300' : 'bg-transparent text-muted-foreground'}`}>
                            {tCourse ? (
                              <>
                                <span className="font-bold text-[10px] leading-tight">{tCourse.code}</span>
                                <span className="text-[8px] opacity-75">{tSlot}</span>
                              </>
                            ) : (
                              <span className="text-[9px]">{tSlot || '-'}</span>
                            )}
                          </div>
                          
                          {/* Lab Half */}
                          <div className={`h-1/2 w-full flex flex-col items-center justify-center p-0.5 ${lCourse ? 'bg-purple-500/20 text-purple-300' : 'bg-transparent text-muted-foreground'}`}>
                            {lCourse ? (
                              <>
                                <span className="font-bold text-[10px] leading-tight">{lCourse.code}</span>
                                <span className="text-[8px] opacity-75">{lSlot}</span>
                              </>
                            ) : (
                              <span className="text-[9px]">{lSlot || '-'}</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center mt-12 pt-4 border-t border-border">
          <p className="text-muted-foreground text-sm flex items-center justify-center gap-2">
            Generated by AmazeCC <MapIcon className="w-4 h-4 text-blue-500" />
          </p>
        </div>
      </div>
    </div>
  );
}
