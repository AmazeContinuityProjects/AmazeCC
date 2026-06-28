import * as React from "react"
import { Geist, Geist_Mono, Roboto, Outfit } from 'next/font/google';
import { ThemeProvider } from "../components/themeprovider";
import { GoogleAnalytics } from "@next/third-parties/google";
import IconUpdater from "../components/custom/IconUpdater";
import type { Viewport, Metadata } from "next";
import './globals.css';

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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '500', '700', '800', '900'],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "AmazeCC";
const APP_DESCRIPTION = "Showing data from VTOP in a clean and simple way.";

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
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png'
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} ${outfit.variable} antialiased`}
      >
        <IconUpdater />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          value={{ light: "light", dark: "dark" }}
        >
          {children}
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-40NYS6B13N" />
      <GoogleAnalytics gaId="G-2H76BLP4VK" />
    </html>
  );
}
