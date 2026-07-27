import Modal from "../shared/Modal";
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
    <Modal onClose={onClose} maxWidth="max-w-5xl" noPadding>
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-900/90 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm ring-2 ring-white dark:ring-zinc-800"
              style={{ backgroundColor: friend.color || "#6366f1" }}
            >
              {friend.nickname.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-foreground font-outfit">
                  {friend.nickname}&apos;s Timetable
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-muted-foreground uppercase tracking-wider">
                  {friend.regNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                {friend.classSlots.length} enrolled class slots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleDashboard}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-50/40 dark:bg-zinc-950/50">
          <TimetableGrid attendance={attendanceAdapter} />
        </div>
      </div>
    </Modal>
  );
}

