import { Link, NavLink, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import { Bot, MessageSquare, Users, BookOpen, CreditCard, Settings, Shield, LogOut, Home, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", icon: Home, label: "Overview", end: true },
  { to: "/dashboard/bots", icon: Bot, label: "Bots" },
  { to: "/dashboard/groups", icon: Users, label: "Groups" },
  { to: "/dashboard/knowledge", icon: BookOpen, label: "Knowledge" },
  { to: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { to: "/dashboard/billing", icon: CreditCard, label: "Billing" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut, isOwner } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarBody = (
    <>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <Link to="/" className="font-display text-2xl text-ink" onClick={() => setMobileOpen(false)}>KADE</Link>
          <div className="text-xs text-ink-soft uppercase tracking-widest mt-1">Workspace</div>
        </div>
        <button
          className="md:hidden p-2 -mr-2 text-ink-soft hover:text-ink"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                isActive ? "bg-foreground text-background" : "text-ink-soft hover:text-ink hover:bg-accent"
              }`
            }
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}
        {isOwner && (
          <NavLink
            to="/admin"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition mt-6 ${
                isActive ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"
              }`
            }
          >
            <Shield className="h-4 w-4" />
            Owner admin
          </NavLink>
        )}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="text-xs text-ink-soft truncate mb-2">{user?.email}</div>
        <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); navigate("/"); }}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border bg-paper-soft">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-ink"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/" className="font-display text-xl text-ink">KADE</Link>
        <div className="w-9" />
      </header>

      <div className="md:grid md:grid-cols-[260px_1fr] md:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex border-r border-border bg-paper-soft flex-col">
          {SidebarBody}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-foreground/40"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[80%] max-w-xs bg-paper-soft border-r border-border flex flex-col animate-in slide-in-from-left">
              {SidebarBody}
            </aside>
          </>
        )}

        <main className="overflow-x-hidden">
          <div className="container max-w-5xl py-6 md:py-10 px-4 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
