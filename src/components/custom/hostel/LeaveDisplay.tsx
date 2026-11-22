"use client";

import { useState } from "react";
import {
  RefreshCcw,
  Calendar,
  Info,
  PlusCircle,
  AlertCircle,
  Clock,
  FileText,
  Check,
  Copy,
  ExternalLink,
  Phone,
} from "lucide-react";
import { Button } from "@amazecontinuityprojects/amazeui";
import BottomSheet from "../shared/BottomSheet";
import { AnimatePresence } from "framer-motion";
import SelectField from "../shared/primitives/SelectField";
import {
  BADGE_MD,
  FIELD_INPUT,
  FOCUS_RING,
  GHOST_BUTTON,
  ICON_WELL,
  MICRO_LABEL,
  OPTION_PICKER_TRIGGER,
  PRIMARY_BUTTON,
  SECTION_TITLE,
  TEXT_CAPTION,
  TILE_CARD,
  TONE_ICON_TILE,
  TONE_TEXT,
} from "@/lib/uiTokens";
import { HOSTEL_CONTACTS, HOSTEL_CONTACT_CAVEAT, VTOP_HOSTEL_URL } from "./hostelContactData";

interface LeaveDisplayProps {
  leaveData: any[];
  handleHostelDetailsFetch: () => void;
}

type LeaveForm = {
  type: string;
  from: string;
  to: string;
  place: string;
  reason: string;
};

const EMPTY_FORM: LeaveForm = { type: "Outing", from: "", to: "", place: "", reason: "" };

/** Readable summary put on the clipboard when VTOP cannot be prefilled. */
function leaveDetailsText(f: LeaveForm) {
  const typeLabel: Record<string, string> = {
    Outing: "Non-working Day Outing",
    Home: "Home Leave",
    Emergency: "Emergency Leave",
  };
  return [
    "Leave / outing request (prepared in AmazeCC — submit on VTOP)",
    `Type: ${typeLabel[f.type] || f.type}`,
    `From: ${f.from}`,
    `To: ${f.to}`,
    `Place of visit: ${f.place}`,
    `Reason: ${f.reason}`,
  ].join("\n");
}

