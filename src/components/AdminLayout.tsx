import { Link, NavLink, useNavigate } from "react-router-dom";
import { ReactNode, useState } from "react";
import {
  Shield, LayoutDashboard, Users, Bot as BotIcon, MessageSquare,
  Activity, AlertTriangle, ArrowLeft, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/admin", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/bots", icon: BotIcon, label: "Bots" },
  { to: "/admin/messages", icon: MessageSquare, label: "Messages" },
  { to: "/admin/moderation", icon: AlertTriangle, label: "Moderation" },
  { to: "/admin/activity", icon: Activity, label: "Live activity" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const SidebarBody = (
    <>
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/admin" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-display text-2xl text-ink">KADE</span>
            </Link>
            <div className="text-xs text-primary uppercase tracking-widest mt-1">Control room</div>
          </div>
          <button className="md:hidden p-2 -mr-2 text-ink-soft hover:text-ink" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                isActive ? "bg-primary text-primary-foreground" : "text-ink-soft hover:text-ink hover:bg-accent"
              }`}>
            <n.icon className="h-4 w-4" />
            {n.label}
          </NavLink>
        ))}

        <NavLink to="/dashboard" onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition mt-6 text-ink-soft hover:text-ink hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
          Back to user dashboard
        </NavLink>
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className="text-xs text-ink-soft truncate mb-2">{user?.email}</div>
        <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); navigate("/"); }}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-border/50 bg-card">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-ink" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /><span className="font-display text-lg text-ink">KADE Admin</span></div>
        <div className="w-9" />
      </header>

      <div className="md:grid md:grid-cols-[260px_1fr] md:min-h-screen">
        <aside className="hidden md:flex border-r border-border/50 bg-card flex-col">{SidebarBody}</aside>

        {mobileOpen && (
          <>
            <div className="md:hidden fixed inset-0 z-40 bg-foreground/40" onClick={() => setMobileOpen(false)} />
            <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-[80%] max-w-xs bg-card border-r border-border/50 flex flex-col animate-in slide-in-from-left">
              {SidebarBody}
            </aside>
          </>
        )}

        <main className="overflow-x-hidden">
          <div className="px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
