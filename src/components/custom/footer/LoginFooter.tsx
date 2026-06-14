"use client";

import Link from "next/link";
import { IconToggle } from "../toggle";

export default function LoginFooter() {
  return (
    <footer className="bg-transparent text-gray-700 dark:text-gray-300 midnight:text-gray-300 flex items-center justify-center">
      <div className="max-w-7xl mx-auto px-3 py-6 text-center w-full">
        <hr className="border-gray-300 dark:border-gray-700 midnight:border-gray-700 w-11/12 mx-auto mb-6" />

        <div className="flex items-center justify-center gap-2 mb-4">
          <p className="text-sm font-medium tracking-wide px-5">
            Made by<br></br>SugeethJSA{" "}
          </p>
          <IconToggle />
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400">
          <Link
            href="/privacy"
            className="underline hover:text-gray-700 dark:hover:text-gray-200 midnight:hover:text-gray-200 transition-colors"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            className="underline hover:text-gray-700 dark:hover:text-gray-200 midnight:hover:text-gray-200 transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
