"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  ChevronDown,
  Clock,
  GraduationCap,
  LayoutGrid,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { CourseDot, SlotBadge } from "@amazecontinuityprojects/amazeui";
import { cn } from "@/lib/utils";

/**
 * The guest landing page, Calm Notebook edition.
 *
 * One promise, two actions, and a working preview of the real home screen,
 * then the features a VIT student actually uses, how sign-in works, and the
 * FAQ. Everything is drawn from AmazeUI tokens, so light and dark (true black)
 * come for free. No glows, gradients, counters or decorative mock-ups.
 */

interface GuestExperienceProps {
  onGetStarted: () => void;
  onTryDemo: () => void;
}

const NAV = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "faq", label: "FAQ" },
];

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Attendance that tells you what to do",
    body: "Every course shows the 75% line and how many classes you can skip, or how many you must attend to get back over it.",
  },
  {
    icon: Clock,
    title: "Today, at a glance",
    body: "The class you are in, the next one, its slot and the time left, with free gaps and empty rooms in between.",
  },
  {
    icon: GraduationCap,
    title: "Marks and targets",
    body: "CAT, DA and FAT marks per course, your CGPA, and the FAT score you need to reach the grade you want.",
  },
  {
    icon: CalendarRange,
    title: "FFCS planner",
    body: "Build next semester's timetable, catch slot clashes before registration and share the plan as a link.",
    link: { href: "/ffcs/", label: "Open the planner, no sign-in needed" },
  },
  {
    icon: LayoutGrid,
    title: "Campus in one place",
    body: "Mess menu, laundry, buses, libraries, events, free classrooms and faculty cabins, without five portals.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Your VTOP credentials stay in this browser. Synced data is kept on your device, so it still opens offline.",
  },
];

const STEPS = [
  { title: "Sign in with VTOP", body: "Use the same registration number and password you use for VTOP." },
  { title: "AmazeCC syncs", body: "Your timetable, attendance, marks and campus details come across in one pass." },
  { title: "Check it between classes", body: "Open it on your phone or laptop. It syncs again in the background." },
];

const FAQ = [
  {
    q: "Is this official?",
    a: "No. AmazeCC is an independent project built by VIT students. It reads your data from the official portals and shows it in one place.",
  },
  {
    q: "Is it free?",
    a: "Yes. It is free, with no adverts and no subscription.",
  },
  {
    q: "Does it store my password?",
    a: "No server ever sees it. Sign-in happens in your browser, and your session is kept in this browser's local storage.",
  },
  {
    q: "Can alumni use it?",
    a: "Yes, as long as your VTOP account is still active you can sync your history and browse the catalogues.",
  },
];

/** Sample rows for the preview and the skip-budget section (illustrative data). */
const SAMPLE = [
  { code: "BPHY101L", name: "Engineering Physics", slot: "C1+TC1", pct: 74, note: "attend next 1", tone: "short" },
  { code: "BMAT201L", name: "Complex Variables and LA", slot: "B1+TB1", pct: 76, note: "no skips left", tone: "edge" },
  { code: "BCSE202L", name: "Data Structures and Algorithms", slot: "A1+TA1", pct: 88, note: "can skip 6", tone: "safe" },
] as const;

function SampleRows({ rows = SAMPLE }: { rows?: readonly (typeof SAMPLE)[number][] }) {
  return (
    <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.code} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5">
          <CourseDot course={r.code} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] text-ink">{r.name}</span>
            <span className="block font-mono text-[12px] text-muted">{r.slot}</span>
          </span>
          <span className="text-right">
            <span
              className={cn(
                "block font-mono text-[14px] font-semibold tabular-nums",
                r.tone === "short" ? "text-danger" : "text-ink",
              )}
            >
              {r.pct}%
            </span>
            <span
              className={cn(
                "block text-[12px]",
                r.tone === "short" ? "text-danger" : r.tone === "edge" ? "text-warn" : "text-muted",
              )}
            >
              {r.note}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A working preview of the real home screen, in the page's own theme. */
function HomePreview() {
  return (
    <div
      aria-label="Preview of the AmazeCC home screen with sample data"
      role="img"
      className="mx-auto w-full max-w-[360px] rounded-[40px] border border-line bg-surface-2 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.16)]"
    >
      <div className="overflow-hidden rounded-[32px] border border-line bg-background">
        <div className="space-y-4 px-4 pb-4 pt-6 text-left">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[19px] font-semibold tracking-tight text-ink">Good morning, Arjun</p>
              <p className="text-[12.5px] text-muted">Monday, 10 November</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">
              AR
            </span>
          </div>
          <div className="relative overflow-hidden rounded-md border border-line bg-surface">
            <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: "var(--course-1)" }} />
            <div className="space-y-2 px-3.5 py-3">
              <div className="flex justify-between text-[11.5px] text-muted">
                <span>Now · ends 08:50</span>
                <span className="font-mono">9 min left</span>
              </div>
              <p className="text-[15px] font-semibold leading-snug text-ink">Data Structures and Algorithms</p>
              <p className="font-mono text-[11.5px] text-ink-2">AB1-404 · A1 · Dr. R. Kavitha</p>
              <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full w-[82%] rounded-full" style={{ background: "var(--course-1)" }} />
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-line-2 px-3.5 py-2 text-[12.5px]">
              <span className="text-ink">
                <span className="text-muted">Next </span>
                <span className="font-mono">08:55</span> Qualitative Skills
              </span>
              <SlotBadge course={5}>F1</SlotBadge>
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between pb-1.5">
              <span className="text-[12.5px] font-semibold text-ink">Attendance</span>
              <span className="text-[12px] text-accent">All 6 courses</span>
            </div>
            <SampleRows />
          </div>
        </div>
        <div className="flex justify-around border-t border-line bg-surface px-2 pb-3 pt-2 text-[10.5px] text-muted">
          <span className="font-semibold text-accent">Home</span>
          <span>Academics</span>
          <span>Calendar</span>
          <span>Apps</span>
        </div>
      </div>
    </div>
  );
}

