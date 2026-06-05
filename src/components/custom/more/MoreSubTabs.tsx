export default function MoreSubTabs({ activeMoreSubTab, setActiveMoreSubTab }) {
  const tabs = [
    { id: "social", label: "Social" },
    { id: "ffcs", label: "FFCS Planner" },
  ];

  return (
    <div className="flex w-full mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveMoreSubTab(tab.id)}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeMoreSubTab === tab.id
              ? "bg-blue-600 text-white midnight:bg-blue-700"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-gray-300 dark:hover:bg-slate-600  midnight:bg-black midnight:text-gray-300 midnight:hover:bg-gray-900"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