export default function LeaveDisplay({ leaveData, handleHostelDetailsFetch }: LeaveDisplayProps) {
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState<LeaveForm>(EMPTY_FORM);
  /** The prepared (not submitted) request shown in the result panel. */
  const [prepared, setPrepared] = useState<LeaveForm | null>(null);
  const [copied, setCopied] = useState(false);

  if (!leaveData || leaveData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
        <p className="text-sm font-medium">No leave history available in VTOP database.</p>
        <button onClick={handleHostelDetailsFetch} className={`mt-4 ${PRIMARY_BUTTON} ${FOCUS_RING}`}>
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
    return (from <= now && now <= to) || from > now || (daysSinceEnd > 0 && daysSinceEnd <= 3);
  });

  const pastLeaves = leaveData.filter((leave) => !activeLeaves.includes(leave));

  // Pending leaves
  const pendingLeaves = leaveData.filter((leave) => leave.status?.toUpperCase().includes("PENDING"));

  const getStatusColor = (status: string) => {
    if (!status) return "bg-surface-tertiary text-text-muted border-border-muted";
    const norm = status.toUpperCase().trim();
    if (norm.includes("APPROVED") || norm.includes("CLOSED")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (norm.includes("PENDING")) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    if (norm.includes("CANCELLED")) {
      return "bg-surface-tertiary text-text-secondary border-border-muted";
    }
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  };

  /** Prepare the request in-app. Submission stays on VTOP (session tokens). */
  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPrepared({ ...applyForm });
    setCopied(false);
  };

  const handleCopyDetails = async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard?.writeText(leaveDetailsText(prepared));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  /** Closing never clears `applyForm`, so the draft is retained. */
  const closeSheet = () => {
    setShowApplyModal(false);
    setPrepared(null);
    setCopied(false);
  };

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border-muted">
        <div>
          <h1 className="text-xl md:text-3xl font-black font-outfit tracking-tight text-text-heading">
            Leave Management
          </h1>
          <p className={`${TEXT_CAPTION} font-medium mt-1`}>
            File outings, check leave approvals, and inspect past leaves timeline.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button
            onClick={() => setShowApplyModal(true)}
            className={`flex-1 sm:flex-initial ${PRIMARY_BUTTON} text-xs px-3.5 py-2`}
          >
            <PlusCircle size={14} /> Apply Outing / Leave
          </Button>

          <button
            onClick={handleHostelDetailsFetch}
            className={`${GHOST_BUTTON} p-2.5 ${FOCUS_RING}`}
            title="Reload data"
            aria-label="Reload leave data"
          >
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* Leave Status & Overview dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left pane: Active Leave & Pending */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Leave details */}
          <div className={`${TILE_CARD} space-y-4`}>
            <h3 className={MICRO_LABEL}>Active / Upcoming Outing</h3>

            {activeLeaves.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-5 h-5 ${TONE_TEXT.sky}`} />
                    <span className="text-sm font-bold text-text-heading">{activeLeaves[0].leaveType}</span>
                  </div>
                  <span className={`${BADGE_MD} ${getStatusColor(activeLeaves[0].status)}`}>
                    {activeLeaves[0].status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-surface-secondary border border-border-muted p-4 rounded-2xl">
                  <div>
                    <span className={`${MICRO_LABEL} block mb-0.5`}>Leave ID</span>
                    <span className="tabular-nums font-semibold text-text-primary">{activeLeaves[0].leaveId}</span>
                  </div>
                  <div>
                    <span className={`${MICRO_LABEL} block mb-0.5`}>Destination Place</span>
                    <span className="font-semibold text-text-primary">{activeLeaves[0].visitPlace}</span>
                  </div>
                  <div>
                    <span className={`${MICRO_LABEL} block mb-0.5`}>Departure Date</span>
                    <span className="tabular-nums font-semibold text-text-primary">{activeLeaves[0].from}</span>
                  </div>
                  <div>
                    <span className={`${MICRO_LABEL} block mb-0.5`}>Arrival Date</span>
                    <span className="tabular-nums font-semibold text-text-primary">{activeLeaves[0].to}</span>
                  </div>
                </div>

                <div className="text-xs text-text-secondary">
                  <strong className={`${MICRO_LABEL} block mb-1`}>Reason</strong>
                  <p className="text-pretty bg-surface-tertiary p-3 rounded-xl border border-border-muted leading-relaxed">
                    {activeLeaves[0].reason}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-center text-text-muted">
                <Info size={28} className="mb-2" />
                <p className="text-xs">
                  No active leave or outing found. Access the apply button if you plan to leave campus.
                </p>
              </div>
            )}
          </div>

          {/* Pending requests list */}
          <div className={`${TILE_CARD} space-y-4`}>
            <h3 className={MICRO_LABEL}>Pending Approvals</h3>

            {pendingLeaves.length > 0 ? (
              <div className="divide-y divide-border-muted">
                {pendingLeaves.map((leave, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-xs gap-3">
                    <div>
                      <p className="font-bold text-text-primary">{leave.leaveType}</p>
                      <p className="tabular-nums text-text-muted mt-0.5">Departure: {leave.from}</p>
                    </div>
                    <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase font-extrabold text-xs">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic py-2">
                No leave applications are currently pending warden approval.
              </p>
            )}
          </div>
        </div>

        {/* Right pane: Outing Guidelines & Emergency Outing Contacts */}
        <div className="space-y-6">
          {/* Outing Guidelines */}
          <div className={`${TILE_CARD} space-y-3`}>
            <span className={MICRO_LABEL}>Outing Rules &amp; Deadlines</span>
            <div className="space-y-2 text-xs text-text-secondary">
              <div className="flex gap-2">
                <Clock size={14} className="shrink-0 mt-0.5 text-sky-500" />
                <p>
                  <strong>In-Time deadline:</strong> Outing return deadline is strictly 8:30 PM.
                </p>
              </div>
              <div className="flex gap-2">
                <FileText size={14} className="shrink-0 mt-0.5 text-sky-500" />
                <p>
                  <strong>Prior application:</strong> Submit leave requests 24 hours prior to departure.
                </p>
              </div>
              <div className="flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-sky-500" />
                <p>
                  <strong>Parent approval:</strong> Automated parent approval SMS/Email verification required for Home
                  leaves.
                </p>
              </div>
            </div>
          </div>

          {/* Emergency contacts */}
          <div className={`${TILE_CARD} space-y-3`}>
            <span className={MICRO_LABEL}>Outing Emergency Contacts</span>
            <p className="text-xs text-text-muted">{HOSTEL_CONTACT_CAVEAT}</p>
            <div className="space-y-2 text-xs text-text-primary">
              {[HOSTEL_CONTACTS.phones.gateOutingDesk, HOSTEL_CONTACTS.phones.wardenOutingCell].map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={12} className="text-text-muted" />
                    {c.label}:
                  </span>
                  <a href={`tel:${c.tel}`} className="font-semibold text-sky-600 dark:text-sky-400 hover:underline">
                    {c.display}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Leave History Vertical Timeline */}
      {pastLeaves.length > 0 && (
        <div className={`${TILE_CARD} space-y-6`}>
          <h3 className={MICRO_LABEL}>Past Leave History Timeline</h3>

          <div className="relative pl-6 border-l-2 border-border-muted space-y-6 ml-2.5">
            {pastLeaves.map((leave, idx) => {
              const statusColor = getStatusColor(leave.status);
              return (
                <div key={idx} className="relative">
                  {/* Timeline bullet indicator */}
                  <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-surface border-2 border-sky-500" />

                  <div className="bg-surface-secondary border border-border-muted p-4 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-text-heading block">{leave.leaveType}</span>
                        <span className="tabular-nums text-text-muted block mt-0.5">Leave ID: {leave.leaveId}</span>
                      </div>
                      <span className={`${BADGE_MD} ${statusColor}`}>{leave.status || "Closed"}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs border-t border-border-muted pt-3">
                      <div>
                        <span className={`${MICRO_LABEL} block`}>Departure</span>
                        <span className="tabular-nums font-semibold text-text-secondary">{leave.from}</span>
                      </div>
                      <div>
                        <span className={`${MICRO_LABEL} block`}>Arrival</span>
                        <span className="tabular-nums font-semibold text-text-secondary">{leave.to}</span>
                      </div>
                      <div>
                        <span className={`${MICRO_LABEL} block`}>Destination</span>
                        <span className="font-semibold text-text-secondary truncate block">{leave.visitPlace}</span>
                      </div>
                    </div>

                    {leave.reason && (
                      <div className="text-xs text-text-secondary pt-2 border-t border-border-muted">
                        <strong className={`${MICRO_LABEL} block mb-0.5`}>Reason</strong>
                        <p className="text-pretty leading-relaxed">{leave.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apply Leave Sheet */}
      <AnimatePresence>
        {showApplyModal && (
          <BottomSheet
            onClose={closeSheet}
            overlayId="hostel-apply-leave"
            maxWidth="max-w-md"
            title="File Outing / Leave"
            closeLabel="Close leave form"
          >
            {prepared ? (
              /* ── In-app result panel: no alert(), VTOP still submits ── */
              <div className="space-y-4 text-sm pt-1" role="status" aria-live="polite">
                <div className={`${ICON_WELL} ${TONE_ICON_TILE.emerald}`}>
                  <Check size={20} />
                </div>
                <div className="space-y-1">
                  <h3 className={SECTION_TITLE}>Request prepared — VTOP must submit it</h3>
                  <p className={`${TEXT_CAPTION} font-medium`}>
                    AmazeCC has prepared the details below. Direct submission is restricted by VTOP session tokens, so
                    open VTOP to file the request. Your draft stays here if you close this sheet.
                  </p>
                </div>

                <div className="rounded-2xl border border-border-muted bg-surface-secondary p-4 space-y-2 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Type</span>
                    <span className="font-bold text-text-primary text-right">{prepared.type}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">From</span>
                    <span className="font-bold text-text-primary tabular-nums text-right">{prepared.from}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">To</span>
                    <span className="font-bold text-text-primary tabular-nums text-right">{prepared.to}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Place</span>
                    <span className="font-bold text-text-primary text-right">{prepared.place}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Reason</span>
                    <span className="font-bold text-text-primary text-right max-w-[65%]">{prepared.reason}</span>
                  </div>
                </div>

                {/* Prefilled VTOP link carries the request details as query params;
                  the copy fallback below is the reliable path if VTOP ignores them. */}
                <a
                  href={`${VTOP_HOSTEL_URL}?module=hostel&leaveType=${encodeURIComponent(prepared.type)}&from=${encodeURIComponent(prepared.from)}&to=${encodeURIComponent(prepared.to)}&place=${encodeURIComponent(prepared.place)}&reason=${encodeURIComponent(prepared.reason)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${PRIMARY_BUTTON} w-full justify-center ${FOCUS_RING}`}
                >
                  Open VTOP with details
                  <ExternalLink size={14} />
                </a>

                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className={`${GHOST_BUTTON} w-full justify-center ${FOCUS_RING}`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Details copied" : "Copy details instead"}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrepared(null);
                      setCopied(false);
                    }}
                    className={`${GHOST_BUTTON} flex-1 justify-center ${FOCUS_RING}`}
                  >
                    Edit request
                  </button>
                  <button
                    type="button"
                    onClick={closeSheet}
                    className={`${GHOST_BUTTON} flex-1 justify-center ${FOCUS_RING}`}
                  >
                    Done — keep draft
                  </button>
                </div>
                <p className="text-xs text-text-muted text-center">
                  Return here any time — closing keeps what you typed.
                </p>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="space-y-4 text-xs pt-1">
                <div className="space-y-1">
                  <label className="font-bold text-text-secondary">Leave / Outing Type</label>
                  <SelectField
                    value={applyForm.type}
                    onChange={(val) => setApplyForm((prev) => ({ ...prev, type: val }))}
                    options={[
                      { value: "Outing", label: "Non-working Day Outing" },
                      { value: "Home", label: "Home Leave" },
                      { value: "Emergency", label: "Emergency Leave" },
                    ]}
                    searchable={false}
                    stacked
                    role="group"
                    aria-label="Leave type"
                    className={OPTION_PICKER_TRIGGER}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="leave-from" className="font-bold text-text-secondary">
                      From Date / Time
                    </label>
                    <input
                      id="leave-from"
                      type="datetime-local"
                      value={applyForm.from}
                      onChange={(e) => setApplyForm((prev) => ({ ...prev, from: e.target.value }))}
                      className={FIELD_INPUT}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="leave-to" className="font-bold text-text-secondary">
                      To Date / Time
                    </label>
                    <input
                      id="leave-to"
                      type="datetime-local"
                      value={applyForm.to}
                      onChange={(e) => setApplyForm((prev) => ({ ...prev, to: e.target.value }))}
                      className={FIELD_INPUT}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="leave-place" className="font-bold text-text-secondary">
                    Place of Visit
                  </label>
                  <input
                    id="leave-place"
                    type="text"
                    placeholder="Chennai, etc."
                    value={applyForm.place}
                    onChange={(e) => setApplyForm((prev) => ({ ...prev, place: e.target.value }))}
                    className={FIELD_INPUT}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="leave-reason" className="font-bold text-text-secondary">
                    Reason
                  </label>
                  <textarea
                    id="leave-reason"
                    rows={3}
                    placeholder="State your reason clearly..."
                    value={applyForm.reason}
                    onChange={(e) => setApplyForm((prev) => ({ ...prev, reason: e.target.value }))}
                    className={`${FIELD_INPUT} h-auto`}
                    required
                  />
                </div>

                <Button type="submit" className={`w-full ${PRIMARY_BUTTON} justify-center font-bold`}>
                  Prepare Request
                </Button>
              </form>
            )}
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
