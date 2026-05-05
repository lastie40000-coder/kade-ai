import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Bot as BotIcon, Trash2, Edit3, Lock } from "lucide-react";
import { toast } from "sonner";

type Bot = {
  id: string; name: string; description: string | null;
  status: "active" | "paused" | "stopped";
  telegram_bot_token: string | null;
  default_instructions: string | null;
  tone: string | null;
  personality: string | null;
  house_rules: string | null;
  welcome_message: string | null;
  bot_username: string | null;
};

type BotQuota = { plan: string; current_bots: number; max_bots: number; allowed: boolean };

type QuotaClient = typeof supabase & {
  rpc(fn: "my_bot_quota"): Promise<{ data: BotQuota[] | null; error: unknown }>;
};

const TONES = ["friendly", "professional", "witty", "strict", "hype"];

export default function Bots() {
  const { user } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);
  const [quota, setQuota] = useState<BotQuota | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", telegram_bot_token: "",
    tone: "friendly", personality: "", house_rules: "", welcome_message: "",
    default_instructions: "",
  });

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data }, { data: quotaRows }] = await Promise.all([
      supabase.from("bots").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      (supabase as QuotaClient).rpc("my_bot_quota"),
    ]);
    setBots(data ?? []);
    setQuota(Array.isArray(quotaRows) ? quotaRows[0] ?? null : quotaRows ?? null);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setForm({ name: "", description: "", telegram_bot_token: "", tone: "friendly", personality: "", house_rules: "", welcome_message: "", default_instructions: "" });
    setEditing(null);
  };

  const save = async () => {
    if (!user) return;
    if (!form.name.trim()) return toast.error("Name is required");
    if (!editing && quota && !quota.allowed) {
      return toast.error(`Your ${quota.plan} plan allows ${quota.max_bots} bot${quota.max_bots === 1 ? "" : "s"}.`, {
        action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
      });
    }
    if (editing) {
      const { error } = await supabase.from("bots").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Bot updated");
    } else {
      const { error } = await supabase.from("bots").insert({ ...form, owner_id: user.id, status: "active" });
      if (error) {
        if (error.message?.includes("PLAN_LIMIT_BOTS")) {
          return toast.error("You've hit your plan's bot limit. Upgrade to add more.", {
            action: { label: "See plans", onClick: () => (window.location.href = "/pricing") },
          });
        }
        return toast.error(error.message);
      }
      toast.success("Bot created and activated");
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
    await supabase.from("bots").update({ status: next }).eq("id", b.id);
    load();
  };

  const startEdit = (b: Bot) => {
    setEditing(b);
    setForm({
      name: b.name, description: b.description ?? "",
      telegram_bot_token: b.telegram_bot_token ?? "",
      tone: b.tone ?? "friendly",
      personality: b.personality ?? "",
      house_rules: b.house_rules ?? "",
      welcome_message: b.welcome_message ?? "",
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
          <p className="text-sm text-ink-soft mt-2">Powered by KADE's shared AI. Configure tone &amp; rules here, or DM your bot with /help.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="editorial" disabled={!!quota && !quota.allowed} title={quota && !quota.allowed ? "Upgrade to create more bots" : undefined}>
              {quota && !quota.allowed ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              New bot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Edit bot" : "Create a bot"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} /></div>
              <div><Label>Short description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} /></div>
              <div>
                <Label>Telegram Bot Token</Label>
                <Input value={form.telegram_bot_token} onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })} placeholder="123456:ABC-DEF…" />
                <p className="text-xs text-ink-soft mt-1">From @BotFather on Telegram.</p>
              </div>
              <div>
                <Label>Tone</Label>
                <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Personality (one line)</Label>
                <Input value={form.personality} onChange={(e) => setForm({ ...form, personality: e.target.value })} maxLength={500} placeholder="Sassy librarian who loves indie rock" />
              </div>
              <div>
                <Label>House rules</Label>
                <Textarea value={form.house_rules} onChange={(e) => setForm({ ...form, house_rules: e.target.value })} rows={3} maxLength={2000} placeholder="Be kind. No spam. English only." />
              </div>
              <div>
                <Label>Welcome message (use {"{name}"} for new member)</Label>
                <Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} rows={2} maxLength={1000} placeholder="Hey {name}, welcome to the group!" />
              </div>
              <div>
                <Label>Extra instructions (optional)</Label>
                <Textarea value={form.default_instructions} onChange={(e) => setForm({ ...form, default_instructions: e.target.value })} rows={3} maxLength={2000} />
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
                  <Badge variant="outline" className="capitalize text-xs">{b.tone || "friendly"}</Badge>
                </div>
                {b.description && <p className="text-sm text-ink-soft mt-1 break-words">{b.description}</p>}
                <div className="text-xs text-ink-soft mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Token: {b.telegram_bot_token ? "✓ set" : "— missing"}</span>
                  {b.bot_username && <span>@{b.bot_username}</span>}
                  <span>AI: 🟢 Lovable AI</span>
                </div>
                {b.bot_username && (
                  <p className="text-xs text-primary mt-2">
                    Owner tip: DM <a className="underline" target="_blank" rel="noreferrer" href={`https://t.me/${b.bot_username}`}>@{b.bot_username}</a> with <code>/help</code> to configure from Telegram.
                  </p>
                )}
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
