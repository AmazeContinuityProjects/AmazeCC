import { useState, useEffect } from "react";
import { Friend, FriendGroup, TimetableState } from "../types";

export const useSocialState = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([]);
  const [socialScoreGroupMethod, setSocialScoreGroupMethod] = useState<"intersection" | "cumulative">("intersection");
  const [socialTargetId, setSocialTargetId] = useState<string>("");

  // UI / Modals State
  const [isFriendsManagerOpen, setIsFriendsManagerOpen] = useState(false);
  const [friendsManagerTab, setFriendsManagerTab] = useState<"friends" | "groups">("friends");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFriends, setNewGroupFriends] = useState<string[]>([]);
  const [pendingFriendTimetables, setPendingFriendTimetables] = useState<TimetableState[] | null>(null);
  const [pendingFriendName, setPendingFriendName] = useState("");
  const [isSocialMatrixOpen, setIsSocialMatrixOpen] = useState(false);
  const [selectedFriendTimetablesData, setSelectedFriendTimetablesData] = useState<{name: string, timetables: TimetableState[], currentIndex: number} | null>(null);

  // Generator specifics for friends
  const [generatorSyncFriendsClasses, setGeneratorSyncFriendsClasses] = useState(false);
  const [generatorMaximizeFreeTimeFriends, setGeneratorMaximizeFreeTimeFriends] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedFriends = localStorage.getItem("ffcs_friends");
      if (savedFriends) setFriends(JSON.parse(savedFriends));
    } catch (e) {
      console.error("Failed to parse saved friends", e);
    }
    
    try {
      const savedGroups = localStorage.getItem("ffcs_friendGroups");
      if (savedGroups) setFriendGroups(JSON.parse(savedGroups));
    } catch (e) {
      console.error("Failed to parse saved friend groups", e);
    }

    try {
      const savedMethod = localStorage.getItem("ffcs_socialScoreGroupMethod");
      if (savedMethod) setSocialScoreGroupMethod(savedMethod as any);
    } catch (e) {
      console.error("Failed to parse social score group method", e);
    }

    try {
      const savedSync = localStorage.getItem("ffcs_generatorSyncFriendsClasses");
      if (savedSync) setGeneratorSyncFriendsClasses(JSON.parse(savedSync));
    } catch (e) {
      console.error("Failed to parse generator sync friends classes", e);
    }

    try {
      const savedMaximize = localStorage.getItem("ffcs_generatorMaximizeFreeTimeFriends");
      if (savedMaximize) setGeneratorMaximizeFreeTimeFriends(JSON.parse(savedMaximize));
    } catch (e) {
      console.error("Failed to parse generator maximize free time friends", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ffcs_friends", JSON.stringify(friends));
    localStorage.setItem("ffcs_friendGroups", JSON.stringify(friendGroups));
    localStorage.setItem("ffcs_socialScoreGroupMethod", socialScoreGroupMethod);
    localStorage.setItem("ffcs_generatorSyncFriendsClasses", JSON.stringify(generatorSyncFriendsClasses));
    localStorage.setItem("ffcs_generatorMaximizeFreeTimeFriends", JSON.stringify(generatorMaximizeFreeTimeFriends));
  }, [friends, friendGroups, socialScoreGroupMethod, generatorSyncFriendsClasses, generatorMaximizeFreeTimeFriends]);

  return {
    friends,
    setFriends,
    friendGroups,
    setFriendGroups,
    socialScoreGroupMethod,
    setSocialScoreGroupMethod,
    socialTargetId,
    setSocialTargetId,
    isFriendsManagerOpen,
    setIsFriendsManagerOpen,
    friendsManagerTab,
    setFriendsManagerTab,
    newGroupName,
    setNewGroupName,
    newGroupFriends,
    setNewGroupFriends,
    pendingFriendTimetables,
    setPendingFriendTimetables,
    pendingFriendName,
    setPendingFriendName,
    isSocialMatrixOpen,
    setIsSocialMatrixOpen,
    selectedFriendTimetablesData,
    setSelectedFriendTimetablesData,
    generatorSyncFriendsClasses,
    setGeneratorSyncFriendsClasses,
    generatorMaximizeFreeTimeFriends,
    setGeneratorMaximizeFreeTimeFriends
  };
};
