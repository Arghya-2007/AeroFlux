export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] flex flex-col z-20 transition-all border-r border-gray-200 dark:border-gray-800">
      <div className="flex h-16 items-center justify-center border-b border-gray-700">
        <h1 className="text-xl font-bold tracking-wider">AeroFlux</h1>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-2 px-4">
          <li>
            <a href="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700/50 transition-colors">
              <span className="material-icons text-(--primary)">Dashboard</span>
            </a>
          </li>
          <li>
            <a href="/bookings" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700/50 transition-colors">
              <span className="material-icons text-(--primary)">Bookings</span>
            </a>
          </li>
          <li>
            <a href="/travelers" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700/50 transition-colors">
              <span className="material-icons text-(--primary)">Travelers</span>
            </a>
          </li>
        </ul>
      </nav>
      <div className="border-t border-gray-700 p-4">
        <a href="/settings" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-gray-700/50 transition-colors">
          Settings
        </a>
      </div>
    </aside>
  );
}

