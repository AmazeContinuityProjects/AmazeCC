"use client";

import React, { useState } from "react";
import { useAtom } from "jotai";
import { isFeedbackModalOpenAtom } from "@/store/uiAtoms";
import BottomSheet from "../shared/BottomSheet";
import { submitPostHogFeedback } from "@/lib/posthog";
import { useDashboardNavigator } from "../dashboard/DashboardNavigator";
import buildInfo from "@/data/buildInfo.json";
import { Bug, CheckCircle2, HeartHandshake, Lightbulb, MessageSquare, Send, Sparkles } from "lucide-react";

type FeedbackCategory = "bug" | "feature" | "experience" | "other";

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  icon: typeof Bug;
  desc: string;
  badgeClass: string;
}[] = [
  {
    id: "experience",
    label: "Experience",
    icon: Sparkles,
    desc: "Speed, design, UI feel",
    badgeClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    desc: "Ideas for new tools",
    badgeClass: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "bug",
    label: "Report Bug",
    icon: Bug,
    desc: "Glitch or broken button",
    badgeClass: "text-rose-500 bg-rose-500/10 border-rose-500/20",
  },
  {
    id: "other",
    label: "Other",
    icon: MessageSquare,
    desc: "General thoughts",
    badgeClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
];

const RATINGS = [
  { value: 1, emoji: "😕", label: "Needs Work" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "🤩", label: "Amazing!" },
];

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useAtom(isFeedbackModalOpenAtom);
  const { activeTab, activeSubTab } = useDashboardNavigator();

  const [category, setCategory] = useState<FeedbackCategory>("experience");
  const [rating, setRating] = useState<number>(5);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsOpen(false);
    // Reset after animation
    setTimeout(() => {
      setIsSubmitted(false);
      setMessage("");
      setContact("");
      setCategory("experience");
      setRating(5);
    }, 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const sentiment = rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative";

    submitPostHogFeedback({
      category,
      rating,
      sentiment,
      message: message.trim(),
      contact: contact.trim() || undefined,
      metadata: {
        activeTab,
        activeSubTab,
        appVersion: buildInfo.commitHash,
        url: typeof window !== "undefined" ? window.location.href : "",
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      },
    });

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <BottomSheet
      overlayId="feedback-sheet"
      onClose={handleClose}
      title="Share Feedback"
      subtitle="Help us build a better companion app for VIT"
      icon={<HeartHandshake className="w-5 h-5 text-indigo-500" />}
      maxWidth="max-w-md"
    >
      <div className="p-4 sm:p-5">
        {isSubmitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 animate-in zoom-in-75 duration-200" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-text-primary">Thank you for your feedback!</h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                Your thoughts have been logged directly into PostHog. We review every note to shape upcoming updates.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-transform active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                What are you sharing?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-indigo-500/60 bg-indigo-500/5 ring-1 ring-indigo-500/30"
                          : "border-border-muted bg-surface-secondary/50 hover:bg-surface-secondary"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border ${cat.badgeClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-text-primary leading-tight">{cat.label}</span>
                        <span className="block text-[10px] text-text-muted truncate mt-0.5">{cat.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                How is your experience?
              </label>
              <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-surface-secondary/70 border border-border-muted">
                {RATINGS.map((r) => {
                  const isSelected = rating === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRating(r.value)}
                      title={r.label}
                      className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-all ${
                        isSelected
                          ? "bg-surface-primary text-text-primary shadow-sm scale-105 border border-border-muted"
                          : "text-text-muted hover:text-text-secondary opacity-80"
                      }`}
                    >
                      <span className="text-base leading-none">{r.emoji}</span>
                      <span className="text-[9.5px] font-semibold">{r.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Your message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === "bug"
                    ? "What happened? Steps to reproduce the bug..."
                    : category === "feature"
                      ? "Describe your idea and how it would help you..."
                      : "Tell us what you love or what could be better..."
                }
                className="w-full rounded-xl border border-border-muted bg-surface-secondary/60 p-3 text-xs text-text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
              />
            </div>

            {/* Contact Info (Optional) */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                Contact details <span className="font-normal opacity-70">(Optional)</span>
              </label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email or Discord tag (for follow-ups)"
                className="w-full rounded-xl border border-border-muted bg-surface-secondary/60 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* Diagnostic note */}
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <span>
                Diagnostics: App #{buildInfo.commitHash} · Screen: {activeTab}
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Sending..." : "Submit to PostHog"}</span>
            </button>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
