import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Users, MessageSquare, BookOpen } from "lucide-react";

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
    </DashboardLayout>
  );
}
