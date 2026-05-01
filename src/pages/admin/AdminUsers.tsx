import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShieldPlus, ShieldMinus } from "lucide-react";
import { toast } from "sonner";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*, subscriptions(plan,status), user_roles(role)")
      .order("created_at", { ascending: false }).limit(200);
    setUsers(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const grant = async (userId: string, role: "admin" | "owner") => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) return toast.error(error.message);
    toast.success(`${role} granted`); load();
  };
  const revoke = async (userId: string, role: "admin" | "owner") => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) return toast.error(error.message);
    toast.success(`${role} revoked`); load();
  };

  const filtered = users.filter(u =>
    !q || u.email?.toLowerCase().includes(q.toLowerCase()) || u.display_name?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <div className="text-xs uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="font-display text-3xl text-ink mt-1">Users</h1>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <Input placeholder="Search by email or name…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="border border-border/50 rounded-xl bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-ink-soft text-xs uppercase tracking-widest">
              <tr>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Telegram</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Roles</th>
                <th className="text-left p-3">Joined</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((u: any) => {
                const roles = (u.user_roles ?? []).map((r: any) => r.role);
                const isAdmin = roles.includes("admin");
                const isOwner = roles.includes("owner");
                return (
                  <tr key={u.id} className="hover:bg-muted/20">
                    <td className="p-3"><div className="font-medium text-ink">{u.display_name || "—"}</div><div className="text-xs text-ink-soft">{u.email}</div></td>
                    <td className="p-3 text-ink-soft text-xs">{u.telegram_username ? `@${u.telegram_username}` : "—"}</td>
                    <td className="p-3 capitalize">{u.subscriptions?.[0]?.plan ?? "free"}</td>
                    <td className="p-3"><div className="flex gap-1 flex-wrap">{roles.map((r: string) => <Badge key={r} variant={r === "owner" ? "default" : "secondary"}>{r}</Badge>)}</div></td>
                    <td className="p-3 text-xs text-ink-soft">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {isAdmin
                          ? <Button size="sm" variant="ghost" onClick={() => revoke(u.id, "admin")}><ShieldMinus className="h-3.5 w-3.5" /> Admin</Button>
                          : <Button size="sm" variant="outline" onClick={() => grant(u.id, "admin")}><ShieldPlus className="h-3.5 w-3.5" /> Admin</Button>}
                        {!isOwner && <Button size="sm" variant="outline" onClick={() => grant(u.id, "owner")}><ShieldPlus className="h-3.5 w-3.5" /> Owner</Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
