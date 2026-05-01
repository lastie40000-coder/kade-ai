import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Users, Bot, CreditCard, MessageSquare, AlertTriangle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Link } from "react-router-dom";

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--muted-foreground))", "hsl(var(--secondary))"];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, bots: 0, subs: 0, messages: 0, modActions: 0 });
  const [series, setSeries] = useState<any[]>([]);
  const [planDist, setPlanDist] = useState<any[]>([]);
  const [topBots, setTopBots] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  const loadAll = async () => {
    const [u, b, s, m, ma] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("bots").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).neq("plan", "free"),
      supabase.from("bot_messages").select("id", { count: "exact", head: true }),
      supabase.from("moderation_actions").select("id", { count: "exact", head: true }),
    ]);
    setStats({ users: u.count ?? 0, bots: b.count ?? 0, subs: s.count ?? 0, messages: m.count ?? 0, modActions: ma.count ?? 0 });

    // Last 14 days message volume
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();
    const { data: msgs } = await supabase
      .from("bot_messages").select("created_at,direction").gte("created_at", since);
    const buckets: Record<string, { date: string; in: number; out: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      buckets[d] = { date: d.slice(5), in: 0, out: 0 };
    }
    (msgs || []).forEach((m: any) => {
      const d = m.created_at.slice(0, 10);
      const k = d in buckets ? d : null;
      if (!k) return;
      if (m.direction === "inbound") buckets[k].in++;
      else buckets[k].out++;
    });
    setSeries(Object.values(buckets));

    const { data: subRows } = await supabase.from("subscriptions").select("plan");
    const counts: Record<string, number> = {};
    (subRows || []).forEach((s: any) => { counts[s.plan] = (counts[s.plan] || 0) + 1; });
    setPlanDist(Object.entries(counts).map(([name, value]) => ({ name, value })));

    const { data: bots } = await supabase.from("bots").select("id,name,owner_id");
    const { data: counts2 } = await supabase
      .from("bot_messages")
      .select("bot_id");
    const tally: Record<string, number> = {};
    (counts2 || []).forEach((r: any) => { tally[r.bot_id] = (tally[r.bot_id] || 0) + 1; });
    const top = (bots || []).map(b => ({ name: b.name, count: tally[b.id] || 0 }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
    setTopBots(top);

    const { data: recentMod } = await supabase
      .from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(8);
    setRecent(recentMod || []);
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("admin-overview-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bot_messages" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_actions" }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const cards = [
    { icon: Users, label: "Users", value: stats.users, to: "/admin/users", color: "from-primary/15 to-transparent" },
    { icon: Bot, label: "Bots", value: stats.bots, to: "/admin/bots", color: "from-accent/15 to-transparent" },
    { icon: CreditCard, label: "Paying", value: stats.subs, to: "/admin/users", color: "from-primary/15 to-transparent" },
    { icon: MessageSquare, label: "Messages", value: stats.messages, to: "/admin/messages", color: "from-accent/15 to-transparent" },
    { icon: AlertTriangle, label: "Mod actions", value: stats.modActions, to: "/admin/moderation", color: "from-primary/15 to-transparent" },
  ];

  return (
    <AdminLayout>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary">Owner admin</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-1">Control room</h1>
          <p className="text-ink-soft text-sm mt-2">Live snapshot of every bot, message, and moderation event.</p>
        </div>
        <Badge variant="default" className="gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Live</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}
            className={`group relative overflow-hidden border border-border/50 rounded-xl p-4 bg-gradient-to-br ${c.color} bg-card hover:border-primary/40 hover:shadow-lg transition`}>
            <c.icon className="h-4 w-4 text-primary mb-3" />
            <div className="font-display text-3xl text-ink tracking-tight">{c.value.toLocaleString()}</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-soft mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="lg:col-span-2 border border-border/50 rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-ink flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Message volume — 14 days</h2>
            <div className="flex gap-3 text-xs text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Inbound</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Outbound</span></div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="in" stroke="hsl(var(--primary))" fill="url(#in)" />
              <Area type="monotone" dataKey="out" stroke="hsl(var(--accent))" fill="url(#out)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-border/50 rounded-xl p-5 bg-card">
          <h2 className="font-display text-lg text-ink mb-4">Plan mix</h2>
          {planDist.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No subscriptions yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={planDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                  {planDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="border border-border/50 rounded-xl p-5 bg-card">
          <h2 className="font-display text-lg text-ink mb-4">Top bots by activity</h2>
          {topBots.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topBots} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="border border-border/50 rounded-xl p-5 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-ink flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Recent moderation</h2>
            <Link to="/admin/moderation" className="text-xs text-primary hover:underline">All →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-sm text-ink-soft text-center py-12">No moderation actions yet.</div>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {recent.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-ink truncate"><span className="font-medium capitalize">{m.action}</span> {m.target_user || ""}</div>
                    <div className="text-[11px] text-ink-soft">{m.performed_by || "—"} · {new Date(m.created_at).toLocaleTimeString()}</div>
                  </div>
                  <Badge variant={m.success ? "secondary" : "destructive"} className="text-[10px]">{m.success ? "ok" : "fail"}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
