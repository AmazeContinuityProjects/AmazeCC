import React from 'react';
import { IconToggle } from '../toggle';

export function AboutSection() {
  return (
    <div className="bg-transparent sm:bg-white/50 dark:sm:bg-slate-900/50 sm:rounded-2xl sm:border sm:border-gray-200/80 dark:sm:border-gray-800 p-6 flex flex-col items-center text-center space-y-4">
      <div className="scale-125 mb-1 shrink-0">
        <IconToggle />
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AmazeCC</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your ultimate college companion application.</p>
      </div>
      
      <div className="w-full max-w-xs grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-left pt-2 border-t border-gray-150 dark:border-gray-800/60 mt-2">
        <div>
          <span className="text-gray-400 font-medium block">Version</span>
          <span className="font-bold text-gray-850 dark:text-gray-200">v2.0.4</span>
        </div>
        <div>
          <span className="text-gray-400 font-medium block">Build Number</span>
          <span className="font-bold text-gray-850 dark:text-gray-200">2026.0627</span>
        </div>
        <div>
          <span className="text-gray-400 font-medium block">Last Updated</span>
          <span className="font-bold text-gray-850 dark:text-gray-200">June 2026</span>
        </div>
        <div>
          <span className="text-gray-400 font-medium block">Platform</span>
          <span className="font-bold text-gray-850 dark:text-gray-200">Web App</span>
        </div>
      </div>
      
      <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 tracking-widest uppercase pt-2 border-t border-gray-150 dark:border-gray-850/60 w-full">
        MADE WITH ❤️ BY SUGEETHJSA AND DHIVYANJ
      </p>
    </div>
  );
}
