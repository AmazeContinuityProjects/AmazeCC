"use client";

interface Tab {
  id: string;
  label: string;
}

export default function SubTabStrip({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="w-full overflow-x-auto mb-4" style={{ scrollbarWidth: "none" }}>
      <div className="flex gap-1.5 bg-gray-100  dark:bg-black/50 rounded-xl p-1.5 border border-gray-200/50  dark:border-gray-800/60 min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all duration-300 ${
                isActive
                  ? "bg-white  dark:bg-slate-800 text-blue-600  dark:text-blue-400 shadow-sm border border-gray-200  dark:border-gray-700 scale-100"
                  : "text-gray-500  dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-slate-700/30 dark:hover:bg-slate-800/30 border border-transparent scale-95"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
