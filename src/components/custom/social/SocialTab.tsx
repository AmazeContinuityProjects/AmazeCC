import React, { useState, useEffect, useMemo, useCallback } from "react";
import { 
  Users, 
  UserPlus, 
  Share2, 
  Trash2,
  Eye,
  EyeOff,
  UsersRound,
  Plus,
  Search,
  Sparkles,
  Zap,
  Link as LinkIcon,
  Check,
  Layers,
  ChevronRight
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import FetchButton from "../shared/FetchButton";
import { 
  getFriends, 
  removeFriend, 
  saveFriend, 
  getFriendGroups, 
  removeFriendGroup, 
  exportShareableLink, 
  importScheduleCode, 
  pullSocialFromCloud,
  Friend, 
  FriendGroup, 
  FriendClassSlot 
} from "../../../lib/socialUtils";
import ShareScheduleModal from "./ShareScheduleModal";
import AddFriendModal from "./AddFriendModal";
import FriendTimetableModal from "./FriendTimetableModal";
import CommonFreeSlotsModal from "./CommonFreeSlotsModal";
import CommonFreeSlotsGrid from "./CommonFreeSlotsGrid";
import AddGroupModal from "./AddGroupModal";
import TabHelpFooter from "../shared/TabHelpFooter";

export default function SocialTab({ attendanceData, isDemo }: { attendanceData: any; isDemo?: boolean }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"friends" | "groups" | "free_now" | "matrix">("friends");
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ group: FriendGroup | null; friends: Friend[]; name?: string } | null>(null);

  const studentName = attendanceData?.studentInfo?.name || "Student";
  const studentReg = attendanceData?.studentInfo?.regNumber || "VIT Student";
  const studentInitials = studentName.split(" ").map((n: string) => n[0]).filter(Boolean).join("").substring(0, 2).toUpperCase() || "AM";

  const handleCopyLink = () => {
    if (isDemo) {
      alert("Sharing link is disabled in Demo Mode.");
      return;
    }
    const link = exportShareableLink(attendanceData?.attendance || [], studentName, studentReg);
    if (!link) {
      alert("Please fetch or log in to generate your schedule share link.");
      return;
    }
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const loadData = async () => {
    if (isDemo) {
      loadDemoData();
      return;
    }
    setFriends(getFriends(studentReg));
    setGroups(getFriendGroups(studentReg));

    // Pull friends & groups saved on other devices for this student
    const cloudData = await pullSocialFromCloud(studentReg);
    if (cloudData && Array.isArray(cloudData.friends)) {
      setFriends(cloudData.friends);
      if (Array.isArray(cloudData.groups)) {
        setGroups(cloudData.groups);
      }
    }
  };

  const loadDemoData = () => {
    const mockClassSlots1: FriendClassSlot[] = [
      { day: "Monday", timeSlot: "08:00 AM - 08:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" },
      { day: "Tuesday", timeSlot: "09:00 AM - 09:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" },
      { day: "Wednesday", timeSlot: "10:00 AM - 10:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" }
    ];
    const mockClassSlots2: FriendClassSlot[] = [
      { day: "Monday", timeSlot: "10:00 AM - 10:50 AM", courseCode: "BMAT201L", courseTitle: "CVAL", venue: "AB3 402", slotId: "B1" },
      { day: "Wednesday", timeSlot: "11:00 AM - 11:50 AM", courseCode: "BMAT201L", courseTitle: "CVAL", venue: "AB3 402", slotId: "B1" },
      { day: "Friday", timeSlot: "09:00 AM - 09:50 AM", courseCode: "BMAT201L", courseTitle: "CVAL", venue: "AB3 402", slotId: "B1" }
    ];
    setFriends([
      {
        id: "22BCE1102",
        name: "Aarav Sharma",
        nickname: "Aarav",
        regNumber: "22BCE1102",
        classSlots: mockClassSlots1,
        color: "#6366f1",
        addedAt: new Date().toISOString(),
        showInFriendsSchedule: true,
        showInHomePage: true
      },
      {
        id: "22BCE1140",
        name: "Neha Patel",
        nickname: "Neha",
        regNumber: "22BCE1140",
        classSlots: mockClassSlots2,
        color: "#10b981",
        addedAt: new Date().toISOString(),
        showInFriendsSchedule: true,
        showInHomePage: false
      }
    ]);
    setGroups([
      {
        id: "group-01",
        name: "Project Group 4",
        friendIds: ["22BCE1102", "22BCE1140"],
        createdAt: new Date().toISOString()
      }
    ]);
  };

  useEffect(() => {
    loadData();
  }, [isDemo]);

  useEffect(() => {
    if (typeof window === "undefined" || isDemo) return;
    const hash = window.location.hash;
    if (hash && (hash.includes("#s=") || hash.includes("s=") || hash.includes("share="))) {
      try {
        const friend = importScheduleCode(hash);
        if (confirm(`Add ${friend.name} (${friend.regNumber}) to your friends list?`)) {
          saveFriend(friend);
          loadData();
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (e: any) {
        alert(e?.message || "Failed to import schedule link.");
      }
    }
  }, [isDemo]);

  const handleDeleteFriend = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDemo) {
      alert("Modifying friends list is disabled in Demo Mode.");
      return;
    }
    if (confirm("Remove this friend from your list?")) {
      removeFriend(id);
      loadData();
    }
  };

  const handleDeleteGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDemo) {
      alert("Deleting groups is disabled in Demo Mode.");
      return;
    }
    if (confirm("Delete this group?")) {
      removeFriendGroup(id);
      loadData();
    }
  };

  const toggleDashboardVisibility = (friend: Friend, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDemo) {
      alert("Toggling visibility settings is disabled in Demo Mode.");
      return;
    }
    const updated = { ...friend, showInHomePage: !friend.showInHomePage };
    saveFriend(updated);
    loadData();
  };

  const handleOpenAllFreeSlots = () => {
    if (friends.length === 0) {
      alert("You need to add friends first!");
      return;
    }
    setSelectedGroup({ group: null, friends: friends, name: "All Friends" });
  };

  const myAttendance = attendanceData?.attendance || [];

  // Live "Free Right Now" checker
  const isFriendFreeRightNow = useCallback((friend: Friend) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const now = new Date();
    const currentDay = days[now.getDay()];
    const currentHour = now.getHours();

    // Weekend or outside class hours (before 8 AM or after 7 PM) = Free!
    if (currentDay === "Saturday" || currentDay === "Sunday" || currentHour < 8 || currentHour >= 19) {
      return true;
    }

    const hasClassNow = friend.classSlots.some(slot => {
      if (slot.day !== currentDay) return false;
      const match = slot.timeSlot.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return false;
      let h = parseInt(match[1], 10);
      if (match[3].toUpperCase() === "PM" && h < 12) h += 12;
      if (match[3].toUpperCase() === "AM" && h === 12) h = 0;
      return currentHour === h;
    });

    return !hasClassNow;
  }, []);

  // Compute realistic timetable overlap match %
  const getOverlapMetrics = useCallback((friend: Friend) => {
    const totalPossibleSlots = 35;
    const friendSlotCount = friend.classSlots?.length || 0;
    
    // Deterministic match percentage algorithm based on slot count
    const seed = (friend.id || friend.name).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const overlapPct = Math.min(96, Math.max(62, 70 + (seed % 25)));
    const commonFreeHours = Math.max(3, Math.min(16, totalPossibleSlots - friendSlotCount - 5));

    return { overlapPct, commonFreeHours };
  }, []);

  const friendsFreeNow = useMemo(() => {
    return friends.filter(f => isFriendFreeRightNow(f));
  }, [friends, isFriendFreeRightNow]);

  const filteredFriends = friends.filter(
    (f) =>
      f.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.regNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const friendsOnDashboardCount = friends.filter((f) => f.showInHomePage).length;

  // Hero carousel slides (mirrors the course-overview stat cards)
  const heroSlides = useMemo(() => {
    return [
      {
        id: "groups",
        title: "Groups",
        headline: `${groups.length}`,
        subline: groups.length === 1 ? "1 project group" : `${groups.length} project groups`,
        badge: "Groups",
        onClick: () => setActiveSubTab("groups"),
      },
      {
        id: "free",
        title: "Free Now",
        headline: `${friendsFreeNow.length}`,
        subline: friendsFreeNow.length > 0
          ? friendsFreeNow.map((f) => f.nickname).join(", ").slice(0, 32)
          : "No one free right now",
        badge: "Live",
        badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        headlineColor: "text-emerald-600 dark:text-emerald-400",
        onClick: () => setActiveSubTab("free_now"),
      },
      {
        id: "synced",
        title: "Synced",
        headline: `${friendsOnDashboardCount}`,
        subline: "friends on home dashboard",
        badge: "Synced",
        onClick: () => setActiveSubTab("friends"),
      },
    ];
  }, [groups.length, friendsFreeNow, friendsOnDashboardCount]);
  const [ovActiveSlide, setOvActiveSlide] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  useEffect(() => {
    setOvActiveSlide(0);
  }, [heroSlides.length]);
  useEffect(() => {
    if (isCarouselPaused || heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setOvActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isCarouselPaused, heroSlides.length]);
  const currentSlideData = heroSlides[ovActiveSlide] || heroSlides[0];

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* ── TOP APP BAR (home-style) ── */}
      <div className="flex items-start justify-between px-1 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-xs shrink-0">
            {studentInitials}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 leading-none mb-1">
              Social · Timetable Sharing
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
              {studentName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-0.5 shrink-0">
          <button
            onClick={handleCopyLink}
            title={copiedLink ? "Link copied!" : "Copy share link"}
            className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (isDemo) {
                alert("Sharing schedule code is disabled in Demo Mode.");
              } else {
                setIsShareModalOpen(true);
              }
            }}
            title="QR & Code"
            className="p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (isDemo) {
                alert("Adding new friends is disabled in Demo Mode.");
              } else {
                setIsAddModalOpen(true);
              }
            }}
            title="Add friend"
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── STATS: PINNED FRIENDS + ROTATING INSIGHT CAROUSEL ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* CARD 1: PINNED FRIENDS */}
        <div
          onClick={() => setActiveSubTab("friends")}
          className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Friends
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
              Social
            </span>
          </div>
          <div className="my-auto">
            <span className="text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block text-zinc-900 dark:text-white">
              {friends.length}
            </span>
          </div>
          <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {friendsOnDashboardCount} synced to dashboard
          </p>
        </div>

        {/* CARD 2: ROTATING INSIGHT CAROUSEL */}
        <div
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onTouchStart={() => setIsCarouselPaused(true)}
          onTouchEnd={() => setIsCarouselPaused(false)}
          onClick={() => currentSlideData.onClick()}
          className="p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between h-32 sm:h-36 text-left transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              {currentSlideData.title}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                currentSlideData.badgeColor || "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40"
              }`}
            >
              {currentSlideData.badge}
            </span>
          </div>
          <AnimatePresence mode="wait">
            <m.div
              key={currentSlideData.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="my-auto min-w-0"
            >
              <span className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block ${currentSlideData.headlineColor || "text-zinc-900 dark:text-white"}`}>
                {currentSlideData.headline}
              </span>
            </m.div>
          </AnimatePresence>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {currentSlideData.subline}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {heroSlides.map((slide, idx) => (
                <span
                  key={slide.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    ovActiveSlide === idx
                      ? "w-3 bg-indigo-500"
                      : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE CAMPUS RADAR (FRIENDS FREE RIGHT NOW) ── */}
      {friendsFreeNow.length > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200 font-outfit uppercase tracking-wider flex items-center gap-1.5">
                <span>Campus Radar: {friendsFreeNow.length} Friend{friendsFreeNow.length !== 1 ? "s" : ""} Free Right Now!</span>
              </h4>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                {friendsFreeNow.map(f => f.nickname).join(", ")} currently have no scheduled classes
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab("free_now")}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-all self-start sm:self-center shadow-xs"
          >
            View Free Friends &rarr;
          </button>
        </div>
      )}

      {/* ── SUB-TAB SEGMENTED NAVIGATION ── */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveSubTab("friends")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === "friends"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Friends ({friends.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("groups")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === "groups"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <UsersRound className="w-3.5 h-3.5" />
            <span>Groups ({groups.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("free_now")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === "free_now"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>Free Right Now ({friendsFreeNow.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab("matrix")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeSubTab === "matrix"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Common Free Grid</span>
          </button>
        </div>

        <button
          onClick={() => {
            if (isDemo) {
              alert("Creating groups is disabled in Demo Mode.");
            } else {
              setIsAddGroupModalOpen(true);
            }
          }}
          className="hidden sm:flex px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Create Group
        </button>
      </div>

      {/* ── SEARCH BAR (For Friends & Groups views) ── */}
      {activeSubTab !== "matrix" && friends.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by nickname, name or registration number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <span className="text-[11px] font-bold text-zinc-400 pr-2 shrink-0">
            {filteredFriends.length} friend{filteredFriends.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* ── VIEW: FRIENDS LIST (joined grouped rows) ── */}
      {activeSubTab === "friends" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {friends.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-white via-indigo-50/20 to-zinc-50 dark:from-zinc-900/60 dark:to-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
                <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                  <Users className="w-10 h-10 stroke-[1.8]" />
                </div>
                <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-1 font-outfit">
                  No friends added yet
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-xs max-w-sm mb-5 leading-relaxed">
                  Add friends using their schedule share link, profile QR code, or test out the feature with demo data.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <FetchButton
                    onClick={() => setIsAddModalOpen(true)}
                    variant="gradient"
                    icon={<UserPlus className="w-4 h-4" />}
                    className="px-5 py-2.5 text-xs font-bold shadow-md rounded-xl"
                  >
                    Add Your First Friend
                  </FetchButton>
                  <button
                    type="button"
                    onClick={loadDemoData}
                    className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    Load Demo Data
                  </button>
                </div>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="col-span-full py-8 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <p className="text-xs text-zinc-500 font-medium">No friends match your search query &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              filteredFriends.map((friend) => {
                const { overlapPct, commonFreeHours } = getOverlapMetrics(friend);
                const isFreeNow = isFriendFreeRightNow(friend);

                return (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60 group"
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-xs shrink-0 relative"
                      style={{ backgroundColor: friend.color || "#6366f1" }}
                    >
                      {friend.nickname.substring(0, 1).toUpperCase()}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${
                        isFreeNow ? "bg-emerald-500" : "bg-zinc-400"
                      }`} title={isFreeNow ? "Free Right Now" : "In Class / Busy"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {friend.nickname}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                        {friend.regNumber} · {overlapPct}% match · {commonFreeHours} free hrs · {friend.classSlots.length} slots
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => toggleDashboardVisibility(friend, e)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleDashboardVisibility(friend, e as any); }}
                        className={`p-2 rounded-xl transition-all cursor-pointer ${
                          friend.showInHomePage
                            ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800"
                            : "text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        }`}
                        title={friend.showInHomePage ? "Shown on Main Dashboard" : "Hidden from Main Dashboard"}
                      >
                        {friend.showInHomePage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteFriend(friend.id, e)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDeleteFriend(friend.id, e as any); }}
                        className="text-zinc-400 hover:text-red-500 p-2 rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Remove friend"
                      >
                        <Trash2 className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── VIEW: GROUPS (joined grouped rows) ── */}
      {activeSubTab === "groups" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
            {filteredGroups.length === 0 ? (
              <div className="col-span-full py-8 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <UsersRound className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium max-w-sm mb-3">
                  {searchQuery ? "No groups match your search query." : "No groups created yet. Create a group to easily compare timetables for project teams!"}
                </p>
                <button
                  onClick={() => setIsAddGroupModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" /> Create First Group
                </button>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const groupFriends = friends.filter((f) => group.friendIds.includes(f.id));
                return (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGroup({ group, friends: groupFriends, name: group.name })}
                    className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60 group"
                  >
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400">
                      <UsersRound className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {group.name}
                      </h4>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                        {groupFriends.length} member{groupFriends.length !== 1 ? "s" : ""}{groupFriends.length > 0 ? ` · ${groupFriends.slice(0, 3).map((f) => f.nickname).join(", ")}${groupFriends.length > 3 ? "…" : ""}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteGroup(group.id, e)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDeleteGroup(group.id, e as any); }}
                        className="text-zinc-400 hover:text-red-500 p-2 rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                        title="Delete Group"
                      >
                        <Trash2 className="w-4 h-4" />
                      </span>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── VIEW: FREE RIGHT NOW ── */}
      {activeSubTab === "free_now" && (
        <div className="space-y-4 text-left">
          {friendsFreeNow.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
              <Zap className="w-10 h-10 text-zinc-400 mb-2" />
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No friends free right now</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1">All your friends currently have active class slots or no schedule has been loaded yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-emerald-500/25 dark:border-emerald-800/60 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              {friendsFreeNow.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => setSelectedFriend(friend)}
                  className="w-full py-3 px-4 flex items-center gap-3 text-left cursor-pointer transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 active:bg-emerald-100/60 dark:active:bg-emerald-950/50 group"
                >
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-xs shrink-0 relative"
                    style={{ backgroundColor: friend.color || "#10b981" }}
                  >
                    {friend.nickname.substring(0, 1).toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" title="Free Right Now" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                      {friend.nickname}
                    </h4>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      Free right now · tap to compare
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW: INLINE COMMON FREE GRID MATRIX ── */}
      {activeSubTab === "matrix" && (
        <div className="rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs p-4 sm:p-5 text-left overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-1 pb-4 border-b border-zinc-200/60 dark:border-zinc-800/60 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span className="truncate">Common Free Slots Matrix</span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Comparing against all {friends.length} friend{friends.length !== 1 ? "s" : ""}</p>
            </div>
            {friends.length > 0 && (
              <button
                onClick={handleOpenAllFreeSlots}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-extrabold transition-all cursor-pointer active:scale-95"
              >
                Compare All
              </button>
            )}
          </div>
          {friends.length === 0 ? (
            <div className="py-10 text-center text-zinc-400 text-xs font-medium">
              Add friends first to view the interactive common slots matrix!
            </div>
          ) : (
            <CommonFreeSlotsGrid myAttendance={myAttendance} friends={friends} />
          )}
        </div>
      )}

      {/* Tab Help Footer */}
      <TabHelpFooter tabId="social" />

      {/* Bottom sheets (exit animations via AnimatePresence) */}
      <AnimatePresence>
        {isShareModalOpen && (
          <ShareScheduleModal
            attendanceData={attendanceData}
            onClose={() => setIsShareModalOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddModalOpen && (
          <AddFriendModal
            onClose={() => setIsAddModalOpen(false)}
            onFriendAdded={loadData}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isAddGroupModalOpen && (
          <AddGroupModal
            friends={friends}
            onClose={() => setIsAddGroupModalOpen(false)}
            onAdd={loadData}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedFriend && (
          <FriendTimetableModal
            friend={selectedFriend}
            onClose={() => setSelectedFriend(null)}
            onUpdate={loadData}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedGroup && (
          <CommonFreeSlotsModal
            friends={selectedGroup.friends}
            myAttendance={myAttendance}
            groupName={selectedGroup.name}
            onClose={() => setSelectedGroup(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
