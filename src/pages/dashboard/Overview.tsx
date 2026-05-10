import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bot, Users, MessageSquare, BookOpen, PlusCircle, Settings, Sparkles, ArrowRight, Shield, AlertTriangle, CheckCircle2 } from "lucide-react";

type BotSetup = {
  id: string;
  telegram_bot_token: string | null;
  welcome_message: string | null;
  banned_words: string[] | null;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ bots: 0, groups: 0, messages: 0, knowledge: 0 });
  const [plan, setPlan] = useState<string>("free");
  const [botSetup, setBotSetup] = useState<BotSetup[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [b, g, m, k, s, botRows] = await Promise.all([
        supabase.from("bots").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("telegram_groups").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("bot_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle(),
        supabase.from("bots").select("id, telegram_bot_token, welcome_message, banned_words").eq("owner_id", user.id),
      ]);

      setStats({ bots: b.count ?? 0, groups: g.count ?? 0, messages: m.count ?? 0, knowledge: k.count ?? 0 });
      if (s.data?.plan) setPlan(s.data.plan);
      setBotSetup(botRows.data ?? []);
    })();
  }, [user]);

  const cards = [
    { icon: Bot, label: "Bots", value: stats.bots, to: "/dashboard/bots" },
    { icon: Users, label: "Groups", value: stats.groups, to: "/dashboard/groups" },
    { icon: BookOpen, label: "Knowledge sources", value: stats.knowledge, to: "/dashboard/knowledge" },
    { icon: MessageSquare, label: "Messages logged", value: stats.messages, to: "/dashboard/messages" },
  ];

  const hasBots = stats.bots > 0;
  const botsWithToken = botSetup.filter((b) => !!b.telegram_bot_token).length;
  const botsWithWelcome = botSetup.filter((b) => !!b.welcome_message).length;
  const botsWithWordSafety = botSetup.filter((b) => (b.banned_words?.length ?? 0) > 0).length;

  const deskChecks = useMemo(
    () => [
      {
        label: "Bot token connected",
        done: hasBots && botsWithToken === stats.bots,
        detail: hasBots ? `${botsWithToken}/${stats.bots} bots connected` : "Create your first bot",
        to: "/dashboard/bots",
      },
      {
        label: "Groups linked",
        done: stats.groups > 0,
        detail: stats.groups > 0 ? `${stats.groups} group${stats.groups > 1 ? "s" : ""} linked` : "No Telegram groups connected",
        to: "/dashboard/groups",
      },
      {
        label: "Knowledge uploaded",
        done: stats.knowledge > 0,
        detail: stats.knowledge > 0 ? `${stats.knowledge} source${stats.knowledge > 1 ? "s" : ""} ready` : "No docs/URLs indexed",
        to: "/dashboard/knowledge",
      },
      {
        label: "Welcome + moderation baseline",
        done: hasBots && botsWithWelcome === stats.bots && botsWithWordSafety === stats.bots,
        detail: hasBots ? `Welcome: ${botsWithWelcome}/${stats.bots}, banned words: ${botsWithWordSafety}/${stats.bots}` : "Set this after creating a bot",
        to: "/dashboard/bots",
      },
    ],
    [hasBots, botsWithToken, stats.bots, stats.groups, stats.knowledge, botsWithWelcome, botsWithWordSafety]
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
          <p className="text-ink-soft mt-2 max-w-xl text-sm">Create a bot in Telegram with @BotFather, then paste the token here. KADE handles the rest.</p>
          <Link to="/dashboard/bots" className="inline-block mt-4 text-sm text-primary font-medium hover:underline">Go to Bots →</Link>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-display text-xl text-ink">Operations desk</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          {deskChecks.map((check) => (
            <Link key={check.label} to={check.to} className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{check.label}</span>
                {check.done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              </div>
              <p className="text-xs text-ink-soft mt-2">{check.detail}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-xl text-ink mb-4">Quick actions</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/dashboard/bots" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><PlusCircle className="h-4 w-4 text-primary" /> Bot setup & moderation</div>
            <div className="text-sm text-ink-soft mt-2">Configure token, tone, house rules, anti-flood, anti-spam, and banned words.</div>
          </Link>
          <Link to="/dashboard/knowledge" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><Sparkles className="h-4 w-4 text-primary" /> Knowledge & persona</div>
            <div className="text-sm text-ink-soft mt-2">Add URLs/files and shape response quality with richer context.</div>
          </Link>
          <Link to="/dashboard/settings" className="rounded-md border border-border p-4 hover:bg-muted/40 transition">
            <div className="flex items-center gap-2 text-ink"><Settings className="h-4 w-4 text-primary" /> Workspace settings</div>
            <div className="text-sm text-ink-soft mt-2">Update workspace defaults and owner preferences.</div>
          </Link>
        </div>
        <Link to="/dashboard/messages" className="inline-flex items-center gap-2 text-primary text-sm font-medium mt-5 hover:underline">
          Open message activity <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </DashboardLayout>
  );
}
