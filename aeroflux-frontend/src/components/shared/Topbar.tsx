export default function Topbar() {
  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-(--topbar-bg) text-(--topbar-fg) z-10 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Overview</h2>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Notifications
        </button>
        <div className="h-8 w-8 rounded-full bg-(--primary) flex items-center justify-center text-white font-bold">
          A
        </div>
      </div>
    </header>
  );
}

