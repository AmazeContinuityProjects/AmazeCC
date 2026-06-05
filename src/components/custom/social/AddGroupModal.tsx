import React, { useState } from "react";
import { X, Users, Check } from "lucide-react";
import { Friend, FriendGroup, saveFriendGroup } from "../../../lib/socialUtils";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Create Group
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
              Group Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Study Group"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2 ml-1">
              Select Friends ({selectedIds.size} selected)
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {friends.length === 0 ? (
                <p className="text-sm text-muted-foreground">You need to add friends first.</p>
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
                          : "border-border bg-background hover:border-gray-400"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                          style={{ backgroundColor: friend.color }}
                        >
                          {friend.nickname.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="font-medium text-foreground">{friend.nickname}</span>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isSelected ? "bg-blue-500 text-white" : "border border-muted-foreground"}`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || selectedIds.size === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl shadow-lg transition-all"
          >
            Create Group
          </button>
        </form>
      </div>
    </div>
  );
}
