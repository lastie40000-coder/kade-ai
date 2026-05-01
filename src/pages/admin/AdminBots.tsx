import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminBots() {
  const [bots, setBots] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("bots").select("*").order("created_at", { ascending: false });
    setBots(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (b: any) => {
    const next = b.status === "active" ? "paused" : "active";
    await supabase.from("bots").update({ status: next }).eq("id", b.id);
    load();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete bot? All data goes with it.")) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="font-display text-3xl text-ink mt-1">Bots ({bots.length})</h1>
      </div>
      <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
            <tr><th className="text-left p-3">Bot</th><th className="text-left p-3">Status</th><th className="text-left p-3">Tone</th><th className="text-left p-3">Token</th><th className="text-right p-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {bots.map((b: any) => (
              <tr key={b.id} className="hover:bg-muted/20">
                <td className="p-3"><div className="font-medium text-ink">{b.name}</div><div className="text-xs text-ink-soft">@{b.bot_username || "—"}</div></td>
                <td className="p-3"><Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge></td>
                <td className="p-3 capitalize text-ink-soft">{b.tone || "friendly"}</td>
                <td className="p-3 text-xs text-ink-soft">{b.telegram_bot_token ? "✓" : "—"}</td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggle(b)}>{b.status === "active" ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
