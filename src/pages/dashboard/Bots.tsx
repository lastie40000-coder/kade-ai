import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot as BotIcon, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

type Bot = {
  id: string; name: string; description: string | null; status: "active" | "paused" | "stopped";
  telegram_bot_token: string | null; openai_api_key: string | null; default_instructions: string | null;
};

export default function Bots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [form, setForm] = useState({ name: "", description: "", telegram_bot_token: "", openai_api_key: "", default_instructions: "" });

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("bots").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
    setBots(data ?? []);
  };

  useEffect(() => { load(); }, [user]);

  const reset = () => {
    setForm({ name: "", description: "", telegram_bot_token: "", openai_api_key: "", default_instructions: "" });
    setEditing(null);
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    if (editing) {
      const { error } = await supabase.from("bots").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Bot updated");
    } else {
      const { error } = await supabase.from("bots").insert({ ...form, owner_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("Bot created");
    }
    setOpen(false); reset(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this bot? All groups, rules and logs go with it.")) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  const toggleStatus = async (b: Bot) => {
    const next = b.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("bots").update({ status: next }).eq("id", b.id);
    if (error) return toast.error(error.message);
    load();
  };

  const startEdit = (b: Bot) => {
    setEditing(b);
    setForm({
      name: b.name, description: b.description ?? "",
      telegram_bot_token: b.telegram_bot_token ?? "", openai_api_key: b.openai_api_key ?? "",
      default_instructions: b.default_instructions ?? "",
    });
    setOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Bots</div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2">Your bots</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="editorial"><Plus className="h-4 w-4" /> New bot</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Edit bot" : "Create a bot"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} /></div>
              <div>
                <Label>Telegram Bot Token</Label>
                <Input value={form.telegram_bot_token} onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })} placeholder="123456:ABC-DEF…" />
                <p className="text-xs text-ink-soft mt-1">Get one from @BotFather on Telegram.</p>
              </div>
              <div>
                <Label>OpenAI API Key</Label>
                <Input type="password" value={form.openai_api_key} onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })} placeholder="sk-…" />
                <p className="text-xs text-ink-soft mt-1">Used for this bot's smart replies. Stored server-side, only you can read it.</p>
              </div>
              <div>
                <Label>Default instructions</Label>
                <Textarea value={form.default_instructions} onChange={(e) => setForm({ ...form, default_instructions: e.target.value })} rows={4} placeholder="You are KADE for Acme Co. Be warm, concise, and cite sources when you can." maxLength={2000} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="editorial" onClick={save}>{editing ? "Save changes" : "Create bot"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bots.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center bg-paper-soft">
          <BotIcon className="h-8 w-8 text-ink-soft mx-auto mb-3" />
          <p className="text-ink-soft">No bots yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bots.map((b) => (
            <div key={b.id} className="border border-border rounded-lg p-4 sm:p-5 bg-card flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h3 className="font-display text-xl text-ink">{b.name}</h3>
                  <Badge variant={b.status === "active" ? "default" : "secondary"} className="capitalize">{b.status}</Badge>
                </div>
                {b.description && <p className="text-sm text-ink-soft mt-1 break-words">{b.description}</p>}
                <div className="text-xs text-ink-soft mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Token: {b.telegram_bot_token ? "✓ set" : "— missing"}</span>
                  <span>OpenAI: {b.openai_api_key ? "✓ set" : "— missing"}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => toggleStatus(b)}>{b.status === "active" ? "Pause" : "Activate"}</Button>
                <Button variant="ghost" size="icon" onClick={() => startEdit(b)}><Edit3 className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
