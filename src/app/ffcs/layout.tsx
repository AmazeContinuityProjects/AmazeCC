import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#03060F" },
  ],
  width: "device-width",
  initialScale: 1.0,
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
  return children;
}
