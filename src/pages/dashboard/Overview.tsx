import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Users, MessageSquare, BookOpen, ShieldCheck, ShieldAlert } from "lucide-react";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ bots: 0, groups: 0, messages: 0, knowledge: 0 });
  const [plan, setPlan] = useState<string>("free");
  const [security, setSecurity] = useState({ spam: 0, flood: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, g, m, k, s, botsData] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
        supabase.from("bots").select("anti_spam_enabled, anti_flood_enabled").eq("owner_id", user.id),
      ]);

      setStats({ bots: b.count ?? 0, groups: g.count ?? 0, messages: m.count ?? 0, knowledge: k.count ?? 0 });
      if (s.data?.plan) setPlan(s.data.plan);

      const spam = (botsData.data || []).filter(b => b.anti_spam_enabled).length;
      const flood = (botsData.data || []).filter(b => b.anti_flood_enabled).length;
      setSecurity({ spam, flood, total: botsData.data?.length || 0 });
    })();
  }, [user]);

  const cards = [
    { icon: Bot, label: "Bots", value: stats.bots, to: "/dashboard/bots" },
    { icon: Users, label: "Groups", value: stats.groups, to: "/dashboard/groups" },
    { icon: BookOpen, label: "Knowledge sources", value: stats.knowledge, to: "/dashboard/knowledge" },
    { icon: MessageSquare, label: "Messages logged", value: stats.messages, to: "/dashboard/messages" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-10">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Workspace</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2">Welcome back.</h1>
        <p className="text-ink-soft mt-2">
          You're on the <span className="text-ink font-medium capitalize">{plan}</span> plan.{" "}
          <Link to="/dashboard/billing" className="text-primary hover:underline">Manage billing →</Link>
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="border border-border bg-card rounded-lg p-5 hover:shadow-soft transition">
            <c.icon className="h-5 w-5 text-primary mb-3" />
            <div className="font-display text-3xl text-ink">{c.value}</div>
            <div className="text-xs uppercase tracking-widest text-ink-soft mt-1">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-12 rounded-lg border border-border bg-gradient-warm p-8">
        <h2 className="font-display text-2xl text-ink">Get your first bot live</h2>
        <p className="text-ink-soft mt-2 max-w-xl text-sm">
          Create a bot in Telegram with @BotFather, then paste the token here. KADE handles the rest.
        </p>
        <Link to="/dashboard/bots" className="inline-block mt-4 text-sm text-primary font-medium hover:underline">
          Go to Bots →
        </Link>
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="border border-border bg-card rounded-lg p-5 flex items-center gap-4">
          <div className={`p-2 rounded-full ${security.spam === security.total && security.total > 0 ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
            {security.spam === security.total && security.total > 0 ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-soft">Anti-Spam</div>
            <div className="font-display text-xl text-ink">{security.spam}/{security.total} bots</div>
          </div>
        </div>
        <div className="border border-border bg-card rounded-lg p-5 flex items-center gap-4">
          <div className={`p-2 rounded-full ${security.flood === security.total && security.total > 0 ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
            {security.flood === security.total && security.total > 0 ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-soft">Anti-Flood</div>
            <div className="font-display text-xl text-ink">{security.flood}/{security.total} bots</div>
          </div>
        </div>
        <div className="border border-border bg-card rounded-lg p-5 flex items-center gap-4">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-soft">AI Protection</div>
            <div className="font-display text-xl text-ink">Active</div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-8">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-display text-xl text-ink mb-4">Owner DM commands</h3>
          <ul className="space-y-2 text-sm text-ink-soft font-mono">
            <li>/settone &lt;tone&gt;</li>
            <li>/setpersona &lt;description&gt;</li>
            <li>/addknow &lt;text&gt;</li>
            <li>/addurl &lt;url&gt;</li>
            <li>/modon | /modoff</li>
            <li>/banword &lt;word&gt;</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-display text-xl text-ink mb-4">Group commands</h3>
          <ul className="space-y-2 text-sm text-ink-soft font-mono">
            <li>/ban (reply to user)</li>
            <li>/kick (reply to user)</li>
            <li>/mute (reply to user)</li>
            <li>/warn (reply to user)</li>
            <li>/del (reply to user)</li>
            <li>/pin (reply to user)</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
