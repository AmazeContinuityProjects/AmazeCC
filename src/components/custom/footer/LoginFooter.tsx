"use client";

import { useState } from "react";
import { IconToggle } from "../toggle";
import { Button } from "../../ui/button";
import PrivacyPolicyPage from "./PrivacyPolicy";
import TermsOfServicePage from "./TermsOfService";

export default function LoginFooter() {
  const [showPolicy, setShowPolicy] = useState<boolean>(false);
  const [showTOS, setShowTOS] = useState<boolean>(false);

  return (
    <footer className="bg-transparent text-gray-700 dark:text-gray-300 midnight:text-gray-300 flex items-center justify-center">
      {showPolicy && <PrivacyPolicyPage handleClose={() => setShowPolicy(false)} />}
      {showTOS && <TermsOfServicePage handleClose={() => setShowTOS(false)} />}
      <div className="max-w-7xl mx-auto px-3 py-6 text-center w-full">
        <hr className="border-gray-300 dark:border-gray-700 midnight:border-gray-700 w-11/12 mx-auto mb-6" />

        <div className="flex items-center justify-center gap-2 mb-4">
          <p className="text-sm font-medium tracking-wide px-5">
            Made by<br></br>SugeethJSA{" "}
          </p>
          <IconToggle />
        </div>

        <div>
          <Button
            variant="ghost"
            className="mt-2 w-18 h-6 underline text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400"
            onClick={() => setShowPolicy(true)}
          >
            Privacy Policy
          </Button> • 
          <Button
            variant="ghost"
            className="mt-2 ml-1 w-22 h-6 underline text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400"
            onClick={() => setShowTOS(true)}
          >
            Terms of Service
          </Button>
        </div>
      </div>
    </footer>
  );
}
