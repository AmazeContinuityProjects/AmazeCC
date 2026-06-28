import Modal from "../shared/Modal";
import TimetableGrid from "../attendance/TimetableGrid";
import { Friend } from "@/lib/socialUtils";

interface FriendTimetableModalProps {
  friend: Friend;
  onClose: () => void;
}

export default function FriendTimetableModal({ friend, onClose }: FriendTimetableModalProps) {
  const attendanceAdapter = friend.classSlots.map((slot) => ({
    slotName: slot.slotId,
    courseTitle: slot.courseTitle,
  }));

  return (
    <Modal onClose={onClose} maxWidth="max-w-5xl" noPadding>
      <div className="flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200  dark:border-gray-800 flex items-center justify-between bg-gray-50/30  dark:bg-gray-900/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-inner"
              style={{ backgroundColor: friend.color }}
            >
              {friend.nickname.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100">
                {friend.nickname}&apos;s Schedule
              </h2>
              <p className="text-xs text-gray-500  dark:text-gray-400">{friend.regNumber}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/10  dark:bg-black/10">
          <TimetableGrid attendance={attendanceAdapter} />
        </div>
      </div>
    </Modal>
  );
}
