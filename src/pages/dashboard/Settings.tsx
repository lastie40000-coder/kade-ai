import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.display_name ?? ""));
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Settings</div>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mt-2">Your profile</h1>
      </div>
      <div className="border border-border rounded-lg bg-card p-6 max-w-lg space-y-4">
        <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div><Label>Display name</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} /></div>
        <Button variant="editorial" onClick={save} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
      </div>
    </DashboardLayout>
  );
}
