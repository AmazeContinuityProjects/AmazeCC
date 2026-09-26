import BottomSheet from "../shared/BottomSheet";
import TimetableGrid from "../attendance/TimetableGrid";
import { Friend, saveFriend } from "@/lib/socialUtils";
import { Eye, EyeOff, BookOpen } from "lucide-react";
import { useState } from "react";

interface FriendTimetableModalProps {
  friend: Friend;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function FriendTimetableModal({ friend: initialFriend, onClose, onUpdate }: FriendTimetableModalProps) {
  const [friend, setFriend] = useState<Friend>(initialFriend);

  const attendanceAdapter = (friend.classSlots || []).map((slot) => ({
    slotName: slot.slotId,
    courseTitle: slot.courseTitle || "Class Slot",
    courseCode: slot.courseCode || (slot.courseTitle ? slot.courseTitle.substring(0, 7).toUpperCase() : "SLOT"),
    slotVenue: slot.venue || "",
    faculty: "",
  }));

  const handleToggleDashboard = () => {
    const updated = { ...friend, showInHomePage: !friend.showInHomePage };
    saveFriend(updated);
    setFriend(updated);
    if (onUpdate) onUpdate();
  };

  return (
    <BottomSheet onClose={onClose} overlayId="social-friend-timetable" maxWidth="max-w-5xl">
      <div className="flex flex-col min-h-0">
        {/* Header */}
        <div className="p-4 sm:p-5 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between gap-3 bg-zinc-50/80 dark:bg-zinc-900/70">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-xs shrink-0"
              style={{ backgroundColor: friend.color || "#6366f1" }}
            >
              {friend.nickname.substring(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit truncate">
                  {friend.nickname}&apos;s Timetable
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-muted-foreground uppercase tracking-wider shrink-0">
                  {friend.regNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                {friend.classSlots.length} enrolled class slots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleDashboard}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                friend.showInHomePage
                  ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
              }`}
              title={friend.showInHomePage ? "Shown on Dashboard" : "Hidden on Dashboard"}
            >
              {friend.showInHomePage ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">
                {friend.showInHomePage ? "On Dashboard" : "Hidden from Dashboard"}
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5">
          <TimetableGrid attendance={attendanceAdapter} />
        </div>
      </div>
    </BottomSheet>
  );
}

