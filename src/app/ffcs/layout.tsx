import type { Metadata, Viewport } from "next";
import { DEFAULT_FFCS_SEMESTER, getFFCSSemester } from "@/components/custom/exams/FFCS/reports";
import { getAssetPath } from "@/lib/utils";
import PreloadReportCsv from "./PreloadReportCsv";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#03060F" },
  ],
  width: "device-width",
  // This route exports its own viewport (it doesn't inherit the root one), so
  // the app-wide 85% mobile zoom has to be repeated here — otherwise opening
  // /ffcs alone would snap the planner back to 100%. See src/app/layout.tsx
  // for why the scale lives on the viewport instead of CSS `zoom`.
  initialScale: 0.85,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  applicationName: "AmazeCC FFCS",
  title: {
    default: "AmazeCC FFCS - Timetable Planner & Auto-Generator",
    template: "%s | AmazeCC FFCS",
  },
  description: "Offline-first conflict-free timetable planner, smart slot generator, faculty ratings, and class clash resolver for VIT.",
  manifest: "/ffcs-manifest.json",
  icons: {
    icon: [
      { url: "/favicon/FFCS.png", type: "image/png" },
    ],
    shortcut: "/favicon/FFCS.png",
    apple: "/favicon/FFCS.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AmazeCC FFCS",
  },
  openGraph: {
    title: "AmazeCC FFCS - Timetable Planner & Auto-Generator",
    description: "Offline-first conflict-free timetable planner, smart slot generator, faculty ratings, and class clash resolver for VIT.",
    url: "/ffcs/",
    siteName: "AmazeCC FFCS",
    type: "website",
    images: [
      {
        url: "/favicon/FFCS.png",
        width: 512,
        height: 512,
        alt: "AmazeCC FFCS Icon",
      },
    ],
  },
};

export default function FFCSLayout({ children }: { children: React.ReactNode }) {
  // The planner's first act after hydration is fetching the default
  // semester's report (~300 KB). Preloading it from the document head starts
  // that download alongside the route's JS instead of after it, so the course
  // list is ready the moment the effect runs.
  const defaultReportPath = getAssetPath(getFFCSSemester(DEFAULT_FFCS_SEMESTER).path);
  return (
    <>
      <PreloadReportCsv href={defaultReportPath} />
      {children}
    </>
  );
}
