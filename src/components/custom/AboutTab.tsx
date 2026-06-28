import React from "react";
import { AboutSection } from "./header/AboutSection";
import ResourcesSection from "./ResourcesSection";

export default function AboutTab() {
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
      <ResourcesSection />
    </div>
  );
}
