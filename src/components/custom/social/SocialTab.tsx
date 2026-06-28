import React, { useState, useEffect } from "react";
import { Users, UserPlus, Share2, Trash2, Calendar, LayoutDashboard, Eye, EyeOff, UsersRound, Plus } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import { getFriends, removeFriend, saveFriend, getFriendGroups, removeFriendGroup, Friend, FriendGroup } from "../../../lib/socialUtils";
import ShareScheduleModal from "./ShareScheduleModal";
import AddFriendModal from "./AddFriendModal";
import FriendTimetableModal from "./FriendTimetableModal";
import CommonFreeSlotsModal from "./CommonFreeSlotsModal";
import AddGroupModal from "./AddGroupModal";

export default function SocialTab({ attendanceData, isDemo }: { attendanceData: any; isDemo?: boolean }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
  
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<{ group: FriendGroup | null, friends: Friend[], name?: string } | null>(null);
 
  const loadData = () => {
    if (isDemo) {
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
      return;
    }
    setFriends(getFriends());
    setGroups(getFriendGroups());
  };

  useEffect(() => {
    loadData();
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

  return (
    <div className="w-full space-y-6 pb-8 animate-fadeIn">
      {/* Header */}
      <div className="solid-card p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="text-blue-500 w-6 h-6" /> Social & Schedules
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Compare schedules, find common free time, and plan group study sessions!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <FetchButton
              onClick={handleOpenAllFreeSlots}
              variant="success"
              icon={<Calendar className="w-4 h-4" />}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl"
            >
              Compare All
            </FetchButton>
             <button
              onClick={() => { if (isDemo) { alert("Sharing schedule code is disabled in Demo Mode."); } else { setIsShareModalOpen(true); } }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-muted hover:border-border text-foreground px-4 py-2.5 rounded-xl border border-border transition-colors shadow-sm whitespace-nowrap"
            >
              <Share2 className="w-4 h-4" /> 
              <span className="hidden sm:inline">Share My Code</span>
              <span className="sm:hidden">Share</span>
            </button>
            <FetchButton
              onClick={() => { if (isDemo) { alert("Adding new friends is disabled in Demo Mode."); } else { setIsAddModalOpen(true); } }}
              variant="gradient"
              icon={<UserPlus className="w-4 h-4" />}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl shadow-lg"
            >
              Add Friend
            </FetchButton>
          </div>
        </div>
      </div>

      {/* Groups Section */}
      {friends.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UsersRound className="w-4 h-4" /> Groups
            </h3>
            <button onClick={() => { if (isDemo) { alert("Creating groups is disabled in Demo Mode."); } else { setIsAddGroupModalOpen(true); } }} className="text-sm text-blue-500 hover:text-blue-600 font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Create Group
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.length === 0 ? (
              <div className="col-span-full py-6 flex flex-col items-center justify-center text-center bg-white/40  dark:bg-white/[0.02]  border border-white/40  dark:border-white/10 border-dashed rounded-2xl">
                <p className="text-muted-foreground text-sm">No groups created. Create a group to easily compare schedules for project teams!</p>
              </div>
            ) : (
              groups.map((group) => {
                const groupFriends = friends.filter(f => group.friendIds.includes(f.id));
                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroup({ group, friends: groupFriends, name: group.name })}
                    className="solid-card p-5 hover:shadow-md transition-all flex flex-col cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-foreground leading-tight text-lg">{group.name}</h3>
                      <button
                        onClick={(e) => handleDeleteGroup(group.id, e)}
                        className="text-muted-foreground hover:text-red-400 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex -space-x-2 overflow-hidden mb-3">
                      {groupFriends.slice(0, 5).map(f => (
                        <div key={f.id} className="inline-block h-8 w-8 rounded-full ring-2 ring-background flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: f.color }}>
                          {f.nickname.substring(0, 1).toUpperCase()}
                        </div>
                      ))}
                      {groupFriends.length > 5 && (
                        <div className="inline-block h-8 w-8 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-muted-foreground text-xs font-bold">
                          +{groupFriends.length - 5}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-auto">Click to view common free slots</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 px-1">
          <Users className="w-4 h-4" /> All Friends
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {friends.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white/40  dark:bg-white/[0.02]  border border-white/40  dark:border-white/10 border-dashed rounded-2xl">
              <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-bold text-foreground mb-1">
                No friends added yet
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Ask your friends to share their schedule code and add them here to see their timetables.
              </p>
            </div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="solid-card p-5 hover:shadow-md transition-all flex flex-col cursor-pointer hover:border-blue-500/30"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: friend.color }}
                    >
                      {friend.nickname.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">
                        {friend.nickname}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {friend.regNumber}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => toggleDashboardVisibility(friend, e)}
                      className={`p-2 rounded-lg transition-colors ${
                        friend.showInHomePage
                          ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                          : "text-muted-foreground bg-muted hover:bg-muted/80"
                      }`}
                      title={friend.showInHomePage ? "Shown on Dashboard" : "Hidden on Dashboard"}
                    >
                      {friend.showInHomePage ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => handleDeleteFriend(friend.id, e)}
                      className="text-muted-foreground hover:text-red-400 p-2 rounded-lg transition-colors hover:bg-red-500/10"
                      title="Remove friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl flex items-center justify-between">
                  <p>
                    <span className="font-medium text-foreground">
                      {friend.classSlots.length}
                    </span>{" "}
                    classes
                  </p>
                  <span className="text-xs text-blue-500 font-medium">View Schedule &rarr;</span>
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
