import React from "react";
import { X, Calendar } from "lucide-react";
import CommonFreeSlotsGrid from "./CommonFreeSlotsGrid";
import { Friend } from "../../../lib/socialUtils";

interface CommonFreeSlotsModalProps {
  friends: Friend[];
  myAttendance: any[];
  groupName?: string;
  onClose: () => void;
}

export default function CommonFreeSlotsModal({ friends, myAttendance, groupName, onClose }: CommonFreeSlotsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden relative">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              {groupName ? `${groupName} - Common Free Slots` : "Common Free Slots"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparing your schedule with {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-muted/10">
          <CommonFreeSlotsGrid myAttendance={myAttendance} friends={friends} />
        </div>
      </div>
    </div>
  );
}
