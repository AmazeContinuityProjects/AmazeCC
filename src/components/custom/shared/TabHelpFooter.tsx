"use client";

import React, { useState } from "react";
import { 
  HelpCircle, 
  Info, 
  Sparkles, 
  BookOpen, 
  ChevronRight, 
  Sliders, 
  RefreshCcw, 
  Search, 
  Eye, 
  Share2, 
  Calendar, 
  Users, 
  Zap, 
  ShieldCheck, 
  Clock,
  CheckCircle2
} from "lucide-react";
import Modal from "./Modal";

export interface TabHelpItem {
  icon: React.ReactNode;
  name: string;
  description: string;
  steps: string[];
}

export interface TabGuideData {
  tabName: string;
  subtitle: string;
  items: TabHelpItem[];
}

export const TAB_GUIDES: Record<string, TabGuideData> = {
  home: {
    tabName: "Home Dashboard",
    subtitle: "Complete step-by-step guide to buttons, widgets, and layout customization",
    items: [
      {
        icon: <RefreshCcw className="w-4 h-4 text-indigo-500" />,
        name: "Sync VTOP Data",
        description: "Refreshes live attendance, class schedules, marks, and hostel data directly from VTOP.",
        steps: [
          "Step 1: Tap the Sync button (Refresh icon) at the top header.",
          "Step 2: Enter your VTOP Captcha if prompted.",
          "Step 3: Wait a few seconds for all 8 categories (Attendance, Schedule, Grades, Hostel, LMS) to load."
        ]
      },
      {
        icon: <Sliders className="w-4 h-4 text-purple-500" />,
        name: "Customize Dashboard Layout & Card Sizes",
        description: "Reorder cards, resize cards between 1-column half-width and 2-column full-width, or hide unused widgets.",
        steps: [
          "Step 1: Tap the Sliders icon (Customize) next to the search bar.",
          "Step 2: Click 'Full Width' / 'Half Width' on any card to change desktop grid sizing.",
          "Step 3: Drag cards using the Grip handle or use Up/Down arrows to reorder tiles.",
          "Step 4: Click the Eye icon to hide or unhide specific cards."
        ]
      },
      {
        icon: <Search className="w-4 h-4 text-blue-500" />,
        name: "Spotlight Global Search (⌘K / Ctrl+K)",
        description: "Quick navigation palette to search courses, timetable slots, mess menus, or settings instantly.",
        steps: [
          "Step 1: Press ⌘K (or Ctrl+K on Windows) or tap the Search Bar.",
          "Step 2: Type any course name, classroom venue, or feature keyword (e.g. 'Mess', 'Exam', 'COMPILER').",
          "Step 3: Press Enter to jump directly to that module."
        ]
      },
      {
        icon: <Eye className="w-4 h-4 text-emerald-500" />,
        name: "Quick Settings & Privacy Toggles",
        description: "Instant switches for Grade Anonymizer, Hide CGPA, Decimal Attendance, Bus Mode, and Mess Filter.",
        steps: [
          "Step 1: Scroll to the Quick Settings widget on Home.",
          "Step 2: Toggle 'Hide CGPA' to mask cumulative GPA from main pages.",
          "Step 3: Toggle 'Grades Anonymizer' to blur all course marks until hovered.",
          "Step 4: Enable 'Dayscholar Bus Mode' if commuting via college transport."
        ]
      }
    ]
  },
  attendance: {
    tabName: "Attendance Tracker & Bunk Margin",
    subtitle: "Step-by-step guide to calculating safety margins and class predictions",
    items: [
      {
        icon: <Sliders className="w-4 h-4 text-emerald-500" />,
        name: "Target Attendance Percentage Slider",
        description: "Calculates exact classes required or safe to skip based on your custom target threshold.",
        steps: [
          "Step 1: Open the Attendance tab.",
          "Step 2: Adjust the Target Slider to your university target (75%, 80%, or 85%).",
          "Step 3: Inspect the 'Classes to Bunk' (emerald) or 'Classes Required' (amber/red) badge for each course."
        ]
      },
      {
        icon: <Calendar className="w-4 h-4 text-indigo-500" />,
        name: "Timetable Day Pills & Saturday Overrides",
        description: "View daily lecture schedules and apply Saturday order timetable swaps.",
        steps: [
          "Step 1: Tap MON, TUE, WED, THU, FRI, or SAT pills at the top.",
          "Step 2: For Saturday, select which weekday order (e.g. 'Run as Monday Order') to load appropriate slots."
        ]
      },
      {
        icon: <RefreshCcw className="w-4 h-4 text-blue-500" />,
        name: "Attendance Predictor Simulator",
        description: "Simulate future attendance percentages by testing hypothetical skips or upcoming holiday dates.",
        steps: [
          "Step 1: Tap 'Predict Attendance'.",
          "Step 2: Select future dates or enter hypothetical absences for specific courses.",
          "Step 3: View the projected overall semester percentage."
        ]
      }
    ]
  },
  academics: {
    tabName: "Academics, Grades & Exam Venues",
    subtitle: "Step-by-step guide to curriculum credit audits, exam seat venues, and GPA simulators",
    items: [
      {
        icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
        name: "Curriculum Credit Audit",
        description: "Track credit progress across Program Core (PC), University Electives (UE), and Humanities (HSM).",
        steps: [
          "Step 1: Open Academics -> Curriculum Audit.",
          "Step 2: View earned credits versus required graduation credits for each basket.",
          "Step 3: Identify unfulfilled prerequisite courses."
        ]
      },
      {
        icon: <Calendar className="w-4 h-4 text-rose-500" />,
        name: "CAT & FAT Exam Schedule & Seat Venues",
        description: "View exam dates, FN/AN time slots, building hall numbers, and assigned seat numbers.",
        steps: [
          "Step 1: Tap Academics -> Exam Schedule.",
          "Step 2: Filter by FN (Forenoon / Morning) or AN (Afternoon) exam session.",
          "Step 3: Check your assigned building venue (e.g., SJT 402) and seat position (#42)."
        ]
      },
      {
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        name: "GPA Simulator & What-If Projection",
        description: "Project future semester GPA and cumulative CGPA by entering expected letter grades.",
        steps: [
          "Step 1: Tap GPA Calculator.",
          "Step 2: Assign projected grades (S, A, B, C, D) to your current semester courses.",
          "Step 3: View your projected semester GPA and new cumulative CGPA instantly."
        ]
      }
    ]
  },
  hostel: {
    tabName: "Campus & Hostel Services",
    subtitle: "Step-by-step guide to mess menus, laundry status, cab sharing, and bus routes",
    items: [
      {
        icon: <Calendar className="w-4 h-4 text-amber-500" />,
        name: "Weekly Mess Menu Caterer Filter",
        description: "View breakfast, lunch, snacks, and dinner for special, veg, non-veg, and north/south caterers.",
        steps: [
          "Step 1: Open Hostel -> Mess Menu.",
          "Step 2: Select your hostel block caterer (e.g. 'Special Mess', 'Non-Veg Mess').",
          "Step 3: Tap Breakfast, Lunch, Snacks, or Dinner to view dishes."
        ]
      },
      {
        icon: <Clock className="w-4 h-4 text-indigo-500" />,
        name: "Laundry Machine Availability & Slot Booking",
        description: "Check washer/dryer machine status and active booking hours.",
        steps: [
          "Step 1: Tap Hostel -> Laundry.",
          "Step 2: Select your hostel block to view operating hours.",
          "Step 3: Check available machine slots before heading down."
        ]
      },
      {
        icon: <Share2 className="w-4 h-4 text-emerald-500" />,
        name: "Cab Share Matcher (Airport / Railway Station)",
        description: "Find batchmates traveling at the same time to split cab fares to Chennai/Bengaluru airport or Katpadi station.",
        steps: [
          "Step 1: Tap Hostel -> Cab Share.",
          "Step 2: Post your departure date, destination (Airport / Railway Station), and time.",
          "Step 3: Connect with batchmates heading to the same terminal to split taxi fares."
        ]
      }
    ]
  },
  social: {
    tabName: "Social & Friend Timetables",
    subtitle: "Step-by-step guide to campus radar, schedule sharing, and group free slots",
    items: [
      {
        icon: <Zap className="w-4 h-4 text-emerald-500" />,
        name: "Live Campus Radar (Who is Free Right Now?)",
        description: "Scans schedule slots to alert you when friends currently have no active class.",
        steps: [
          "Step 1: Open Social -> '⚡ Free Right Now' sub-tab.",
          "Step 2: View friends with active free hours during the current campus time.",
          "Step 3: Tap any friend card to send a quick WhatsApp message for coffee or lunch."
        ]
      },
      {
        icon: <Share2 className="w-4 h-4 text-indigo-500" />,
        name: "Temporary Share Link & Apple-Pass QR Code",
        description: "Generate 5-min or 15-min temporary expiring links or QR passes to share your schedule.",
        steps: [
          "Step 1: Tap the Share button at the top of Social.",
          "Step 2: Choose link expiry duration (⚡ 5 Min, ⏱️ 15 Min, ⏳ 1 Hour, or ♾️ Permanent).",
          "Step 3: Tap 'Copy Link' (creates a short `#s=` link) or 'Download Pass Image' to share."
        ]
      },
      {
        icon: <Users className="w-4 h-4 text-purple-500" />,
        name: "Group Common Free Grid Matrix",
        description: "Visual 7-day matrix showing overlapping free slots across project team members.",
        steps: [
          "Step 1: Tap Social -> '📊 Common Free Grid Matrix'.",
          "Step 2: Select a project group or compare all friends.",
          "Step 3: Inspect green slot highlights indicating when everyone in the team is free."
        ]
      }
    ]
  },
  events: {
    tabName: "Events, Cultural Fests & Clubs",
    subtitle: "Step-by-step guide to QR entry tickets, fest passes, and club drives",
    items: [
      {
        icon: <Sparkles className="w-4 h-4 text-rose-500" />,
        name: "Registered QR Entry Tickets",
        description: "Access official entry passes and QR tickets for registered campus workshops and concerts.",
        steps: [
          "Step 1: Open Events -> 'Registered Events'.",
          "Step 2: Tap any event to open your QR Entry Pass.",
          "Step 3: Present the QR code to volunteers at the auditorium/ground entrance."
        ]
      },
      {
        icon: <Users className="w-4 h-4 text-indigo-500" />,
        name: "Club Chapter Directory & Recruitment Drives",
        description: "Explore technical chapters, cultural societies, and active recruitment drives.",
        steps: [
          "Step 1: Browse active event listings or filter by club category.",
          "Step 2: Tap any event card to view description, price, venue, and registration deadline.",
          "Step 3: Tap 'Register Now' to open VTOP event payment gateway."
        ]
      }
    ]
  },
  settings: {
    tabName: "Settings, Privacy & Customization",
    subtitle: "Step-by-step guide to CGPA hiding, grade anonymization, and custom themes",
    items: [
      {
        icon: <ShieldCheck className="w-4 h-4 text-indigo-500" />,
        name: "Privacy & Anonymization Controls",
        description: "Hide CGPA, blur marks/grades, and toggle profile photo visibility for privacy.",
        steps: [
          "Step 1: Open Settings -> Privacy section.",
          "Step 2: Toggle 'Hide CGPA Everywhere' to mask cumulative grades on home & sidebars.",
          "Step 3: Toggle 'Grades Anonymizer Mode' to blur individual test scores until hovered."
        ]
      },
      {
        icon: <Sliders className="w-4 h-4 text-purple-500" />,
        name: "Appearance, Light/Dark Mode & Custom Color Themes",
        description: "Personalize app accent colors, light/dark themes, and quick navbar shortcuts.",
        steps: [
          "Step 1: Open Settings -> Appearance.",
          "Step 2: Switch between Light, Dark, or System Sync theme.",
          "Step 3: Select your favorite accent color palette (Indigo, Emerald, Violet, Rose)."
        ]
      }
    ]
  }
};

export default function TabHelpFooter({ tabId }: { tabId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const guide = TAB_GUIDES[tabId] || TAB_GUIDES.home;

  return (
    <div className="flex justify-center pt-4 pb-2">
      {/* Sleek Compact Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/80 dark:border-zinc-700/80 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer shadow-2xs active:scale-95"
        title={`Open step-by-step guide for ${guide.tabName}`}
      >
        <HelpCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span>How to use {guide.tabName}?</span>
      </button>

      {/* Detailed Step-by-Step Guide Modal */}
      {isOpen && (
        <Modal onClose={() => setIsOpen(false)} maxWidth="max-w-lg">
          <div className="text-left space-y-4 max-h-[80vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
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

            <div className="space-y-3.5">
              {guide.items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800/80 space-y-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 shrink-0 shadow-2xs">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-white font-outfit">
                        {item.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Step-by-Step Breakdown */}
                  {Array.isArray(item.steps) && item.steps.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800 space-y-1.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                      {item.steps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-zinc-150 dark:border-zinc-800">
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
