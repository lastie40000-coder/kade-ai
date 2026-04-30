import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, Bot, CreditCard, MessageSquare, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bots: 0, subs: 0, messages: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);

  const loadStats = async () => {
    const [u, b, s, m] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "free"),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }),
    ]);
    setStats({ users: u.count ?? 0, bots: b.count ?? 0, subs: s.count ?? 0, messages: m.count ?? 0 });
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*, subscriptions(plan,status), user_roles(role)")
      .order("created_at", { ascending: false })
      .limit(50);
    setUsers(data ?? []);
  };

  const loadFeed = async () => {
    const { data } = await supabase
      .from("bot_messages")
      .select("id,direction,content,telegram_user,created_at,bots(name)")
      .order("created_at", { ascending: false })
      .limit(30);
    setFeed(data ?? []);
  };

  useEffect(() => {
    loadStats(); loadUsers(); loadFeed();

    const channel = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, (payload) => {
        setFeed((prev) => [payload.new as any, ...prev].slice(0, 30));
        setStats((s) => ({ ...s, messages: s.messages + 1 }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bots" }, () => {
        loadStats();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, () => {
        loadStats(); loadUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const cards = [
    { icon: Users, label: "Users", value: stats.users },
    { icon: Bot, label: "Bots", value: stats.bots },
    { icon: CreditCard, label: "Paying customers", value: stats.subs },
    { icon: MessageSquare, label: "Total messages", value: stats.messages },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary flex items-center gap-2">
            Owner admin <span className="inline-flex items-center gap-1 text-[10px] text-ink-soft"><Activity className="h-3 w-3" /> live</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1">Control room</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {cards.map((c) => (
          <div key={c.label} className="border border-border bg-card rounded-lg p-5">
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-3xl text-ink">{c.value}</div>
            <div className="text-xs uppercase tracking-widest text-ink-soft mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div>
          <h2 className="font-display text-2xl text-ink mb-4">Users</h2>
          <div className="border border-border rounded-lg bg-card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-soft text-ink-soft text-xs uppercase tracking-widest">
                <tr><th className="text-left p-3">User</th><th className="text-left p-3">Plan</th><th className="text-left p-3">Roles</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="p-3"><div className="font-medium text-ink">{u.display_name || "—"}</div><div className="text-xs text-ink-soft">{u.email}</div></td>
                    <td className="p-3 capitalize">{u.subscriptions?.[0]?.plan ?? "free"}</td>
                    <td className="p-3"><div className="flex gap-1 flex-wrap">{(u.user_roles ?? []).map((r: any) => <Badge key={r.role} variant="secondary">{r.role}</Badge>)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl text-ink mb-4 flex items-center gap-2">
            Live activity
            <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          </h2>
          <div className="border border-border rounded-lg bg-card divide-y divide-border max-h-[600px] overflow-y-auto">
            {feed.length === 0 ? (
              <div className="p-6 text-sm text-ink-soft text-center">Waiting for messages…</div>
            ) : feed.map((m: any) => (
              <div key={m.id} className="p-3 flex gap-3 items-start">
                <Badge variant={m.direction === "inbound" ? "secondary" : "default"} className="text-[10px]">{m.direction}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-ink-soft">
                    {m.bots?.name || "—"} · {m.telegram_user || "—"} · {new Date(m.created_at).toLocaleTimeString()}
                  </div>
                  <p className="text-sm text-ink mt-0.5 break-words line-clamp-2">{m.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
