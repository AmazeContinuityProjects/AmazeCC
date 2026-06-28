"use client";

import { useState } from "react";
import { Users, Check } from "lucide-react";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
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
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100">
          Create Group
        </h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Input
          label="Group Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Study Group"
        />

        <div>
          <label className="block text-xs font-medium text-gray-500  dark:text-gray-400 mb-2 ml-1">
            Select Friends ({selectedIds.size} selected)
          </label>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500  dark:text-gray-400">
                You need to add friends first.
              </p>
            ) : (
              friends.map((friend) => {
                const isSelected = selectedIds.has(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => handleToggle(friend.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-gray-200  dark:border-gray-800 bg-white  dark:bg-black hover:border-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                        style={{ backgroundColor: friend.color }}
                      >
                        {friend.nickname.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900  dark:text-gray-100">
                        {friend.nickname}
                      </span>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isSelected ? "bg-blue-500 text-white" : "border border-gray-400"}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <FetchButton
          type="submit"
          variant="gradient"
          className="w-full justify-center py-2.5"
          disabled={!name.trim() || selectedIds.size === 0}
        >
          Create Group
        </FetchButton>
      </form>
    </Modal>
  );
}