export default function GuestExperience({ onGetStarted, onTryDemo }: GuestExperienceProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && resolvedTheme === "dark";
  const [isScrolled, setIsScrolled] = useState(false);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const primary =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-5 text-[15px] font-medium text-background transition-colors duration-[120ms] hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const secondary =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line bg-surface px-5 text-[15px] font-medium text-ink transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <main className="min-h-screen bg-background text-ink selection:bg-accent/25">
      {/* ── Header ── */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b bg-background/95 transition-colors duration-[120ms]",
          isScrolled ? "border-line" : "border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="AmazeCC home">
            <img src="/logo.png" alt="" className="h-7 w-7 rounded-sm object-contain" />
            <span className="text-[16px] font-semibold tracking-tight">AmazeCC</span>
          </a>
          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className="rounded-sm px-3 py-2 text-[14px] text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink"
              >
                {n.label}
              </button>
            ))}
            <a
              href="/ffcs/"
              className="rounded-sm px-3 py-2 text-[14px] text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink"
            >
              FFCS planner
            </a>
          </nav>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={mounted && isDark ? "Switch to light theme" : "Switch to dark theme"}
              title="Toggle theme"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="grid h-10 w-10 place-items-center rounded-full text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2"
            >
              {mounted && isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            </button>
            <button
              type="button"
              onClick={onTryDemo}
              className="hidden min-h-10 rounded-sm px-3 text-[14px] font-medium text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-ink sm:inline-flex sm:items-center"
            >
              Try demo
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex min-h-10 items-center rounded-sm bg-accent px-4 text-[14px] font-medium text-background transition-colors duration-[120ms] hover:bg-accent/90"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-[1.1fr_0.9fr] md:pb-24 md:pt-20">
        <div className="text-left">
          <p className="text-[13.5px] text-muted">For VIT students · free and unofficial</p>
          <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[56px]">
            <span className="block">Your VIT life,</span>
            <span className="block text-accent">on one calm page.</span>
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
            Attendance with skip budgets, today&apos;s classes, marks and targets, campus services and your FFCS
            plan. Synced from VTOP and kept on your device.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={onGetStarted} className={primary}>
              Get Started
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={onTryDemo} className={secondary}>
              Try the demo
            </button>
          </div>
          <p className="mt-4 text-[13px] text-muted">
            Sign in with your VTOP credentials. They never leave this browser.
          </p>
        </div>
        <HomePreview />
      </section>

      {/* ── Features ── */}
      <section id="features" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
          <div className="max-w-2xl">
            <h2 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">Everything a VIT day needs</h2>
            <p className="mt-3 text-[16px] text-ink-2">
              The parts of VTOP, Moodle and the campus portals you check every day, in one quiet place.
            </p>
          </div>
          <div className="mt-10 grid overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 [&>*]:bg-surface gap-px">
            {FEATURES.map(({ icon: Icon, title, body, link }) => (
              <div key={title} className="flex flex-col gap-2.5 p-6">
                <Icon aria-hidden="true" className="h-5 w-5 text-ink-2" strokeWidth={1.7} />
                <h3 className="text-[16px] font-semibold text-ink">{title}</h3>
                <p className="text-[14.5px] leading-relaxed text-ink-2">{body}</p>
                {link && (
                  <a href={link.href} className="mt-auto pt-1 text-[14px] text-accent hover:underline">
                    {link.label}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Skip budget spotlight ── */}
      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-24">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">Skip budgets, not just percentages</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
              &ldquo;74%&rdquo; tells you there is a problem. &ldquo;Attend the next 1&rdquo; tells you what to do
              about it. Every course is checked against VIT&apos;s 75% minimum, and labs are counted in lab
              sessions, not periods.
            </p>
            <ul className="mt-6 space-y-2 text-[14.5px] text-ink-2">
              <li className="flex gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-danger" /> Red when a course is below the line
              </li>
              <li className="flex gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-warn" /> Amber when you are on it, with no skips left
              </li>
              <li className="flex gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ok" /> Your course&apos;s own colour when you are safe
              </li>
            </ul>
          </div>
          <div>
            <SampleRows />
            <p className="mt-2 text-[12.5px] text-muted">Sample data</p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-24">
          <h2 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="border-t border-line pt-5">
                <span className="font-mono text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 text-[17px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface p-5">
            <p className="mr-auto text-[15px] text-ink-2">Want to look around first? The demo uses sample data.</p>
            <button type="button" onClick={onTryDemo} className={secondary}>
              Try demo
            </button>
            <button type="button" onClick={onGetStarted} className={primary}>
              Sign in with VTOP
            </button>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-20 border-t border-line">
        <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8 md:py-24">
          <h2 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">Questions</h2>
          <ul className="mt-8 divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
            {FAQ.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-[15.5px] font-medium text-ink transition-colors duration-[120ms] hover:bg-surface-2"
                  >
                    {f.q}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn("h-4 w-4 shrink-0 text-muted transition-transform duration-[120ms]", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && <p className="px-5 pb-4 text-[14.5px] leading-relaxed text-ink-2">{f.a}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-[13.5px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>Made by students. Not affiliated with VIT or VTOP.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <a href="/ffcs/" className="hover:text-ink">FFCS planner</a>
            <a href="/privacy/" className="hover:text-ink">Privacy</a>
            <a href="/terms/" className="hover:text-ink">Terms</a>
            <a href="https://github.com/AmazeContinuityProjects/AmazeCC" className="hover:text-ink">GitHub</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
