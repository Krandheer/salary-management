import { BarChart3, FileSpreadsheet, Users, type LucideIcon } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/import-export', label: 'Import / Export', icon: FileSpreadsheet },
];

export function AppLayout() {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] grid-rows-[56px_1fr]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3"
      >
        Skip to content
      </a>
      <header className="col-span-2 flex items-center border-b bg-card px-6">
        <span className="text-base font-semibold tracking-wide text-primary">ACME</span>
      </header>
      <nav aria-label="Primary" className="border-r bg-card py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className="relative flex h-9 items-center gap-2 px-4 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-0 aria-[current=page]:before:left-0 aria-[current=page]:before:w-[3px] aria-[current=page]:before:bg-primary"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main-content" tabIndex={-1} className="max-w-[1280px] p-6">
        <Outlet />
      </main>
    </div>
  );
}
