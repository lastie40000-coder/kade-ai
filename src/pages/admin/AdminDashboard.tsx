import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Bot, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bots: 0, subs: 0 });
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [u, b, s, all] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bots").select("id", { count: "exact", head: true }),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "free"),
        supabase.from("profiles").select("*, subscriptions(plan,status), user_roles(role)").order("created_at", { ascending: false }).limit(50),
      ]);
      setStats({ users: u.count ?? 0, bots: b.count ?? 0, subs: s.count ?? 0 });
      setUsers(all.data ?? []);
    })();
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary">Owner admin</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1">Control room</h1>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        {[
          { icon: Users, label: "Users", value: stats.users },
          { icon: Bot, label: "Bots", value: stats.bots },
          { icon: CreditCard, label: "Paying customers", value: stats.subs },
        ].map((c) => (
          <div key={c.label} className="border border-border bg-card rounded-lg p-5">
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-3xl text-ink">{c.value}</div>
            <div className="text-xs uppercase tracking-widest text-ink-soft mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-2xl text-ink mb-4">All users</h2>
      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper-soft text-ink-soft text-xs uppercase tracking-widest">
            <tr><th className="text-left p-3">User</th><th className="text-left p-3">Plan</th><th className="text-left p-3">Roles</th><th className="text-left p-3">Joined</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="p-3"><div className="font-medium text-ink">{u.display_name || "—"}</div><div className="text-xs text-ink-soft">{u.email}</div></td>
                <td className="p-3 capitalize">{u.subscriptions?.[0]?.plan ?? "free"}</td>
                <td className="p-3 flex gap-1 flex-wrap">{(u.user_roles ?? []).map((r: any) => <Badge key={r.role} variant="secondary">{r.role}</Badge>)}</td>
                <td className="p-3 text-ink-soft">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
