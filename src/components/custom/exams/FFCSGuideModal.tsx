import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, Search, Zap, Users, Settings2, Share2 } from 'lucide-react';
import BottomSheet from '../shared/BottomSheet';

interface FFCSGuideModalProps {
  /**
   * Mounted unconditionally and toggled, rather than rendered behind
   * `{isOpen && ...}`: AnimatePresence only animates its own children leaving,
   * so a modal that disappears with its parent would snap shut instead of
   * sliding down.
   */
  isOpen: boolean;
  onClose: () => void;
}

export default function FFCSGuideModal({ isOpen, onClose }: FFCSGuideModalProps) {
  /*
    A sheet now, so the chrome — grabber, one X, swipe-down, Escape and system
    back — belongs to it and the header keeps only the title. The z pair is
    passed through rather than left at the sheet default because the planner can
    be in fullscreen (z-100) behind this, and a sheet at the default z-60 would
    land underneath it. `contentClassName` carries the body's old `space-y-8`;
    the sheet's content wrapper supplies the padding and the scroll.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-guide"
          maxWidth="max-w-4xl"
          panelZIndex={400}
          backdropZIndex={395}
          contentClassName="space-y-8"
          title="FFCS Planner Guide"
          icon={<BookOpen className="w-5 h-5" />}
          accent="bg-blue-500/10 border-blue-500/20 text-blue-500"
          closeLabel="Close FFCS guide"
        >
          {/* Welcome */}
          <section>
            <h4 className="text-lg font-bold text-text-heading mb-3 flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-500 p-1.5 rounded-lg"><BookOpen className="w-4 h-4" /></span>
              What is the FFCS Planner?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              The FFCS Planner is an advanced visual builder designed to help you quickly draft your timetable, eliminate clashes, and perfectly align your schedule with your friends before the actual FFCS portal opens. Every plan can also travel as a share link — the week rides inside the URL itself, so there is no account, no upload and no server to outlive.
            </p>
          </section>

          {/* Adding Courses */}
          <section>
            <h4 className="text-lg font-bold text-text-heading mb-3 flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-500 p-1.5 rounded-lg"><Search className="w-4 h-4" /></span>
              Adding Courses
            </h4>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">1. Master Database:</strong>
                <span>The latest course report ships with the app and loads instantly — no fetching, no login.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">2. Search & Filter:</strong>
                <span>Search by course code, title, or faculty, then pick the slot and faculty you want and hit &ldquo;Add to Timetable&rdquo;. Blocking cells in the grid narrows the slot list to what fits.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">3. Paste or Upload:</strong>
                <span>&ldquo;Target Courses&rdquo; takes a list pasted straight from your registration sheet, or a CSV/XLSX file — everything you confirm joins the searchable master list, so no code is ever typed by hand.</span>
              </li>
            </ul>
          </section>

          {/* Auto-Generator */}
          <section>
            <h4 className="text-lg font-bold text-text-heading mb-3 flex items-center gap-2">
              <span className="bg-purple-500/20 text-purple-500 p-1.5 rounded-lg"><Zap className="w-4 h-4" /></span>
              The Auto-Generator
            </h4>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              If you draft multiple options for the same course (e.g., three different faculties for CSE1001), &ldquo;Auto-Generate&rdquo; opens the generator workspace. It builds every valid, non-clashing combination as it finds them — press Stop when you have seen enough — then lets you compare up to three weeks side by side before you save one.
            </p>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              Five ranking opinions decide what &ldquo;best&rdquo; means, and Settings holds your default:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
              <li><strong>Balanced:</strong> The even-handed default — short, gap-light days of a similar shape across the week.</li>
              <li><strong>Half Days:</strong> Rewards days that fit inside a four-hour window, so whole mornings or evenings come back free.</li>
              <li><strong>Minimize Gaps:</strong> Blanks out the empty periods between consecutive classes.</li>
              <li><strong>Early Finish:</strong> Days that end early — the average last class finishes as close to noon as the week allows.</li>
              <li><strong>Late Start:</strong> Mornings stay free — the average first class starts as late as the week allows.</li>
            </ul>
          </section>

          {/* Social Score */}
          <section>
            <h4 className="text-lg font-bold text-text-heading mb-3 flex items-center gap-2">
              <span className="bg-pink-500/20 text-pink-500 p-1.5 rounded-lg"><Users className="w-4 h-4" /></span>
              Social Score & Friends
            </h4>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              The standout feature of this planner is the <strong>Social Matrix</strong>. A friend arrives as their planner&rsquo;s Backup file: they export theirs, you press &ldquo;Import Friend&rsquo;s Timetable JSON&rdquo; in the Friends manager and give them a name.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2 mb-3">
              <li><strong>Scoring:</strong> The percentage represents how well your schedule aligns. It rewards taking the exact same class (+3 points), sharing a free half-day (+5 points), and mutually free hours (+1 point).</li>
              <li><strong>The 2D Matrix:</strong> Click the &ldquo;Social Score&rdquo; widget to open the matrix. It compares your saved weeks against every option your friends have saved — green cells are an 80%+ match. Target a group and pick how the scores combine: intersection or cumulative.</li>
              <li><strong>Cycle Options:</strong> In the friend view, you can cycle through all the alternative schedules your friend saved to see which one works best for both of you.</li>
            </ul>
          </section>

          {/* Settings & sharing */}
          <section>
            <h4 className="text-lg font-bold text-text-heading mb-3 flex items-center gap-2">
              <span className="bg-sky-500/20 text-sky-500 p-1.5 rounded-lg"><Settings2 className="w-4 h-4" /></span>
              Settings, Sharing &amp; the Tour
            </h4>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">Settings:</strong>
                <span>The gear beside the title holds your defaults — ranking opinion, result sorting, export format and result limits — along with the guided tour and its tips.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">Share:</strong>
                <span>The share icon beside the gear copies a link that carries this exact plan. Whoever opens it sees the week, ready to load into their own planner — nothing was uploaded, and the link works offline.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-text-heading shrink-0">First visit:</strong>
                <span>A short guided tour highlights each part of the planner once; skip it anytime and Settings brings it back whenever the layout has moved on.</span>
              </li>
            </ul>
          </section>

          <div className="pt-4 border-t border-border-strong text-right">
            <button 
              onClick={onClose}
              className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
            >
              Got it, let's build!
            </button>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
