"use client";

import { QRCodeSVG } from "qrcode.react";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { exportScheduleCode } from "@/lib/socialUtils";

export default function ShareScheduleModal({
  attendanceData,
  onClose,
}) {
  const name = attendanceData?.studentInfo?.name || "Unknown";
  const regNumber = attendanceData?.studentInfo?.regNumber || "0000";
  const attendance = Array.isArray(attendanceData?.attendance) ? attendanceData.attendance : [];
  const code = exportScheduleCode(attendance, name, regNumber);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    alert("Code copied to clipboard!");
  };

  return (
    <Modal onClose={onClose} title="Share Schedule">
      <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-4">
        Share your schedule with friends so they can check your free time.
      </p>

      <div className="bg-white dark:bg-slate-800 midnight:bg-black p-4 rounded-xl shadow-md mb-4 flex justify-center">
        <QRCodeSVG value={code} size={180} />
      </div>

      <div className="bg-gray-50 dark:bg-slate-900/50 midnight:bg-gray-900/50 rounded-xl p-3 mb-4">
        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 midnight:text-gray-400 truncate select-all" title={code}>
          {code.length > 80 ? code.slice(0, 80) + "..." : code}
        </p>
      </div>

      <FetchButton onClick={handleCopy} className="w-full justify-center">
        Copy Code
      </FetchButton>
    </Modal>
  );
}
