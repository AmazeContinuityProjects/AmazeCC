import React from "react";
import { X, Calendar } from "lucide-react";
import TimetableGrid from "../attendance/TimetableGrid";
import { Friend } from "../../../lib/socialUtils";

interface FriendTimetableModalProps {
  friend: Friend;
  onClose: () => void;
}

export default function FriendTimetableModal({ friend, onClose }: FriendTimetableModalProps) {
  // Convert friend's classSlots to the format expected by TimetableGrid
  // TimetableGrid expects an array of objects with { slotName, courseTitle }
  const attendanceAdapter = friend.classSlots.map((slot) => ({
    slotName: slot.slotId,
    courseTitle: slot.courseTitle,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner"
              style={{ backgroundColor: friend.color }}
            >
              {friend.nickname.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                {friend.nickname}'s Schedule
              </h2>
              <p className="text-xs text-muted-foreground">{friend.regNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
          <TimetableGrid attendance={attendanceAdapter} />
        </div>
      </div>
    </div>
  );
}
