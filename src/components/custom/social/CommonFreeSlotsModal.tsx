import BottomSheet from "../shared/BottomSheet";
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
    <BottomSheet onClose={onClose} overlayId="social-common-slots" maxWidth="max-w-5xl">
      <div className="flex flex-col min-h-0 space-y-4">
        <div className="p-4 sm:p-5 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/70">
          <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
            {groupName ? `${groupName} - Common Free Slots` : "Common Free Slots"}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1">
            Comparing your schedule with {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="px-1 pb-1">
          <CommonFreeSlotsGrid myAttendance={myAttendance} friends={friends} />
        </div>
      </div>
    </BottomSheet>
  );
}
