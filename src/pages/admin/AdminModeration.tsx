import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

export default function AdminModeration() {
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("moderation_actions").select("*, bots(name)").order("created_at", { ascending: false }).limit(200);
    setItems(data ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-mod-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moderation_actions" }, (p) => {
        setItems(prev => [p.new as any, ...prev].slice(0, 200));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-primary" />
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="font-display text-3xl text-ink mt-1">Moderation log</h1>
        </div>
      </div>
      <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
            <tr><th className="text-left p-3">When</th><th className="text-left p-3">Bot</th><th className="text-left p-3">Action</th><th className="text-left p-3">Target</th><th className="text-left p-3">By</th><th className="text-left p-3">Reason</th><th className="text-left p-3">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-ink-soft text-sm">No moderation actions yet.</td></tr>}
            {items.map((m: any) => (
              <tr key={m.id} className="hover:bg-muted/20">
                <td className="p-3 text-xs text-ink-soft whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                <td className="p-3">{m.bots?.name || "—"}</td>
                <td className="p-3 capitalize"><Badge variant="outline">{m.action}</Badge></td>
                <td className="p-3 text-ink-soft">{m.target_user || "—"}</td>
                <td className="p-3 text-ink-soft">{m.performed_by || "—"}</td>
                <td className="p-3 text-ink-soft text-xs">{m.reason || "—"}</td>
                <td className="p-3"><Badge variant={m.success ? "secondary" : "destructive"}>{m.success ? "ok" : "fail"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
