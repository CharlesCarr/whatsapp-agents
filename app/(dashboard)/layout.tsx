import Link from "next/link";
import { signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <div className="flex">
        <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
          <div className="flex h-16 items-center px-6 border-b border-zinc-200 dark:border-zinc-800">
            <span className="font-semibold text-sm text-zinc-900 dark:text-white">
              Padel Agents
            </span>
          </div>

          <nav className="p-4 space-y-1 flex-1">
            <NavItem href="/clubs" label="Clubs" />
            <NavItem href="/conversations" label="Conversations" />
            <NavItem href="/activity" label="Booking Activity" />
            <NavItem href="/billing" label="Billing" />
            <div className="pt-2 mt-2 border-t border-zinc-100 dark:border-zinc-800">
              <NavItem href="/test" label="Test Agent" />
            </div>
          </nav>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors text-left"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-60 flex-1 p-8 min-h-screen">{children}</main>
      </div>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors"
    >
      {label}
    </Link>
  );
}
