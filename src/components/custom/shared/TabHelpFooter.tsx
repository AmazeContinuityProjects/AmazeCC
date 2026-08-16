"use client";

import React, { useState } from "react";
import { HelpCircle, Info, Sparkles, BookOpen, ChevronRight, Sliders, RefreshCcw, Search, Eye, Share2, Calendar, Users, Zap, ShieldCheck, Clock } from "lucide-react";
import Modal from "./Modal";

export interface TabHelpItem {
  icon: React.ReactNode;
  name: string;
  description: string;
}

export interface TabGuideData {
  tabName: string;
  subtitle: string;
  items: TabHelpItem[];
}

export const TAB_GUIDES: Record<string, TabGuideData> = {
  home: {
    tabName: "Home Dashboard",
    subtitle: "Quick guide to buttons and customization on your home screen",
    items: [
      {
        icon: <RefreshCcw className="w-4 h-4 text-indigo-500" />,
        name: "Sync Data Button",
        description: "Fetches fresh attendance, timetable, and schedule information directly from VTOP gateway."
      },
      {
        icon: <Sliders className="w-4 h-4 text-purple-500" />,
        name: "Customize Dashboard (Sliders Icon)",
        description: "Opens edit mode to reorder tiles, toggle 1x/2x card sizes, and drag cards into position."
      },
      {
        icon: <Search className="w-4 h-4 text-blue-500" />,
        name: "Spotlight Search (⌘K)",
        description: "Instant search palette for quick navigation, courses, exam schedules, and settings."
      },
      {
        icon: <Eye className="w-4 h-4 text-emerald-500" />,
        name: "Quick Settings Toggles",
        description: "Instant switches for Grade Anonymizer, Hide CGPA, Decimal Values, Bus Mode, and Mess Filter."
      }
    ]
  },
  academics: {
    tabName: "Academics & Exams",
    subtitle: "Guide to course grades, curriculum credit audit, and exam schedules",
    items: [
      {
        icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
        name: "Curriculum Audit",
        description: "Calculates earned credits across Program Core, University Electives, and HSM Baskets."
      },
      {
        icon: <Calendar className="w-4 h-4 text-rose-500" />,
        name: "Exam Schedule & Seat Venues",
        description: "Displays FN (Morning) and AN (Afternoon) exam dates, hall numbers, and seat positions."
      },
      {
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        name: "Grades Anonymizer Mode",
        description: "Blurs all individual course marks and letter grades until hovered for privacy."
      }
    ]
  },
  attendance: {
    tabName: "Attendance Tracker",
    subtitle: "Guide to attendance margins, bunk planning, and target sliders",
    items: [
      {
        icon: <Sliders className="w-4 h-4 text-emerald-500" />,
        name: "Target Attendance Slider",
        description: "Adjust target percentage (e.g. 75% or 85%) to calculate exact classes required or safe to skip."
      },
      {
        icon: <Info className="w-4 h-4 text-indigo-500" />,
        name: "Bunk & Safety Margin",
        description: "Shows 'Classes to Skip' or 'Classes Required' badge for each registered course."
      },
      {
        icon: <RefreshCcw className="w-4 h-4 text-blue-500" />,
        name: "Reload Attendance",
        description: "Re-fetches current semester attendance records from the server."
      }
    ]
  },
  hostel: {
    tabName: "Campus & Hostel Hub",
    subtitle: "Guide to mess menus, laundry slots, day scholar bus routes, and cab shares",
    items: [
      {
        icon: <Calendar className="w-4 h-4 text-amber-500" />,
        name: "Mess Menu Caterers",
        description: "Select your hostel block caterer to view breakfast, lunch, snacks, and dinner for the week."
      },
      {
        icon: <Clock className="w-4 h-4 text-indigo-500" />,
        name: "Laundry Slot Status",
        description: "Check washer and dryer machine availability and active slot timings."
      },
      {
        icon: <Share2 className="w-4 h-4 text-emerald-500" />,
        name: "Cab Share Matcher",
        description: "Match with batchmates traveling to airport or railway station to split cab fares."
      }
    ]
  },
  social: {
    tabName: "Social & Friends",
    subtitle: "Guide to campus radar, schedule sharing, and group free slots",
    items: [
      {
        icon: <Zap className="w-4 h-4 text-emerald-500" />,
        name: "Campus Radar (Free Right Now)",
        description: "Live status showing which friends currently have no class during active hours."
      },
      {
        icon: <Share2 className="w-4 h-4 text-indigo-500" />,
        name: "Temporary Share Link & Pass",
        description: "Generate 5-min or 15-min temporary expiring links or QR passes to add friends."
      },
      {
        icon: <Users className="w-4 h-4 text-purple-500" />,
        name: "Common Free Grid Matrix",
        description: "Compare timetable overlaps for project teams or group studies in 1 click."
      }
    ]
  },
  events: {
    tabName: "Events & Clubs",
    subtitle: "Guide to festival passes, workshop tickets, and club drives",
    items: [
      {
        icon: <Sparkles className="w-4 h-4 text-rose-500" />,
        name: "Registered QR Tickets",
        description: "Access entry passes and QR tickets for registered campus events."
      },
      {
        icon: <Users className="w-4 h-4 text-indigo-500" />,
        name: "Club Directory",
        description: "Explore technical chapters, cultural societies, and active recruitment drives."
      }
    ]
  },
  settings: {
    tabName: "Settings & Profile",
    subtitle: "Guide to privacy, themes, anonymization, and campus preferences",
    items: [
      {
        icon: <ShieldCheck className="w-4 h-4 text-indigo-500" />,
        name: "Privacy & Anonymization",
        description: "Hide CGPA, blur marks/grades, and toggle profile avatar visibility."
      },
      {
        icon: <Sliders className="w-4 h-4 text-purple-500" />,
        name: "Appearance & Themes",
        description: "Custom palette picker, dark/light mode toggle, and pinned quick nav tabs."
      }
    ]
  }
};

export default function TabHelpFooter({ tabId }: { tabId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const guide = TAB_GUIDES[tabId] || TAB_GUIDES.home;

  return (
    <div className="w-full pt-8 pb-4">
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-zinc-900 dark:text-white font-outfit">
              Need help with {guide.tabName}?
            </h4>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
              Click to see what each button and feature in this tab does
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all cursor-pointer shadow-2xs shrink-0 flex items-center gap-1"
        >
          <span>Tab Guide</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <Modal onClose={() => setIsOpen(false)} maxWidth="max-w-md">
          <div className="text-left space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                    {guide.tabName} Guide
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {guide.subtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {guide.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 flex items-start gap-3"
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white font-outfit">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed mt-0.5 font-medium">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-xs"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
