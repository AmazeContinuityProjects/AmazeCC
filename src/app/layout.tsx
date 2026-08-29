import * as React from "react"
import { ThemeProvider } from "@amazecontinuityprojects/amazeui";
import { GoogleAnalytics } from "@next/third-parties/google";
import IconUpdater from "../components/custom/IconUpdater";
import type { Viewport, Metadata } from "next";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import './globals.css';

const geist = Geist({ weight: 'variable', subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const geistMono = Geist_Mono({ weight: 'variable', subsets: ['latin'], display: 'swap', variable: '--font-geist-mono' });
const dmSans = DM_Sans({ weight: 'variable', style: ['normal', 'italic'], subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

const APP_NAME = "AmazeCC";
const APP_DESCRIPTION = "Elevate your university life with seamless timetable syncing, attendance tracking, and smart grade calculations.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: "%s - AmazeCC App",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon/favicon.ico' },
      { url: '/favicon/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon/favicon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.className} ${geistMono.className} ${dmSans.className}`}>
      <body
        suppressHydrationWarning
        className="antialiased font-sans"
      >
        <IconUpdater />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
          value={{ light: "light", dark: "dark" }}
        >
          {children}
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-HGB7VDJKX0" />
    </html>
  );
}