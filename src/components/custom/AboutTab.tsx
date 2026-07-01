import React, { useState } from "react";
import { AboutSection } from "./header/AboutSection";
import ResourcesSection from "./ResourcesSection";
import HallOfFameModal from "./header/HallOfFameModal";
import ChangelogModal from "./header/ChangelogModal";
import TeamModal from "./header/TeamModal";

export default function AboutTab() {
  const [activeSubpage, setActiveSubpage] = useState<"main" | "hallOfFame" | "changelog" | "team">("main");

  if (activeSubpage === "team") {
    return (
      <div className="animate-fadeIn">
        <TeamModal handleClose={() => setActiveSubpage("main")} />
      </div>
    );
  }

  if (activeSubpage === "hallOfFame") {
    return (
      <div className="animate-fadeIn">
        <HallOfFameModal handleClose={() => setActiveSubpage("main")} />
      </div>
    );
  }

  if (activeSubpage === "changelog") {
    return (
      <div className="animate-fadeIn">
        <ChangelogModal handleClose={() => setActiveSubpage("main")} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pt-2 pb-24 md:pb-8 animate-fadeIn">
      <div className="flex flex-col mb-6">
        <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
          About & Resources
        </h2>
        <p className="text-sm font-semibold text-gray-500 mt-1">
          Information about AmazeCC and helpful links
        </p>
      </div>
      <AboutSection />
      
      <div className="flex flex-col mt-8 mb-4">
        <h3 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Resources
        </h3>
      </div>
      <ResourcesSection setActiveSubpage={setActiveSubpage} />
    </div>
  );
}
