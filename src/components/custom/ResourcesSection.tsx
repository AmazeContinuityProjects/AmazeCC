"use client";
import React, { useState } from "react";
import { Link2, ExternalLink, History, Trophy, Github, FileText, Shield, ChevronRight } from "lucide-react";
import quickLinks from "../../data/quickLinks.json";
import Links from "./header/Links";
import ChangelogModal from "./header/ChangelogModal";
import HallOfFameModal from "./header/HallOfFameModal";

// Re-use the Links component
export default function ResourcesSection() {
  const [showChangelog, setShowChangelog] = useState(false);
  const [showHallOfFame, setShowHallOfFame] = useState(false);

  return (
    <>
      <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 divide-y divide-gray-150 dark:divide-gray-800/60 overflow-hidden">
        {/* Utilities / Important Links */}
        {quickLinks.importantLinks.map((link) => (
          <a key={link.id} href={link.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                <Link2 size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">{link.title}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">{link.desc}</span>
              </div>
            </div>
            <ExternalLink size={14} className="text-gray-400 shrink-0" />
          </a>
        ))}

        {/* Social Community links */}
        {quickLinks.communityLinks.map((link, idx) => (
          <a key={idx} href={link.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center gap-4 min-w-0 pr-4">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
                <ExternalLink size={18} />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">{link.title}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">VIT community discussion forums and updates</span>
              </div>
            </div>
            <ExternalLink size={14} className="text-gray-400 shrink-0" />
          </a>
        ))}

        {/* Local Link Component integrations */}
        <div className="p-4 bg-transparent">
          <Links />
        </div>

        {/* Changelog */}
        <div onClick={() => setShowChangelog(true)} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Changelog</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">View latest updates, features and releases in AmazeCC</span>
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
        </div>

        {/* Hall of Fame */}
        <div onClick={() => setShowHallOfFame(true)} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
              <Trophy size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Hall of Fame</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Meet the contributors, developers, and testers of the app</span>
            </div>
          </div>
          <ChevronRight size={14} className="text-gray-400 shrink-0" />
        </div>

        {/* Source on GitHub */}
        <a href="https://github.com/AmazeContinuityProjects/AmazeCC/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
              <Github size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">GitHub Repository</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Check out code, contribute fixes or report system bugs</span>
            </div>
          </div>
          <ExternalLink size={14} className="text-gray-400 shrink-0" />
        </a>

        {/* Privacy Policy */}
        <div onClick={() => window.open("/privacy", "_blank")} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Privacy Policy</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Read about local credentials and encryption safety</span>
            </div>
          </div>
          <ExternalLink size={14} className="text-gray-400 shrink-0" />
        </div>

        {/* Terms of Service */}
        <div onClick={() => window.open("/terms", "_blank")} className="flex items-center justify-between p-4 hover:bg-gray-100/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-4 min-w-0 pr-4">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0">
              <Shield size={18} />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 block">Terms of Service</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-450 block truncate mt-0.5">Understand guidelines and rules of utilizing AmazeCC services</span>
            </div>
          </div>
          <ExternalLink size={14} className="text-gray-400 shrink-0" />
        </div>
      </div>
      
      {showChangelog && <ChangelogModal handleClose={() => setShowChangelog(false)} />}
      {showHallOfFame && <HallOfFameModal handleClose={() => setShowHallOfFame(false)} />}
    </>
  );
}
