import React, { useState, useEffect } from "react";
import { Users, UserPlus, Share2, Trash2, Calendar, Eye, EyeOff, UsersRound, Plus, Search, Sparkles, ArrowRight, UserCheck } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import { getFriends, removeFriend, saveFriend, getFriendGroups, removeFriendGroup, exportShareableLink, importScheduleCode, Friend, FriendGroup } from "../../../lib/socialUtils";
import ShareScheduleModal from "./ShareScheduleModal";
import AddFriendModal from "./AddFriendModal";
import FriendTimetableModal from "./FriendTimetableModal";
import CommonFreeSlotsModal from "./CommonFreeSlotsModal";
import AddGroupModal from "./AddGroupModal";
import { Link as LinkIcon, Check } from "lucide-react";

export default function SocialTab({ attendanceData, isDemo }: { attendanceData: any; isDemo?: boolean }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const loadData = () => {
    if (isDemo) {
      loadDemoData();
      return;
    }
    setFriends(getFriends());
    setGroups(getFriendGroups());
  };

  const loadDemoData = () => {
    const mockClassSlots1 = [
      { day: "Monday", timeSlot: "08:00 AM - 08:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" },
      { day: "Tuesday", timeSlot: "09:00 AM - 09:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" },
      { day: "Wednesday", timeSlot: "10:00 AM - 10:50 AM", courseCode: "CSE3002", courseTitle: "Compiler Design", venue: "SJT 402", slotId: "A1" }
    ];
    const mockClassSlots2 = [
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
        color: "#3b82f6",
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
    if (hash && hash.includes("share=")) {
      try {
        const friend = importScheduleCode(hash);
        if (confirm(`Add ${friend.name} (${friend.regNumber}) to your friends list?`)) {
          saveFriend(friend);
          loadData();
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (e) {}
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

  return (
    <div className="w-full space-y-6 pb-8 animate-fadeIn">
      {/* Hero Profile Banner */}
      <div className="p-6 rounded-3xl border border-indigo-100 dark:border-zinc-800/80 bg-gradient-to-br from-indigo-50/80 via-purple-50/30 to-white dark:from-zinc-900 dark:via-zinc-900/90 dark:to-zinc-950 shadow-xs relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-md ring-4 ring-white dark:ring-zinc-900 shrink-0">
              {studentInitials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-foreground font-outfit tracking-tight">
                  {studentName}
                </h2>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs">
                  {studentReg}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                Compare timetables with classmates, organize project groups, and find common free hours in 1 click.
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground bg-white/70 dark:bg-zinc-800/60 px-3 py-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{friends.length} Friends</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground bg-white/70 dark:bg-zinc-800/60 px-3 py-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                  <UsersRound className="w-3.5 h-3.5 text-purple-500" />
                  <span>{groups.length} Groups</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground bg-white/70 dark:bg-zinc-800/60 px-3 py-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shadow-2xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{friendsOnDashboardCount} Synced to Dashboard</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <button
              onClick={handleCopyLink}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
              {copiedLink ? "Link Copied!" : "Copy Share Link"}
            </button>
            <button
              onClick={() => {
                if (isDemo) {
                  alert("Sharing schedule code is disabled in Demo Mode.");
                } else {
                  setIsShareModalOpen(true);
                }
              }}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all shadow-2xs cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-indigo-500" />
              QR & Code
            </button>
            <FetchButton
              onClick={() => {
                if (isDemo) {
                  alert("Adding new friends is disabled in Demo Mode.");
                } else {
                  setIsAddModalOpen(true);
                }
              }}
              variant="gradient"
              icon={<UserPlus className="w-4 h-4" />}
              className="flex-1 lg:flex-none px-4 py-2.5 rounded-xl shadow-md text-xs font-bold"
            >
              Add Friend
            </FetchButton>
            {friends.length > 0 && (
              <button
                onClick={handleOpenAllFreeSlots}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-extrabold hover:bg-emerald-100/70 transition-all cursor-pointer shadow-2xs"
              >
                <Calendar className="w-4 h-4 text-emerald-500" />
                Compare All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search & Toolbar */}
      {friends.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search friends or groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-end">
            <span className="font-semibold">
              Showing {filteredFriends.length} friend{filteredFriends.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => {
                if (isDemo) {
                  alert("Creating groups is disabled in Demo Mode.");
                } else {
                  setIsAddGroupModalOpen(true);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Create Group
            </button>
          </div>
        </div>
      )}

      {/* Groups Section */}
      {friends.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UsersRound className="w-4 h-4 text-purple-500" /> Groups ({filteredGroups.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.length === 0 ? (
              <div className="col-span-full py-6 flex flex-col items-center justify-center text-center bg-zinc-50/50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                <p className="text-muted-foreground text-xs font-medium">
                  {searchQuery ? "No groups match your search query." : "No groups created yet. Create a group to easily compare timetables for project teams!"}
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const groupFriends = friends.filter((f) => group.friendIds.includes(f.id));
                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup({ group, friends: groupFriends, name: group.name })}
                    className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-extrabold text-foreground text-base tracking-tight leading-tight">
                          {group.name}
                        </h4>
                        <button
                          onClick={(e) => handleDeleteGroup(group.id, e)}
                          className="text-zinc-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Avatar Stack */}
                      <div className="flex items-center -space-x-2 overflow-hidden mb-4">
                        {groupFriends.slice(0, 5).map((f) => (
                          <div
                            key={f.id}
                            className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900 flex items-center justify-center text-white text-xs font-black shadow-2xs shrink-0"
                            style={{ backgroundColor: f.color || "#6366f1" }}
                            title={f.nickname}
                          >
                            {f.nickname.substring(0, 1).toUpperCase()}
                          </div>
                        ))}
                        {groupFriends.length > 5 && (
                          <div className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-800 text-foreground flex items-center justify-center text-[10px] font-black shrink-0">
                            +{groupFriends.length - 5}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {groupFriends.length} Member{groupFriends.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Compare Free Slots <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
          <Users className="w-4 h-4 text-indigo-500" /> All Friends ({filteredFriends.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {friends.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-white via-indigo-50/20 to-zinc-50 dark:from-zinc-900/60 dark:to-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
              <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
                <Users className="w-10 h-10 stroke-[1.8]" />
              </div>
              <h3 className="text-lg font-black text-foreground mb-1 font-outfit">
                No friends added yet
              </h3>
              <p className="text-muted-foreground text-xs max-w-sm mb-5 leading-relaxed">
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
                  className="px-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-foreground rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Load Demo Data
                </button>
              </div>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-zinc-50 dark:bg-zinc-900/30 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-xs text-muted-foreground font-medium">No friends match your search query &quot;{searchQuery}&quot;</p>
            </div>
          ) : (
            filteredFriends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="p-5 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0 ring-2 ring-white dark:ring-zinc-900"
                      style={{ backgroundColor: friend.color || "#6366f1" }}
                    >
                      {friend.nickname.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-foreground leading-tight text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {friend.nickname}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {friend.regNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => toggleDashboardVisibility(friend, e)}
                      className={`p-2 rounded-xl transition-all cursor-pointer ${
                        friend.showInHomePage
                          ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800"
                          : "text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                      title={friend.showInHomePage ? "Shown on Main Dashboard" : "Hidden from Main Dashboard"}
                    >
                      {friend.showInHomePage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => handleDeleteFriend(friend.id, e)}
                      className="text-zinc-400 hover:text-red-500 p-2 rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                      title="Remove friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl flex items-center justify-between border border-zinc-200/50 dark:border-zinc-800/50">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {friend.classSlots.length} Enrolled Slots
                  </p>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    View Timetable &rarr;
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {isShareModalOpen && (
        <ShareScheduleModal
          attendanceData={attendanceData}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}
      {isAddModalOpen && (
        <AddFriendModal
          onClose={() => setIsAddModalOpen(false)}
          onFriendAdded={loadData}
        />
      )}
      {isAddGroupModalOpen && (
        <AddGroupModal
          friends={friends}
          onClose={() => setIsAddGroupModalOpen(false)}
          onAdd={loadData}
        />
      )}
      {selectedFriend && (
        <FriendTimetableModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onUpdate={loadData}
        />
      )}
      {selectedGroup && (
        <CommonFreeSlotsModal
          friends={selectedGroup.friends}
          myAttendance={myAttendance}
          groupName={selectedGroup.name}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
}

