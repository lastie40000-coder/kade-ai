import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { toast } from "sonner";

export default function Billing() {
  const { user } = useAuth();
  const [sub, setSub] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setSub(data));
  }, [user]);

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Could not open portal. Set up Stripe first.");
    } finally { setLoading(false); }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-soft">Billing</div>
        <h1 className="font-display text-4xl text-ink mt-2">Plan & billing</h1>
      </div>

      <div className="border border-border rounded-lg bg-card p-8 max-w-2xl">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-ink-soft">Current plan</div>
            <div className="font-display text-3xl text-ink mt-1 capitalize">{sub?.plan ?? "free"}</div>
            <div className="text-sm text-ink-soft mt-1">Status: <span className="capitalize">{sub?.status ?? "active"}</span></div>
          </div>
          <Button asChild variant="editorial"><Link to="/pricing">Change plan</Link></Button>
        </div>
        {sub?.stripe_customer_id && (
          <div className="mt-6 pt-6 border-t border-border">
            <Button variant="outline" onClick={openPortal} disabled={loading}>
              {loading ? "Opening…" : "Manage subscription"}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
