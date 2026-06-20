import React from 'react';
import { X, BookOpen, Search, Zap, Users } from 'lucide-react';

interface FFCSGuideModalProps {
  onClose: () => void;
}

export default function FFCSGuideModal({ onClose }: FFCSGuideModalProps) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <h3 className="font-bold text-xl text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-500" /> FFCS Planner Guide
          </h3>
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-background"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-auto custom-scrollbar flex-1 space-y-8">
          
          {/* Welcome */}
          <section>
            <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-500 p-1.5 rounded-lg"><BookOpen className="w-4 h-4" /></span>
              What is the FFCS Planner?
            </h4>
            <p className="text-muted-foreground leading-relaxed">
              The FFCS Planner is an advanced visual builder designed to help you quickly draft your timetable, eliminate clashes, and perfectly align your schedule with your friends before the actual FFCS portal opens. 
            </p>
          </section>

          {/* Adding Courses */}
          <section>
            <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-500 p-1.5 rounded-lg"><Search className="w-4 h-4" /></span>
              Adding Courses
            </h4>
            <ul className="space-y-3 text-muted-foreground">
              <li className="flex gap-2">
                <strong className="text-foreground shrink-0">1. Master Spreadsheet:</strong>
                <span>Upload your Master Excel file at the top. The planner parses thousands of slots instantly.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-foreground shrink-0">2. Search & Filter:</strong>
                <span>Search by course code, title, or faculty in the Search Box. Filter by theory, lab, or project to narrow down options.</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-foreground shrink-0">3. Draft Mode vs Build Mode:</strong>
                <span>Use the "Add to Draft" button to stage multiple courses without committing them. Click "Generate Timetable" to auto-build permutations from your drafted options, or select slots directly to force them into your active timetable.</span>
              </li>
            </ul>
          </section>

          {/* Auto-Generator */}
          <section>
            <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="bg-purple-500/20 text-purple-500 p-1.5 rounded-lg"><Zap className="w-4 h-4" /></span>
              The Auto-Generator
            </h4>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              If you draft multiple options for the same course (e.g., three different faculties for CSE1001), the Auto-Generator will calculate every single valid, non-clashing timetable combination.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2">
              <li><strong>Maximize Half Days:</strong> Sorts options to group classes together, maximizing entirely free mornings or evenings.</li>
              <li><strong>Minimize Gaps:</strong> Sorts to remove awkward 1-hour gaps between consecutive classes.</li>
              <li><strong>Balanced:</strong> A hybrid algorithm that prioritizes half-days, gap minimization, and your Social Score.</li>
            </ul>
          </section>

          {/* Social Score */}
          <section>
            <h4 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="bg-pink-500/20 text-pink-500 p-1.5 rounded-lg"><Users className="w-4 h-4" /></span>
              Social Score & Friends
            </h4>
            <p className="text-muted-foreground mb-3 leading-relaxed">
              The standout feature of this planner is the <strong>Social Matrix</strong>. Share your config file with friends via the Social tab to compare timetables!
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-2 mb-3">
              <li><strong>Scoring:</strong> The percentage represents how well your schedule aligns. It rewards taking the exact same class (+3 points), sharing a free half-day (+5 points), and mutually free hours (+1 point).</li>
              <li><strong>The 2D Matrix:</strong> Click the "Social Score" widget anywhere to open the matrix. It compares all your generated timetable options against every option your friends have saved. Look for green cells for an 80%+ match!</li>
              <li><strong>Cycle Options:</strong> In the friend view, you can cycle through all the alternative schedules your friend generated to see which one works best for both of you.</li>
            </ul>
          </section>

        </div>
        <div className="p-4 border-t border-border bg-muted/20 text-right shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
          >
            Got it, let's build!
          </button>
        </div>
      </div>
    </div>
  );
}
