import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, MessageSquare, Shield, Bot, UserPlus } from "lucide-react";

const getEventIcon = (kind: string) => {
  switch (kind) {
    case "msg": return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
    case "mod": return <Shield className="h-3.5 w-3.5 text-amber-500" />;
    case "bot": return <Bot className="h-3.5 w-3.5 text-purple-500" />;
    case "user": return <UserPlus className="h-3.5 w-3.5 text-green-500" />;
    default: return <Activity className="h-3.5 w-3.5" />;
  }
};

const getEventSummary = (e: any) => {
  const p = e.payload;
  switch (e.kind) {
    case "msg": return `${p.direction === "inbound" ? "From" : "To"} ${p.telegram_user || "system"}: ${p.content}`;
    case "mod": return `${p.action?.toUpperCase()} ${p.target_user || ""} by ${p.performed_by || "system"}`;
    case "bot": return `Bot "${p.name}" updated (Status: ${p.status})`;
    case "user": return `New signup: ${p.email}`;
    default: return JSON.stringify(p).slice(0, 100);
  }
};

export default function AdminActivity() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const ch = supabase.channel("admin-activity-firehose")
      .on("postgres_changes", { event: "*", schema: "public", table: "bot_messages" }, (p) =>
        setEvents(prev => [{ kind: "msg", at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "*", schema: "public", table: "moderation_actions" }, (p) =>
        setEvents(prev => [{ kind: "mod", at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "*", schema: "public", table: "bots" }, (p) =>
        setEvents(prev => [{ kind: "bot", at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (p) =>
        setEvents(prev => [{ kind: "user", at: Date.now(), payload: p.new }, ...prev].slice(0, 100)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <Activity className="h-5 w-5 text-primary" />
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="font-display text-3xl text-ink mt-1">Live activity</h1>
        </div>
        <Badge variant="default" className="gap-1.5 ml-auto"><span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse" />Streaming</Badge>
      </div>
      <div className="border border-border/50 rounded-xl bg-card divide-y divide-border/40 max-h-[80vh] overflow-y-auto">
        {events.length === 0 && <div className="p-12 text-center text-ink-soft text-sm">Waiting for live events…</div>}
        {events.map((e, i) => (
          <div key={i} className="p-3.5 flex gap-3.5 items-start hover:bg-muted/10 transition-colors">
            <div className="p-2 rounded-lg bg-muted/30">
              {getEventIcon(e.kind)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink uppercase tracking-wider">{e.kind}</span>
                <span className="text-[10px] text-ink-soft">{new Date(e.at).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-ink-soft mt-1 line-clamp-2 leading-relaxed">
                {getEventSummary(e)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
