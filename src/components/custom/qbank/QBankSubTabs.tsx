export default function QBankSubTabs({ activeSubTab, setActiveSubTab }) {
  return (
    <div className="flex w-full px-6 pt-2 pb-3 bg-gray-50 dark:bg-gray-900 midnight:bg-black overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      <div className="flex bg-white dark:bg-slate-800 midnight:bg-black rounded-lg p-1 w-full border border-gray-200 dark:border-gray-700 midnight:border-gray-800">
        <button
          onClick={() => setActiveSubTab("archive")}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
            activeSubTab === "archive"
              ? "bg-blue-50 text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm border border-blue-100 dark:border-gray-600 midnight:border-gray-700"
              : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
          }`}
        >
          Papers Archive
        </button>
        <button
          onClick={() => setActiveSubTab("pure")}
          className={`flex-1 px-4 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
            activeSubTab === "pure"
              ? "bg-blue-50 text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm border border-blue-100 dark:border-gray-600 midnight:border-gray-700"
              : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 midnight:hover:text-gray-200"
          }`}
        >
          Pure Questions
        </button>
      </div>
    </div>
  );
}
