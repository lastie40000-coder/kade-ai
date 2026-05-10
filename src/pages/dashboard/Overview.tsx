import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Users, MessageSquare, BookOpen, PlusCircle, Settings, Sparkles, ArrowRight } from "lucide-react";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ bots: 0, groups: 0, messages: 0, knowledge: 0 });
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, g, m, k, s] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
      ]);

      setStats({ bots: b.count ?? 0, groups: g.count ?? 0, messages: m.count ?? 0, knowledge: k.count ?? 0 });
      if (s.data?.plan) setPlan(s.data.plan);
    })();
  }, [user]);

  const cards = [
    { icon: Bot, label: "Bots", value: stats.bots, to: "/dashboard/bots" },
    { icon: Users, label: "Groups", value: stats.groups, to: "/dashboard/groups" },
    { icon: BookOpen, label: "Knowledge sources", value: stats.knowledge, to: "/dashboard/knowledge" },
    { icon: MessageSquare, label: "Messages logged", value: stats.messages, to: "/dashboard/messages" },
  ];

  const hasBots = stats.bots > 0;

  const healthItems = useMemo(
    () => [
      {
        title: "Bot coverage",
        value: hasBots ? `${stats.bots} active bot${stats.bots > 1 ? "s" : ""}` : "No bots connected yet",
        hint: hasBots ? "Manage tokens and moderation from Bots." : "Create a bot to start automations.",
        to: "/dashboard/bots",
      },
      {
        title: "Group reach",
        value: stats.groups > 0 ? `${stats.groups} Telegram group${stats.groups > 1 ? "s" : ""}` : "No linked groups",
        hint: stats.groups > 0 ? "Your bots are already deployed in groups." : "Link a group once your bot is ready.",
        to: "/dashboard/groups",
      },
      {
        title: "Knowledge readiness",
        value: stats.knowledge > 0 ? `${stats.knowledge} source${stats.knowledge > 1 ? "s" : ""} indexed` : "No knowledge added",
        hint: stats.knowledge > 0 ? "Your bot can answer with custom context." : "Add docs/URLs to improve responses.",
        to: "/dashboard/knowledge",
      },
    ],
    [hasBots, stats.bots, stats.groups, stats.knowledge]
  );

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

      {!hasBots && (
        <div className="mt-12 rounded-lg border border-border bg-gradient-warm p-8">
          <h2 className="font-display text-2xl text-ink">Get your first bot live</h2>
          <p className="text-ink-soft mt-2 max-w-xl text-sm">
            Create a bot in Telegram with @BotFather, then paste the token here. KADE handles the rest.
          </p>
          <Link to="/dashboard/bots" className="inline-block mt-4 text-sm text-primary font-medium hover:underline">
            Go to Bots →
          </Link>
        </div>
      )}

      <div className="mt-8 grid lg:grid-cols-3 gap-4">
        {healthItems.map((item) => (
          <Link key={item.title} to={item.to} className="rounded-lg border border-border bg-card p-5 hover:shadow-soft transition">
            <div className="text-xs uppercase tracking-widest text-ink-soft">{item.title}</div>
            <div className="font-display text-xl text-ink mt-2">{item.value}</div>
            <div className="text-sm text-ink-soft mt-2">{item.hint}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-xl text-ink mb-4">Overview desk</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/dashboard/bots" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><PlusCircle className="h-4 w-4 text-primary" /> Add or update bot</div>
            <div className="text-sm text-ink-soft mt-2">Connect token, configure moderation, and tune behavior.</div>
          </Link>
          <Link to="/dashboard/knowledge" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><Sparkles className="h-4 w-4 text-primary" /> Improve AI context</div>
            <div className="text-sm text-ink-soft mt-2">Upload files or URLs so KADE replies with your domain knowledge.</div>
          </Link>
          <Link to="/dashboard/settings" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><Settings className="h-4 w-4 text-primary" /> Workspace settings</div>
            <div className="text-sm text-ink-soft mt-2">Manage profile, preferences, and account-level defaults.</div>
          </Link>
        </div>
        <Link to="/dashboard/messages" className="inline-flex items-center gap-2 text-primary text-sm font-medium mt-5 hover:underline">
          Open message activity <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </DashboardLayout>
  );
}
