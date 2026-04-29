import { Link, NavLink, useNavigate } from "react-router-dom";
import { ReactNode } from "react";
import { Bot, MessageSquare, Users, BookOpen, CreditCard, Settings, Shield, LogOut, Home } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-paper">
      <div className="grid grid-cols-[260px_1fr] min-h-screen">
        <aside className="border-r border-border bg-paper-soft flex flex-col">
          <div className="p-6 border-b border-border">
            <Link to="/" className="font-display text-2xl text-ink">KADE</Link>
            <div className="text-xs text-ink-soft uppercase tracking-widest mt-1">Workspace</div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
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
        </aside>
        <main className="overflow-x-hidden">
          <div className="container max-w-5xl py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
