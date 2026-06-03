"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { PlusCircle, Trash2, AlertTriangle, Info, UploadCloud, Map as MapIcon, Download, Plus, Edit2, Check, Maximize2, Minimize2 } from "lucide-react";
import * as XLSX from "xlsx";
import * as htmlToImage from "html-to-image";
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

export default function FFCSTimetableTab() {
  const [masterCourses, setMasterCourses] = useState<ParsedCourse[]>([]);
  
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
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const captureRef = useRef<HTMLDivElement>(null);

  // Load from local storage on mount
  useEffect(() => {
    const savedMaster = localStorage.getItem("ffcs_master_courses");
    if (savedMaster) setMasterCourses(JSON.parse(savedMaster));

    const savedTimetables = localStorage.getItem("ffcs_timetables");
    if (savedTimetables) {
      const parsed = JSON.parse(savedTimetables);
      if (parsed && parsed.length > 0) {
        setTimetables(parsed);
        setActiveTimetableId(parsed[0].id);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem("ffcs_master_courses", JSON.stringify(masterCourses));
  }, [masterCourses]);

  useEffect(() => {
    localStorage.setItem("ffcs_timetables", JSON.stringify(timetables));
  }, [timetables]);

  const updateActiveTimetableCourses = (newCourses: AddedCourse[]) => {
    setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, courses: newCourses } : t));
  };

  const theoryPeriods = (timetableSchema.theory as TimetablePeriod[]).filter(p => !p.lunch);
  const labPeriods = (timetableSchema.lab as TimetablePeriod[]).filter(p => !p.lunch);
  const allPeriods = [...theoryPeriods, ...labPeriods];

  const getPeriodsForSlot = (slotName: string) => {
    const matchedPeriods: { day: string, startMin: number, endMin: number }[] = [];
    allPeriods.forEach(p => {
      if (!p.days || !p.start || !p.end) return;
      Object.entries(p.days).forEach(([day, s]) => {
        if (s === slotName) {
          matchedPeriods.push({
            day,
            startMin: timeToMinutes(p.start as string),
            endMin: timeToMinutes(p.end as string)
          });
        }
      });
    });
    return matchedPeriods;
  };

  const checkClashes = (newSlots: string[]) => {
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

        const parsed: ParsedCourse[] = data.map((row: any) => ({
          CODE: row.CODE || row["COURSE CODE"] || row.Code || "",
          TITLE: row.TITLE || row["COURSE TITLE"] || row.Title || "",
          TYPE: row.TYPE || row.Type || "",
          CREDITS: row.CREDITS || row.Credits || "0",
          ROOM: row.VENUE || row.ROOM || row.Room || row.Venue || "",
          SLOT: row.SLOT || row.Slot || "",
          FACULTY: row.FACULTY || row.Faculty || ""
        })).filter(c => c.CODE);

        setMasterCourses(parsed);
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

  const handleRenameSubmit = () => {
    if (editNameValue.trim()) {
      setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, name: editNameValue.trim() } : t));
    }
    setIsEditingName(false);
  };

  const downloadImage = async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    
    // Temporarily remove constraints to allow full capture
    const tableContainer = captureRef.current.querySelector('.overflow-x-auto');
    if (tableContainer) {
      tableContainer.classList.remove('overflow-x-auto');
    }

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const dataUrl = await htmlToImage.toJpeg(captureRef.current, { 
        quality: 0.95,
        backgroundColor: '#0f172a', // Tailwind midnight/slate-900
        style: {
          padding: '20px'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${activeTimetable.name.replace(/\s+/g, '_')}_FFCS.jpg`;
      link.href = dataUrl;
      link.click();
      setSuccessMsg("Timetable downloaded successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to download timetable image.");
    } finally {
      if (tableContainer) {
        tableContainer.classList.add('overflow-x-auto');
      }
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

  const renderUnifiedGrid = () => {
    return (
      <div className="mb-8 overflow-x-auto rounded-xl border border-white/10 shadow-2xl bg-slate-900/50 backdrop-blur-md">
        <div className="p-4 bg-slate-800/80 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
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
              <tr className="bg-slate-800/40">
                <th className="p-3 border-b border-r border-white/10 font-semibold text-slate-300 w-24 text-center">Day</th>
                {theoryPeriods.map((period, idx) => (
                  <th key={idx} className="p-2 border-b border-r border-white/10 text-xs text-center text-slate-400 font-medium">
                    <div className="flex flex-col">
                      <span>{period.start}</span>
                      <span className="text-[10px] text-slate-500">to</span>
                      <span>{period.end}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-3 border-r border-white/10 font-semibold text-slate-200 text-center bg-slate-800/20">
                    {day.name.substring(0, 3).toUpperCase()}
                  </td>
                  {theoryPeriods.map((period, pIdx) => {
                    const theorySlotName = period.days?.[day.id];
                    const labSlotName = labPeriods[pIdx]?.days?.[day.id];
                    
                    if (!theorySlotName && !labSlotName) {
                      return <td key={pIdx} className="p-2 border-r border-white/10 bg-black/20"></td>;
                    }

                    const tCourse = theorySlotName ? getCourseForSlot(theorySlotName) : undefined;
                    const lCourse = labSlotName ? getCourseForSlot(labSlotName) : undefined;

                    return (
                      <td key={pIdx} className="border-r border-white/10 text-center relative group min-w-[80px] align-top">
                        <div className="w-full h-full min-h-[70px] flex flex-col items-stretch">
                          {/* Theory Half */}
                          {theorySlotName && (
                            <div className={`flex-1 p-1 border-b border-white/5 flex flex-col items-center justify-center transition-all duration-300 relative ${tCourse ? tCourse.color + ' shadow-lg text-white z-10' : 'bg-slate-800/20 text-slate-400 hover:bg-slate-700/50'}`}>
                              <span className={`text-[11px] font-bold ${tCourse ? 'opacity-100' : 'opacity-60'}`}>{theorySlotName}</span>
                              {tCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{tCourse.code}</span>}
                              
                              {/* Theory Tooltip */}
                              {tCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 -translate-x-1/2 mb-1 w-max max-w-[200px] bg-gray-900 text-white text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-white/10 text-center">
                                  <p className="font-bold">{tCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{tCourse.faculty}</p>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-white/10"></div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Lab Half */}
                          {labSlotName && (
                            <div className={`flex-1 p-1 flex flex-col items-center justify-center border-t border-dashed border-white/10 transition-all duration-300 relative ${lCourse ? lCourse.color + ' shadow-lg text-white z-10' : 'bg-slate-800/10 text-slate-500 hover:bg-slate-700/40'}`}>
                              <span className={`text-[11px] font-bold ${lCourse ? 'opacity-100' : 'opacity-60'}`}>{labSlotName}</span>
                              {lCourse && <span className="text-[9px] font-medium leading-tight px-1 text-center truncate w-full">{lCourse.code}</span>}
                              
                              {/* Lab Tooltip */}
                              {lCourse && (
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 top-full left-1/2 -translate-x-1/2 mt-1 w-max max-w-[200px] bg-gray-900 text-white text-xs rounded-lg py-1.5 px-3 shadow-xl z-50 pointer-events-none border border-white/10 text-center">
                                  <p className="font-bold">{lCourse.title}</p>
                                  <p className="text-gray-300 mt-0.5">{lCourse.faculty}</p>
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-t border-l border-white/10"></div>
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
      <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <MapIcon className="text-blue-400 w-6 h-6" /> FFCS Planner
            </h2>
            <p className="text-slate-400 text-sm mt-1">Upload the master spreadsheet and plan your perfect semester.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl border border-white/10 transition-colors shadow-lg"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {masterCourses.length > 0 ? (
              <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-xl border border-white/10">
                <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  {masterCourses.length} slots loaded
                </span>
                <div className="w-px h-4 bg-white/20 mx-1"></div>
                <button 
                  onClick={handleClearMaster}
                  className="text-slate-400 hover:text-red-400 text-sm font-medium transition-colors"
                >
                  Clear Data
                </button>
              </div>
            ) : (
              <label 
                className={`relative flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-2.5 px-6 rounded-xl shadow-lg transition-all duration-300 cursor-pointer overflow-hidden ${isDragging ? 'ring-4 ring-blue-500/50' : ''}`}
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Panel: Course Manager */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Timetable Manager */}
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <h2 className="text-lg font-bold text-white mb-4">Timetable Manager</h2>
            <div className="space-y-3">
              <select 
                value={activeTimetableId}
                onChange={e => setActiveTimetableId(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              >
                {timetables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.courses.length} courses)</option>
                ))}
              </select>
              
              <div className="flex gap-2">
                <button 
                  onClick={createNewTimetable}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-medium py-2 rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New
                </button>
                <button 
                  onClick={() => {
                    setEditNameValue(activeTimetable.name);
                    setIsEditingName(true);
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-medium py-2 rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1"
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

              {isEditingName && (
                <div className="flex gap-2 mt-2 animate-fadeIn">
                  <input 
                    type="text" 
                    value={editNameValue}
                    onChange={e => setEditNameValue(e.target.value)}
                    className="flex-1 bg-slate-900/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
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
          <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <PlusCircle className="text-blue-400 w-5 h-5" /> Course Selector
            </h2>
            
            {!masterCourses.length ? (
              <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl text-center">
                <p className="text-slate-400 text-sm">Please upload a master slots file first.</p>
              </div>
            ) : (
              <form onSubmit={handleAddCourse} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">1. Select Course</label>
                  <select 
                    value={selectedCourseCode}
                    onChange={e => {
                      setSelectedCourseCode(e.target.value);
                      setSelectedSlotIndex("-1"); 
                    }}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
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
                    <label className="block text-xs font-medium text-slate-400 mb-1 ml-1">2. Select Slot & Faculty</label>
                    <select 
                      value={selectedSlotIndex}
                      onChange={e => setSelectedSlotIndex(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    >
                      <option value="-1">-- Choose Component --</option>
                      {availableSlots.map((row, idx) => (
                        <option key={idx} value={idx.toString()}>
                          [{row.TYPE}] {row.SLOT} - {row.FACULTY}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-2 ml-1">
                      * For embedded courses, you must manually add the Theory slot and Lab slot separately to select the exact slots you want.
                    </p>
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={!selectedCourseCode || selectedSlotIndex === "-1"}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add to Timetable
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Panel: The Grid and Export */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex justify-end mb-2">
            <button 
              onClick={downloadImage}
              disabled={isDownloading}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium py-2 px-4 rounded-xl border border-white/10 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> 
              {isDownloading ? "Generating JPG..." : "Download as JPG"}
            </button>
          </div>
          
          <div ref={captureRef} className="space-y-6 rounded-xl">
            {/* Header for the exported image */}
            <div className="hidden print:block p-4 mb-4 bg-slate-800 rounded-xl border border-white/10 text-center">
              <h1 className="text-2xl font-bold text-white">{activeTimetable.name}</h1>
              <p className="text-slate-400 text-sm mt-1">Generated by UniCC FFCS Planner</p>
            </div>
            
            {renderUnifiedGrid()}
            
            {/* Bottom Panel: Selected Courses Table inside capture ref to include in image */}
            {courses.length > 0 && (
              <div className="bg-slate-800/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-md overflow-x-auto">
                <div className="flex items-center justify-between mb-4 min-w-[600px]">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
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
                      <tr className="border-b border-white/10">
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Course</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Faculty</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Slots</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Venue</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Credits</th>
                        <th className="py-3 px-2 text-xs font-medium text-slate-400 uppercase tracking-wider text-right print:hidden">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {courses.map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${c.color} shadow-sm shrink-0`} />
                              <div>
                                <p className="text-white font-semibold text-sm">{c.code}</p>
                                <p className="text-slate-400 text-xs truncate max-w-[200px]">{c.title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-slate-300">
                            <span className="bg-white/5 border border-white/10 text-slate-300 text-[10px] px-2 py-0.5 rounded-md">
                              {c.type}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-sm text-slate-300">{c.faculty}</td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {c.slots.map(s => (
                                <span key={s} className="bg-white/5 border border-white/10 text-slate-300 text-[10px] px-1.5 py-0.5 rounded-md">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-sm text-slate-300 truncate max-w-[150px]">{c.venue}</td>
                          <td className="py-3 px-2 text-sm text-slate-300">{c.credits}</td>
                          <td className="py-3 px-2 text-right print:hidden">
                            <button 
                              onClick={() => handleRemoveCourse(c.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors p-2"
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
    </div>
  );
}
