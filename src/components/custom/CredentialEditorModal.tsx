"use client";

import { useState } from "react";
import { syncEngine } from "@/lib/sync-engine";
import { storage } from "@/lib/storage";
import BottomSheet from "./shared/BottomSheet";
import { AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: (ids: {
    VtopUsername: string;
    VtopPassword: string;
    MoodleUsername?: string;
    MoodlePassword?: string;
  }) => void;
}

export default function CredentialEditorModal({ open, onClose, onSaved }: Props) {
  const stored = storage.ids.get();
  const [username, setUsername] = useState(stored?.VtopUsername ?? "");
  const [password, setPassword] = useState(stored?.VtopPassword ?? "");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("saving");
    setError("");
    try {
      await syncEngine.editCredentials({
        VtopUsername: username,
        VtopPassword: password,
        MoodleUsername: stored?.MoodleUsername,
        MoodlePassword: stored?.MoodlePassword,
      });
      setStatus("idle");
      onSaved?.({
        VtopUsername: username,
        VtopPassword: password,
        MoodleUsername: stored?.MoodleUsername,
        MoodlePassword: stored?.MoodlePassword,
      });
      onClose();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <BottomSheet onClose={onClose} overlayId="credential-editor-sheet" maxWidth="max-w-md">
          <div role="dialog" aria-modal="true" className="pt-1">
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Edit credentials</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
          Wrong password? Update it here. We verify once and stop if it fails, so VTOP won&apos;t lock your account.
        </p>
        <form onSubmit={submit}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>VTOP Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={inputStyle}
          />
          <label style={{ display: "block", fontSize: 13, margin: "12px 0 4px" }}>VTOP Password</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button type="button" onClick={() => setShow((s) => !s)} style={btnStyle}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {status === "error" && (
            <p style={{ color: "#dc2626", fontSize: 13, margin: "12px 0 0" }}>{error}</p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button type="button" onClick={onClose} style={btnStyle}>
              Cancel
            </button>
            <button type="submit" disabled={status === "saving"} style={{ ...btnStyle, background: "#4f46e5", color: "#fff" }}>
              {status === "saving" ? "Verifying…" : "Save & verify"}
            </button>
          </div>
        </form>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid rgba(125,125,125,0.4)",
  background: "transparent",
  color: "inherit",
  fontSize: 14,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(125,125,125,0.4)",
  background: "transparent",
  color: "inherit",
  fontSize: 14,
  cursor: "pointer",
};
