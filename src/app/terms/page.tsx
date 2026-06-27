"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 py-12 bg-gray-50/50  dark:bg-black transition-colors duration-300 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10  dark:bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10  dark:bg-emerald-500/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-2xl space-y-6 relative z-10">
        {/* Back Link */}
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600  dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Login
        </Link>

        {/* Content Card */}
        <div className="bg-white dark:bg-gray-900  border border-gray-200/50  dark:border-white/10 rounded-2xl p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]  dark:shadow-[0_8px_30px_rgba(255,255,255,0.02)] space-y-6 text-gray-700  dark:text-gray-300">
          <div className="border-b border-gray-100  dark:border-white/10 pb-4">
            <h1 className="text-3xl font-black text-gray-900  dark:text-white leading-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-gray-500  dark:text-gray-400 mt-1">
              Last updated: June 23, 2026
            </p>
          </div>

          <div className="space-y-5 text-sm leading-relaxed">
            <p>
              Welcome to <strong>AmazeCC</strong>. By using this application, you agree to the following Terms of Service. Please read them carefully before using the app.
            </p>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Purpose
              </h2>
              <p>
                <strong>AmazeCC</strong> is an experimental web application created solely for educational and personal use. It provides tools to help students view and organize their academic data retrieved from <strong>VTOP</strong> (VIT’s official portal). This app is not an official VIT product and is <strong>not affiliated, endorsed, or maintained by Vellore Institute of Technology (VIT)</strong> in any manner. 
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Data Handling
              </h2>
              <p>
                The app does <strong>not collect, store, or transmit any personal information</strong> to any server. All your login credentials, academic data, and settings remain <strong>entirely on your local device</strong> via browser local storage. Once you close or clear your browser data, all information is removed. 
              </p>
              <p>
                When you log in, the app connects directly to the official <strong>VTOP</strong> website to retrieve your academic data for display. This data is processed locally in your browser and never shared externally. At the same time, the applicatiion also connects to the <strong>Events Hub</strong> website to retrieve your registered events for display. It allows you to download your receipts, your certificates by streaming the download. The app does not handle payments gateway of any sort or kind, and will not receive or send payments. This app provides a beta feature - "Pay Now" button that redirects to the official payment portal, as such does not handle payments. By clicking the pay now button, you automatically accept to the Event Hub Terms and Conditions, and similarly thereof absolve the developer of this site of any responsibility. This data is also processed locally in your browser and never shared externally.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                No Monetization or Commercial Use
              </h2>
              <p>
                <strong>AmazeCC</strong> is a free and non-commercial project. The developer does not earn revenue, display advertisements, sell data, or monetize the service in any way. The app is provided purely for fun, learning, and experimentation purposes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Disclaimer of Liability
              </h2>
              <p>
                The app is provided on an &ldquo;as-is&rdquo; basis with no guarantees of accuracy, reliability, or availability. The developer is <strong>not responsible for any data inaccuracies, login failures, or service interruptions</strong> that may occur due to VTOP updates, VIT Event Hubs updates,or other external factors. 
              </p>
              <p>
                Users are solely responsible for the use of their VTOP credentials within the app. It is recommended to use this app only on trusted devices and networks. You use this application at your own risk and discretion.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Affiliation
              </h2>
              <p>
                This app is an <strong>independent student project</strong> and is in no way affiliated with, endorsed by, or supported by Vellore Institute of Technology (VIT) or any of its departments. This project is created out of personal interest, curiosity and learning, and is not an official VIT product.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Changes to Terms
              </h2>
              <p>
                These terms may be updated periodically to reflect improvements or changes in app behavior. Continued use of the app after updates constitutes acceptance of the revised terms.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900  dark:text-white">
                Contact
              </h2>
              <p>
                For any concerns, questions, or feedback related to this app or these Terms of Service, you can contact the developer at <strong>sugeeth2007@gmail.com</strong>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
