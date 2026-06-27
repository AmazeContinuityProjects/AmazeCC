"use client";

import { useState } from "react";
import { RefreshCcw, Calendar, MapPin, ClipboardList, Info, Phone, PlusCircle, CheckCircle2, AlertCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaveDisplayProps {
  leaveData: any[];
  handleHostelDetailsFetch: () => void;
}

export default function LeaveDisplay({ leaveData, handleHostelDetailsFetch }: LeaveDisplayProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    type: "Outing",
    from: "",
    to: "",
    place: "",
    reason: ""
  });

  if (!leaveData || leaveData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm font-medium">No leave history available in VTOP database.</p>
        <button
          onClick={handleHostelDetailsFetch}
          className="mt-4 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors flex items-center gap-2"
        >
          <RefreshCcw className="w-4 h-4" /> Reload Data
        </button>
      </div>
    );
  }

  const parseDate = (dateStr: string) => {
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      return new Date(Number(year), month, parseInt(day));
    }
    return new Date(dateStr);
  };

  const now = new Date();

  // Active / Upcoming / Recent leaves (last 3 days)
  const activeLeaves = leaveData.filter((leave) => {
    const from = parseDate(leave.from);
    const to = parseDate(leave.to);
    const daysSinceEnd = (now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24);
    return (
      (from <= now && now <= to) ||
      from > now ||
      (daysSinceEnd > 0 && daysSinceEnd <= 3)
    );
  });

  const pastLeaves = leaveData.filter((leave) => !activeLeaves.includes(leave));
  
  // Pending leaves
  const pendingLeaves = leaveData.filter(leave => 
    leave.status?.toUpperCase().includes("PENDING")
  );

  const getStatusColor = (status: string) => {
    if (!status) return "bg-gray-550/20 text-gray-400 border-gray-500/10";
    const norm = status.toUpperCase().trim();
    if (norm.includes("APPROVED") || norm.includes("CLOSED")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/15";
    }
    if (norm.includes("PENDING")) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/15 animate-pulse";
    }
    if (norm.includes("CANCELLED")) {
      return "bg-gray-500/10 text-gray-450 border-gray-500/15";
    }
    return "bg-rose-500/10 text-rose-400 border-rose-500/15";
  };

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Leave request simulation successful! Direct submission is restricted by VTOP session tokens; please complete registration via the VTOP Portal.");
    setShowApplyModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Leave Management</h1>
          <p className="text-xs text-gray-550 dark:text-gray-400 mt-1">File outings, check leave approvals, and inspect past leaves timeline.</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            onClick={() => setShowApplyModal(true)}
            className="flex-1 sm:flex-initial bg-sky-500 hover:bg-sky-600 text-white text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5"
          >
            <PlusCircle size={14} /> Apply Outing / Leave
          </Button>
          
          <button
            onClick={handleHostelDetailsFetch}
            className="p-2 border border-gray-250 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
            title="Reload data"
          >
            <RefreshCcw size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Leave Status & Overview dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left pane: Active Leave & Pending */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Leave details */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Active / Upcoming Outing</h3>
            
            {activeLeaves.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-sky-400" />
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{activeLeaves[0].leaveType}</span>
                  </div>
                  <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full uppercase ${getStatusColor(activeLeaves[0].status)}`}>
                    {activeLeaves[0].status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50/50 dark:bg-slate-850/30 border border-gray-150 dark:border-gray-800/80 p-4 rounded-xl">
                  <div>
                    <span className="text-gray-450 block mb-0.5 text-[10px]">Leave ID</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{activeLeaves[0].leaveId}</span>
                  </div>
                  <div>
                    <span className="text-gray-450 block mb-0.5 text-[10px]">Destination Place</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{activeLeaves[0].visitPlace}</span>
                  </div>
                  <div>
                    <span className="text-gray-450 block mb-0.5 text-[10px]">Departure Date</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{activeLeaves[0].from}</span>
                  </div>
                  <div>
                    <span className="text-gray-450 block mb-0.5 text-[10px]">Arrival Date</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{activeLeaves[0].to}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-700 dark:text-gray-300">
                  <strong className="text-gray-400 block mb-1 text-[10px] uppercase font-bold">Reason</strong>
                  <p className="bg-gray-100/30 dark:bg-slate-855/15 p-3 rounded-lg border border-gray-200/50 dark:border-gray-800/40 leading-relaxed">{activeLeaves[0].reason}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-gray-450 dark:text-gray-500">
                <Info size={28} className="mb-2 text-gray-350" />
                <p className="text-xs">No active leave or outing found. Access the apply button if you plan to leave campus.</p>
              </div>
            )}
          </div>

          {/* Pending requests list */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Pending Approvals</h3>
            
            {pendingLeaves.length > 0 ? (
              <div className="divide-y divide-gray-150 dark:divide-gray-850">
                {pendingLeaves.map((leave, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div>
                      <p className="font-bold text-gray-850 dark:text-gray-200">{leave.leaveType}</p>
                      <p className="text-[10px] text-gray-450 mt-0.5">Departure: {leave.from}</p>
                    </div>
                    <span className="text-[9px] font-bold border bg-amber-500/10 text-amber-400 border-amber-500/15 px-2 py-0.5 rounded-full uppercase">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-450 dark:text-gray-500 italic py-2">
                No leave applications are currently pending warden approval.
              </p>
            )}
          </div>

        </div>

        {/* Right pane: Outing Guidelines & Emergency Outing Contacts */}
        <div className="space-y-6">
          
          {/* Outing Guidelines */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Outing Rules & Deadlines</span>
            <div className="space-y-2 text-xs text-gray-650 dark:text-gray-300">
              <div className="flex gap-2">
                <Clock size={14} className="text-sky-450 shrink-0 mt-0.5" />
                <p><strong>In-Time deadline:</strong> Outing return deadline is strictly 8:30 PM.</p>
              </div>
              <div className="flex gap-2">
                <FileText size={14} className="text-sky-450 shrink-0 mt-0.5" />
                <p><strong>Prior application:</strong> Submit leave requests 24 hours prior to departure.</p>
              </div>
              <div className="flex gap-2">
                <AlertCircle size={14} className="text-sky-450 shrink-0 mt-0.5" />
                <p><strong>Parent approval:</strong> Automated parent approval SMS/Email verification required for Home leaves.</p>
              </div>
            </div>
          </div>

          {/* Emergency contacts */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Outing Emergency Contacts</span>
            <div className="space-y-2 text-xs text-gray-750 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span>Gate Outing Desk:</span>
                <a href="tel:+914439931555" className="font-semibold text-sky-400 hover:underline">+91 44 3993 1555</a>
              </div>
              <div className="flex items-center justify-between">
                <span>Warden Outing Cell:</span>
                <a href="tel:+914439931666" className="font-semibold text-sky-400 hover:underline">+91 44 3993 1666</a>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Leave History Vertical Timeline */}
      {pastLeaves.length > 0 && (
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-6 shadow-2xs space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Past Leave History Timeline</h3>
          
          <div className="relative pl-6 border-l-2 border-gray-200 dark:border-gray-800/80 space-y-6 ml-2.5">
            {pastLeaves.map((leave, idx) => {
              const statusColor = getStatusColor(leave.status);
              return (
                <div key={idx} className="relative">
                  {/* Timeline bullet indicator */}
                  <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 dark:bg-black border-2 border-sky-400" />
                  
                  <div className="bg-gray-50/50 dark:bg-slate-850/15 border border-gray-150 dark:border-gray-850/60 p-4 rounded-xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-100 block">{leave.leaveType}</span>
                        <span className="text-[10px] text-gray-450 block mt-0.5">Leave ID: {leave.leaveId}</span>
                      </div>
                      <span className={`text-[9px] font-bold border px-2.5 py-0.5 rounded-full uppercase ${statusColor}`}>
                        {leave.status || "Closed"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs border-t border-gray-150 dark:border-gray-800/60 pt-3">
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Departure</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{leave.from}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Arrival</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{leave.to}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase font-bold">Destination</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300 truncate block">{leave.visitPlace}</span>
                      </div>
                    </div>

                    {leave.reason && (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-150/40 dark:border-gray-850/40">
                        <strong className="text-gray-400 text-[9px] uppercase block mb-0.5">Reason</strong>
                        <p className="leading-relaxed">{leave.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apply Leave Modal simulation */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-gray-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scaleIn">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between bg-slate-950">
              <h4 className="text-sm font-bold text-gray-100 uppercase tracking-wider">File Outing / Leave</h4>
              <button onClick={() => setShowApplyModal(false)} className="text-gray-450 hover:text-white text-xs">Close</button>
            </div>
            
            <form onSubmit={handleApplySubmit} className="p-5 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-gray-300">Leave / Outing Type</label>
                <select
                  value={applyForm.type}
                  onChange={e => setApplyForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full border border-gray-800 bg-slate-950 rounded-lg p-2 text-white"
                >
                  <option value="Outing">Non-working Day Outing</option>
                  <option value="Home">Home Leave</option>
                  <option value="Emergency">Emergency Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">From Date / Time</label>
                  <input
                    type="datetime-local"
                    value={applyForm.from}
                    onChange={e => setApplyForm(prev => ({ ...prev, from: e.target.value }))}
                    className="w-full border border-gray-800 bg-slate-950 rounded-lg p-2 text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">To Date / Time</label>
                  <input
                    type="datetime-local"
                    value={applyForm.to}
                    onChange={e => setApplyForm(prev => ({ ...prev, to: e.target.value }))}
                    className="w-full border border-gray-800 bg-slate-950 rounded-lg p-2 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-300">Place of Visit</label>
                <input
                  type="text"
                  placeholder="Chennai, etc."
                  value={applyForm.place}
                  onChange={e => setApplyForm(prev => ({ ...prev, place: e.target.value }))}
                  className="w-full border border-gray-800 bg-slate-950 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-gray-300">Reason</label>
                <textarea
                  rows={3}
                  placeholder="State your reason clearly..."
                  value={applyForm.reason}
                  onChange={e => setApplyForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-800 bg-slate-950 rounded-lg p-2 text-white"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs py-2 rounded-xl"
              >
                Submit Request
              </Button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
