import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, X, Check, QrCode } from "lucide-react";
import { exportScheduleCode } from "../../../lib/socialUtils";

export default function ShareScheduleModal({ attendanceData, onClose }) {
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  const hasAttendance =
    attendanceData?.attendance && attendanceData.attendance.length > 0;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !regNo) return;
    const generated = exportScheduleCode(
      attendanceData.attendance,
      name,
      regNo
    );
    setCode(generated);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-500" /> Share My Schedule
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!hasAttendance ? (
            <div className="text-center py-6">
              <p className="text-red-400 font-medium mb-2">No Schedule Data</p>
              <p className="text-sm text-muted-foreground">
                Please make sure your attendance data is loaded before sharing your schedule.
              </p>
            </div>
          ) : !code ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Enter your details to generate a cross-platform schedule code.
                This QR code can be scanned by the fkvit app!
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
                  Your Nickname
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  required
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g. 21BCE1234"
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-medium py-2.5 rounded-xl shadow-lg transition-all mt-2"
              >
                Generate QR Code
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center animate-fadeIn">
              {code.length > 2900 ? (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl shadow-md mb-6 text-center border border-red-200 dark:border-red-800">
                  <p className="text-red-500 font-medium text-sm">Schedule is too large for a QR Code.</p>
                  <p className="text-xs text-red-400 mt-1">Please use the manual copy button below instead.</p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl shadow-md mb-6">
                  <QRCodeSVG
                    value={code}
                    size={200}
                    level="L"
                    includeMargin={false}
                  />
                </div>
              )}
              
              <div className="w-full">
                <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
                  Or share this code manually
                </label>
                <div className="flex bg-background border border-border rounded-xl overflow-hidden shadow-sm">
                  <input
                    type="text"
                    readOnly
                    value={code}
                    className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm text-muted-foreground outline-none font-mono"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground border-l border-border transition-colors flex items-center justify-center flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center mt-6">
                Scanning this with the fkvit mobile app will automatically add you to their friends list!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
