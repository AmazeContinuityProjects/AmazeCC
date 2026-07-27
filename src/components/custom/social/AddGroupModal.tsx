"use client";

import { useState } from "react";
import { UsersRound, Check, Search, CheckCheck, X } from "lucide-react";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { Input } from "../shared/Input";
import { Friend, FriendGroup, saveFriendGroup } from "@/lib/socialUtils";

interface AddGroupModalProps {
  friends: Friend[];
  onClose: () => void;
  onAdd: () => void;
}

export default function AddGroupModal({ friends, onClose, onAdd }: AddGroupModalProps) {
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const filteredFriends = friends.filter((f) => 
    f.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.regNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    setSelectedIds(new Set(friends.map((f) => f.id)));
  };

  const handleClearAll = () => {
    setSelectedIds(new Set());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedIds.size === 0) return;

    const group: FriendGroup = {
      id: "group_" + Date.now().toString(),
      name: name.trim(),
      friendIds: Array.from(selectedIds),
      createdAt: new Date().toISOString(),
    };

    saveFriendGroup(group);
    onAdd();
    onClose();
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
          <UsersRound className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-foreground font-outfit">
            Create Study / Project Group
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Group friends together to instantly check common free slots
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <Input
          label="Group Name *"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Project Team 4, CSE3002 Study Hub"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
              Select Members
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                {selectedIds.size} / {friends.length}
              </span>
            </label>
            {friends.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="w-3 h-3" /> Select All
                </button>
                <span className="text-muted-foreground opacity-40">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </div>

          {friends.length > 5 && (
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search friend by name or reg..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-foreground"
              />
            </div>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {friends.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                <p className="text-xs text-muted-foreground font-medium">
                  You need to add friends first before creating a group.
                </p>
              </div>
            ) : filteredFriends.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No friends found matching &quot;{searchQuery}&quot;</p>
            ) : (
              filteredFriends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => handleToggle(friend.id)}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/40 shadow-2xs"
                        : "border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs"
                        style={{ backgroundColor: friend.color || "#6366f1" }}
                      >
                        {friend.nickname.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-foreground block leading-tight">
                          {friend.nickname}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {friend.regNumber}
                        </span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                      isSelected 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <FetchButton
            type="submit"
            variant="gradient"
            className="flex-1 justify-center py-2.5"
            disabled={!name.trim() || selectedIds.size === 0}
          >
            Create Group ({selectedIds.size})
          </FetchButton>
        </div>
      </form>
    </Modal>
  );
}

