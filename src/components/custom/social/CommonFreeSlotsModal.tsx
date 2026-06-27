import Modal from "../shared/Modal";
import CommonFreeSlotsGrid from "./CommonFreeSlotsGrid";
import { Friend } from "@/lib/socialUtils";

interface CommonFreeSlotsModalProps {
  friends: Friend[];
  myAttendance: any[];
  groupName?: string;
  onClose: () => void;
}

export default function CommonFreeSlotsModal({ friends, myAttendance, groupName, onClose }: CommonFreeSlotsModalProps) {
  return (
    <Modal onClose={onClose} maxWidth="max-w-5xl" noPadding>
      <div className="flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 midnight:border-gray-800 flex items-center justify-between bg-gray-50/30 dark:bg-slate-800/30 midnight:bg-gray-900/30 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
              {groupName ? `${groupName} - Common Free Slots` : "Common Free Slots"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-0.5">
              Comparing your schedule with {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/10 dark:bg-slate-900/10 midnight:bg-black/10">
          <CommonFreeSlotsGrid myAttendance={myAttendance} friends={friends} />
        </div>
      </div>
    </Modal>
  );
}
