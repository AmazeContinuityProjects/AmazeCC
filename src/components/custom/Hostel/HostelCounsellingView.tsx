"use client";

import { useState } from "react";
import { Heart, Calendar, Clock, BookOpen, Phone, HelpCircle, Shield, ArrowRight, Sparkles, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CounsellingProps {
  loginToVTOP: () => Promise<any>;
  refreshKey: number;
}

export default function HostelCounsellingView({ loginToVTOP, refreshKey }: CounsellingProps) {
  // Suppress unused warning
  void loginToVTOP;
  void refreshKey;

  const [bookingForm, setBookingForm] = useState({
    type: "Personal Counsellor",
    date: "",
    slot: "10:00 AM - 11:00 AM",
    mode: "In-person"
  });
  const [scheduledSessions, setScheduledSessions] = useState<any[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession = {
      id: Math.floor(Math.random() * 10000),
      type: bookingForm.type,
      date: bookingForm.date || new Date(Date.now() + 86400000).toLocaleDateString("en-US"),
      slot: bookingForm.slot,
      mode: bookingForm.mode
    };
    setScheduledSessions([newSession]);
    alert("Session successfully requested! Our counselling coordinator will verify and confirm via VTOP email within 2 hours.");
  };

  const faqs = [
    { q: "Is my counselling confidential?", a: "Yes, absolutely. All sessions are completely confidential. No details are shared with wardens, parents, professors, or college management." },
    { q: "How much does a session cost?", a: "Counselling services are 100% free of charge for all active students." },
    { q: "Can I choose my counsellor?", a: "Yes, you can request specific counsellors or advisors based on gender preferences, languages spoken, or area of expertise." }
  ];

  return (
    <div className="space-y-6">
      {/* Calm banner */}
      <div className="bg-sky-500/10 border border-sky-400/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-full shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Confidential Listening Space</h2>
          <p className="text-xs text-gray-550 dark:text-gray-400 leading-relaxed">
            Welcome to a quiet, supportive space. We are here to help you navigate academic stress, anxiety, or personal growth.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Book Appointment & Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Booking form */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Schedule a Session</h3>
            
            <form onSubmit={handleBook} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">Counsellor Type</label>
                  <select
                    value={bookingForm.type}
                    onChange={e => setBookingForm(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 rounded-lg p-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="Personal Counsellor">Personal & Emotional Counsellor</option>
                    <option value="Academic Advisor">Academic Stress Advisor</option>
                    <option value="Career & Focus Guide">Career & Focus Guide</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">Preferred Mode</label>
                  <select
                    value={bookingForm.mode}
                    onChange={e => setBookingForm(prev => ({ ...prev, mode: e.target.value }))}
                    className="w-full border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 rounded-lg p-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="In-person">In-person (Hostel Office Block C)</option>
                    <option value="Online">Online Video Call (Microsoft Teams)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">Session Date</label>
                  <input
                    type="date"
                    value={bookingForm.date}
                    onChange={e => setBookingForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 rounded-lg p-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                    required
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="font-semibold text-gray-300">Preferred Time Slot</label>
                  <select
                    value={bookingForm.slot}
                    onChange={e => setBookingForm(prev => ({ ...prev, slot: e.target.value }))}
                    className="w-full border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 rounded-lg p-2 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="10:00 AM - 11:00 AM">Morning: 10:00 AM - 11:00 AM</option>
                    <option value="2:35 PM - 3:35 PM">Afternoon: 2:35 PM - 3:35 PM</option>
                    <option value="4:30 PM - 5:30 PM">Evening: 4:30 PM - 5:30 PM</option>
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs py-2 rounded-xl"
              >
                Schedule Session
              </Button>
            </form>
          </div>

          {/* Upcoming Session Details */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-150 dark:border-gray-800 pb-2">Upcoming Sessions</h3>
            
            {scheduledSessions.length > 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-xl space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span className="font-bold text-gray-850 dark:text-gray-100">Session Requested</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-gray-700 dark:text-gray-300">
                  <div><strong>Advisor:</strong> {scheduledSessions[0].type}</div>
                  <div><strong>Mode:</strong> {scheduledSessions[0].mode}</div>
                  <div><strong>Date:</strong> {scheduledSessions[0].date}</div>
                  <div><strong>Slot:</strong> {scheduledSessions[0].slot}</div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-450 dark:text-gray-500 italic py-2">
                No upcoming scheduled appointments. Choose a time slot above if you need assistance.
              </p>
            )}
          </div>

        </div>

        {/* Right column: Helplines & Resources & FAQ */}
        <div className="space-y-6">
          
          {/* Emergency Helplines */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-sky-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Crisis Helplines</span>
            </div>
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-350">
              <div className="flex items-center justify-between">
                <span>Counselling Coordinator:</span>
                <a href="tel:+914439931234" className="font-semibold text-sky-400 hover:underline">+91 44 3993 1234</a>
              </div>
              <div className="flex items-center justify-between">
                <span>Student Support Helpline:</span>
                <a href="tel:+914439939999" className="font-semibold text-sky-400 hover:underline">+91 44 3993 9999</a>
              </div>
            </div>
          </div>

          {/* Mental Health Resources */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen size={14} className="text-sky-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Mindfulness Resources</span>
            </div>
            <div className="space-y-2.5 text-xs text-gray-700 dark:text-gray-350">
              <a href="#" className="flex items-center justify-between hover:text-sky-400 transition-colors">
                <span>Guided Anxiety Exercises</span>
                <ArrowRight size={12} className="text-gray-400" />
              </a>
              <a href="#" className="flex items-center justify-between hover:text-sky-400 transition-colors">
                <span>Academic Stress Management</span>
                <ArrowRight size={12} className="text-gray-400" />
              </a>
            </div>
          </div>

          {/* FAQ Accordion */}
          <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle size={14} className="text-sky-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Common Questions</span>
            </div>
            <div className="space-y-2.5">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className="border-b border-gray-150 dark:border-gray-850 pb-2 last:border-0 last:pb-0">
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="flex items-center justify-between w-full text-left text-xs font-semibold text-gray-800 dark:text-gray-200"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown size={12} className={`text-gray-400 transform transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">{faq.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
