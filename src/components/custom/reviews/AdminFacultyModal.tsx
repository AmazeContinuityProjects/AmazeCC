"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ShieldCheck,
  Search,
  Plus,
  RefreshCw,
  Edit2,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  GitMerge,
  ExternalLink,
  ChevronRight,
  Key,
} from "lucide-react";
import {
  CHIP,
  TILE_CARD,
  SEARCH_FIELD,
} from "@/lib/uiTokens";
import { REVIEWS_API_BASE } from "@/lib/reviewsService";

interface UnmatchedItem {
  id: string;
  raw_name: string;
  school: string | null;
  seen_count: number;
  last_seen_at: string;
}

interface FacultyAdminItem {
  id: string;
  name: string;
  employee_id: string | null;
  school: string | null;
  designation: string | null;
  image_url: string | null;
  status: "official" | "merged" | "hidden";
  merged_into: string | null;
}

export default function AdminFacultyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [adminToken, setAdminToken] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("amaze_admin_token") || "";
    }
    return "";
  });
  const [tokenInput, setTokenInput] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  const [activeTab, setActiveTab] = useState<"unmatched" | "directory" | "recompute">("unmatched");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Unmatched state
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [targetFacultyId, setTargetFacultyId] = useState("");

  // Directory state
  const [facultyList, setFacultyList] = useState<FacultyAdminItem[]>([]);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");
  const [editingFaculty, setEditingFaculty] = useState<FacultyAdminItem | null>(null);

  // New faculty form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFaculty, setNewFaculty] = useState({
    name: "",
    employee_id: "",
    school: "",
    designation: "",
    image_url: "",
  });

  // Recompute state
  const [recomputing, setRecomputing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSaveToken = (val: string) => {
    const trimmed = val.trim();
    setAdminToken(trimmed);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("amaze_admin_token", trimmed);
    }
    if (trimmed) {
      setIsAuthed(true);
    }
  };

  const getHeaders = useCallback(() => {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    };
  }, [adminToken]);

  // Load unmatched list
  const loadUnmatched = useCallback(async () => {
    if (!adminToken) return;
    setLoadingUnmatched(true);
    try {
      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/unmatched`, {
        headers: getHeaders(),
      });
      if (res.status === 401 || res.status === 403) {
        setIsAuthed(false);
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data?.success) {
          setUnmatched(data.unmatched || []);
          setIsAuthed(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUnmatched(false);
    }
  }, [adminToken, getHeaders]);

  // Load directory list
  const loadFaculty = useCallback(async () => {
    if (!adminToken) return;
    setLoadingFaculty(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedSchool) params.set("school", selectedSchool);

      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/faculty?${params.toString()}`, {
        headers: getHeaders(),
      });
      if (res.status === 401 || res.status === 403) {
        setIsAuthed(false);
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data?.success) {
          setFacultyList(data.faculty || []);
          setIsAuthed(true);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFaculty(false);
    }
  }, [adminToken, searchQuery, selectedSchool, getHeaders]);

  useEffect(() => {
    if (isOpen && adminToken) {
      if (activeTab === "unmatched") loadUnmatched();
      else if (activeTab === "directory") loadFaculty();
    }
  }, [isOpen, adminToken, activeTab, loadUnmatched, loadFaculty]);

  // Resolve unmatched record
  const handleResolveUnmatched = async (
    item: UnmatchedItem,
    action: "link" | "create"
  ) => {
    try {
      let body: any = { unmatched_id: item.id };
      if (action === "link") {
        if (!targetFacultyId.trim()) {
          setStatusMsg({ text: "Please enter a target faculty UUID or ID", type: "error" });
          return;
        }
        body.target_faculty_id = targetFacultyId.trim();
      } else {
        body.create_faculty = {
          name: item.raw_name,
          school: item.school || "SCOPE",
        };
      }

      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/unmatched/resolve`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any = null;
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => null);
      }
      if (data?.success) {
        setStatusMsg({ text: `Resolved "${item.raw_name}" successfully`, type: "success" });
        setResolvingId(null);
        setTargetFacultyId("");
        loadUnmatched();
      } else {
        setStatusMsg({ text: data?.error || `Failed to resolve (status: ${res.status})`, type: "error" });
      }
    } catch (e) {
      setStatusMsg({ text: "Network error resolving unmatched faculty", type: "error" });
    }
  };

  // Create new faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaculty.name.trim()) return;

    try {
      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/faculty`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          name: newFaculty.name.trim(),
          employee_id: newFaculty.employee_id.trim() || null,
          school: newFaculty.school.trim() || null,
          designation: newFaculty.designation.trim() || null,
          image_url: newFaculty.image_url.trim() || null,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any = null;
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => null);
      }
      if (data?.success) {
        setStatusMsg({ text: `Faculty "${newFaculty.name}" added successfully`, type: "success" });
        setNewFaculty({ name: "", employee_id: "", school: "", designation: "", image_url: "" });
        setShowAddForm(false);
        loadFaculty();
      } else {
        setStatusMsg({ text: data?.error || `Failed to create faculty (status: ${res.status})`, type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Error creating faculty", type: "error" });
    }
  };

  // Update existing faculty
  const handleUpdateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaculty) return;

    try {
      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/faculty/${editingFaculty.id}`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          name: editingFaculty.name,
          employee_id: editingFaculty.employee_id || null,
          school: editingFaculty.school || null,
          designation: editingFaculty.designation || null,
          status: editingFaculty.status,
          merged_into: editingFaculty.merged_into || null,
        }),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any = null;
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => null);
      }
      if (data?.success) {
        setStatusMsg({ text: "Faculty updated successfully", type: "success" });
        setEditingFaculty(null);
        loadFaculty();
      } else {
        setStatusMsg({ text: data?.error || `Failed to update (status: ${res.status})`, type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Network error updating faculty", type: "error" });
    }
  };

  // Trigger snapshot recomputation
  const handleTriggerRecompute = async () => {
    setRecomputing(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${REVIEWS_API_BASE}/api/admin/reviews/recompute`, {
        method: "POST",
        headers: getHeaders(),
      });
      const ct = res.headers.get("content-type") || "";
      let data: any = null;
      if (ct.includes("application/json")) {
        data = await res.json().catch(() => null);
      }
      if (data?.success) {
        setStatusMsg({
          text: `Snapshot recomputed successfully (${data.faculty_count || "all"} faculty updated)`,
          type: "success",
        });
      } else {
        setStatusMsg({ text: data?.error || `Recompute failed (status: ${res.status})`, type: "error" });
      }
    } catch {
      setStatusMsg({ text: "Recompute failed", type: "error" });
    } finally {
      setRecomputing(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface border border-border-strong rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-muted bg-surface-secondary/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-heading">Faculty Moderation & Directory</h2>
              <p className="text-xs text-text-muted">Admin-only controls (no student creation)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-heading hover:bg-surface-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast Banner */}
        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
              statusMsg.type === "success"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20"
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-b border-rose-500/20"
            }`}
          >
            <span>{statusMsg.text}</span>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-xs font-bold underline opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Auth Bar if token is missing */}
          {!adminToken || !isAuthed ? (
            <div className={`${TILE_CARD} border border-border-strong p-6 space-y-4`}>
              <div className="flex items-center gap-3">
                <Key className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-text-heading">Admin Authorization Required</h3>
                  <p className="text-xs text-text-muted">
                    Enter your AmazeCC admin token to manage faculty and resolve unmatched entries.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste admin token..."
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className={`${SEARCH_FIELD} flex-1`}
                />
                <button
                  onClick={() => handleSaveToken(tokenInput)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  Verify
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-border-muted pb-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("unmatched")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      activeTab === "unmatched"
                        ? "bg-indigo-600 text-white"
                        : "bg-surface-secondary text-text-muted hover:text-text-heading"
                    }`}
                  >
                    Unmatched Timetables ({unmatched.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("directory")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      activeTab === "directory"
                        ? "bg-indigo-600 text-white"
                        : "bg-surface-secondary text-text-muted hover:text-text-heading"
                    }`}
                  >
                    Faculty Directory
                  </button>
                  <button
                    onClick={() => setActiveTab("recompute")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      activeTab === "recompute"
                        ? "bg-indigo-600 text-white"
                        : "bg-surface-secondary text-text-muted hover:text-text-heading"
                    }`}
                  >
                    Recompute Snapshots
                  </button>
                </div>

                <button
                  onClick={() => handleSaveToken("")}
                  className="text-[11px] font-semibold text-text-muted hover:text-rose-500 transition-colors"
                >
                  Clear Key
                </button>
              </div>

              {/* Tab 1: Unmatched */}
              {activeTab === "unmatched" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-text-heading uppercase tracking-wider">
                        Unmatched Timetable Entries
                      </h4>
                      <p className="text-xs text-text-muted">
                        Names seen in student timetables that didn't match existing official faculty.
                      </p>
                    </div>
                    <button
                      onClick={loadUnmatched}
                      disabled={loadingUnmatched}
                      className="p-2 rounded-xl bg-surface-secondary hover:bg-surface-secondary/80 text-text-muted hover:text-text-heading transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingUnmatched ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  {unmatched.length === 0 ? (
                    <div className="py-12 text-center text-xs text-text-muted border border-dashed border-border-muted rounded-2xl">
                      No unresolved unmatched faculty entries. All student timetables match clean records!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unmatched.map((item) => (
                        <div
                          key={item.id}
                          className={`${TILE_CARD} border border-border-muted p-4 space-y-3`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-text-heading">{item.raw_name}</span>
                                {item.school && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-500 font-bold">
                                    {item.school}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">
                                Seen {item.seen_count} time{item.seen_count === 1 ? "" : "s"} &bull; Last seen{" "}
                                {new Date(item.last_seen_at).toLocaleDateString()}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResolveUnmatched(item, "create")}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors"
                              >
                                Auto-Create
                              </button>
                              <button
                                onClick={() =>
                                  setResolvingId(resolvingId === item.id ? null : item.id)
                                }
                                className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-colors"
                              >
                                Merge to Existing
                              </button>
                            </div>
                          </div>

                          {resolvingId === item.id && (
                            <div className="pt-3 border-t border-border-muted flex gap-2">
                              <input
                                type="text"
                                placeholder="Target faculty UUID or Employee ID..."
                                value={targetFacultyId}
                                onChange={(e) => setTargetFacultyId(e.target.value)}
                                className={`${SEARCH_FIELD} flex-1`}
                              />
                              <button
                                onClick={() => handleResolveUnmatched(item, "link")}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                              >
                                Confirm Link
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Directory & Management */}
              {activeTab === "directory" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex gap-2 flex-1">
                      <input
                        type="text"
                        placeholder="Search by name or employee ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`${SEARCH_FIELD} flex-1`}
                      />
                      <button
                        onClick={loadFaculty}
                        className="px-4 py-2 bg-surface-secondary text-text-heading rounded-xl text-xs font-bold"
                      >
                        Search
                      </button>
                    </div>

                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Add Faculty
                    </button>
                  </div>

                  {/* Add Faculty Form */}
                  {showAddForm && (
                    <form
                      onSubmit={handleCreateFaculty}
                      className={`${TILE_CARD} border border-indigo-500/30 p-5 space-y-4 bg-indigo-500/5`}
                    >
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500">
                        Add New Faculty Member
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Full Name (e.g. Dr. John Doe)"
                          value={newFaculty.name}
                          onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                          className={SEARCH_FIELD}
                        />
                        <input
                          type="text"
                          placeholder="Employee ID (e.g. 10245)"
                          value={newFaculty.employee_id}
                          onChange={(e) =>
                            setNewFaculty({ ...newFaculty, employee_id: e.target.value })
                          }
                          className={SEARCH_FIELD}
                        />
                        <input
                          type="text"
                          placeholder="School (e.g. SCOPE, SENSE)"
                          value={newFaculty.school}
                          onChange={(e) => setNewFaculty({ ...newFaculty, school: e.target.value })}
                          className={SEARCH_FIELD}
                        />
                        <input
                          type="text"
                          placeholder="Designation (e.g. Associate Professor)"
                          value={newFaculty.designation}
                          onChange={(e) =>
                            setNewFaculty({ ...newFaculty, designation: e.target.value })
                          }
                          className={SEARCH_FIELD}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-3 py-1.5 text-xs text-text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
                        >
                          Save Faculty
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Edit Faculty Modal / Inline */}
                  {editingFaculty && (
                    <form
                      onSubmit={handleUpdateFaculty}
                      className={`${TILE_CARD} border border-amber-500/30 p-5 space-y-4 bg-amber-500/5`}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                          Edit Faculty: {editingFaculty.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setEditingFaculty(null)}
                          className="text-text-muted hover:text-text-heading text-xs"
                        >
                          Close
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          value={editingFaculty.name}
                          onChange={(e) =>
                            setEditingFaculty({ ...editingFaculty, name: e.target.value })
                          }
                          className={SEARCH_FIELD}
                        />
                        <input
                          type="text"
                          placeholder="Employee ID"
                          value={editingFaculty.employee_id || ""}
                          onChange={(e) =>
                            setEditingFaculty({
                              ...editingFaculty,
                              employee_id: e.target.value || null,
                            })
                          }
                          className={SEARCH_FIELD}
                        />
                        <input
                          type="text"
                          placeholder="School"
                          value={editingFaculty.school || ""}
                          onChange={(e) =>
                            setEditingFaculty({ ...editingFaculty, school: e.target.value || null })
                          }
                          className={SEARCH_FIELD}
                        />
                        <select
                          value={editingFaculty.status}
                          onChange={(e: any) =>
                            setEditingFaculty({
                              ...editingFaculty,
                              status: e.target.value,
                            })
                          }
                          className={`${SEARCH_FIELD} py-2`}
                        >
                          <option value="official">Official (Active)</option>
                          <option value="hidden">Hidden</option>
                          <option value="merged">Merged</option>
                        </select>
                      </div>
                      {editingFaculty.status === "merged" && (
                        <input
                          type="text"
                          placeholder="Target UUID to merge into..."
                          value={editingFaculty.merged_into || ""}
                          onChange={(e) =>
                            setEditingFaculty({
                              ...editingFaculty,
                              merged_into: e.target.value || null,
                            })
                          }
                          className={SEARCH_FIELD}
                        />
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingFaculty(null)}
                          className="px-3 py-1.5 text-xs text-text-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Faculty Records List */}
                  {facultyList.length === 0 ? (
                    <div className="py-8 text-center text-xs text-text-muted">
                      {loadingFaculty ? "Loading faculty records..." : "No faculty found for query."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {facultyList.map((fac) => (
                        <div
                          key={fac.id}
                          className={`${TILE_CARD} border border-border-muted p-3.5 flex items-center justify-between`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text-heading">{fac.name}</span>
                              {fac.school && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-secondary text-text-muted font-bold">
                                  {fac.school}
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                  fac.status === "official"
                                    ? "bg-emerald-500/10 text-emerald-500"
                                    : fac.status === "hidden"
                                    ? "bg-rose-500/10 text-rose-500"
                                    : "bg-amber-500/10 text-amber-500"
                                }`}
                              >
                                {fac.status}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                              ID: {fac.employee_id || "Unset"} &bull; {fac.designation || "Faculty"}
                            </p>
                          </div>

                          <button
                            onClick={() => setEditingFaculty(fac)}
                            className="p-2 rounded-xl bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading transition-colors"
                            title="Edit faculty"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Recompute Snapshots */}
              {activeTab === "recompute" && (
                <div className={`${TILE_CARD} border border-border-muted p-6 space-y-4`}>
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-indigo-500 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-text-heading">Snapshot Recomputation</h4>
                      <p className="text-xs text-text-muted">
                        Manually trigger the Bayesian shrinkage, weights and snapshot engine across all
                        reviews and write new aggregates.
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed">
                    Under normal operation, this scheduled job runs every 5 to 10 minutes in the
                    background. Triggering it manually refreshes edge KV snapshots immediately.
                  </p>

                  <button
                    onClick={handleTriggerRecompute}
                    disabled={recomputing}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${recomputing ? "animate-spin" : ""}`} />
                    <span>{recomputing ? "Recomputing Aggregates..." : "Run Recompute Now"}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
