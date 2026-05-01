import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

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
          <div key={i} className="p-3 flex gap-3 items-start hover:bg-muted/20">
            <Badge variant="outline" className="text-[10px] capitalize">{e.kind}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-ink-soft">{new Date(e.at).toLocaleTimeString()}</div>
              <pre className="text-xs text-ink mt-0.5 whitespace-pre-wrap break-all line-clamp-3">{JSON.stringify(e.payload, null, 0)}</pre>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
