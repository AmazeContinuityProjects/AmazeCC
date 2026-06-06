import React, { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { importScheduleCode, saveFriend } from "../../../lib/socialUtils";

export default function AddFriendModal({ onClose, onAdd }) {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!code) {
      setError("Please paste a schedule code.");
      return;
    }

    try {
      const newFriend = importScheduleCode(code, nickname);
      saveFriend(newFriend);
      onAdd();
      onClose();
    } catch (err) {
      setError((err as Error).message || "Invalid code format.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" /> Add a Friend
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleAdd} className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Paste your friend's schedule code below to add them. Codes generated from the <strong>VIT Verse App and Clones</strong> app are fully supported.
            </p>
            
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
                Friend's Schedule Code *
              </label>
              <textarea
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste code here..."
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1 ml-1">
                Nickname (Optional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Leave blank to use their real name"
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg mt-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-foreground font-medium py-2.5 rounded-xl shadow-lg transition-all mt-4"
            >
              Add Friend
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
