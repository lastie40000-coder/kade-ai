import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Groups() {
  const { user } = useAuth();
  const [bots, setBots] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bot_id: "", name: "", telegram_chat_id: "", rules: "" });

  const load = async () => {
    if (!user) return;
    const [bs, gs] = await Promise.all([
      supabase.from("bots").select("id,name").eq("owner_id", user.id),
      supabase.from("telegram_groups").select("*, bots(name)").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setBots(bs.data ?? []); setGroups(gs.data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const save = async () => {
    if (!user) return;
    if (!form.bot_id || !form.name.trim()) return toast.error("Bot and name are required");
    const { error } = await supabase.from("telegram_groups").insert({ ...form, owner_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Group added");
    setOpen(false); setForm({ bot_id: "", name: "", telegram_chat_id: "", rules: "" }); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this group?")) return;
    await supabase.from("telegram_groups").delete().eq("id", id);
    load();
  };

  return (
    <DashboardLayout>
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Groups</div>
          <h1 className="font-display text-4xl text-ink mt-2">Telegram groups</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="editorial" disabled={bots.length === 0}><Plus className="h-4 w-4" /> Add group</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Add a group</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Bot</Label>
                <Select value={form.bot_id} onValueChange={(v) => setForm({ ...form, bot_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a bot" /></SelectTrigger>
                  <SelectContent>{bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Group name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} /></div>
              <div><Label>Telegram chat ID (optional)</Label><Input value={form.telegram_chat_id} onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} placeholder="-1001234567890" /></div>
              <div><Label>House rules</Label><Textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={4} maxLength={2000} placeholder="Be kind. No spam. English only…" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="editorial" onClick={save}>Add group</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bots.length === 0 && <p className="text-sm text-ink-soft mb-6">Create a bot first, then attach groups to it.</p>}

      {groups.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <Users className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No groups yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div key={g.id} className="border border-border rounded-lg p-4 bg-card flex items-start justify-between">
              <div>
                <div className="font-medium text-ink">{g.name}</div>
                <div className="text-xs text-ink-soft mt-1">Bot: {g.bots?.name} · Chat ID: {g.telegram_chat_id || "—"}</div>
                {g.rules && <p className="text-sm text-ink-soft mt-2 max-w-2xl">{g.rules}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
