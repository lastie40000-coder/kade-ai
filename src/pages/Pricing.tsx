import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  {
    id: "free", name: "Free", price: "$0", per: "forever",
    desc: "Try KADE on a single small group.",
    features: ["1 bot", "1 group", "100 messages logged", "Bring your own OpenAI key"],
    cta: "Start free",
  },
  {
    id: "starter", name: "Starter", price: "$19", per: "per month",
    desc: "For one community manager.",
    features: ["3 bots", "10 groups", "10,000 messages logged", "Knowledge sources", "Email support"],
    cta: "Choose Starter", featured: false,
  },
  {
    id: "pro", name: "Pro", price: "$49", per: "per month",
    desc: "For active multi-group communities.",
    features: ["10 bots", "Unlimited groups", "100,000 messages logged", "Advanced rules", "Priority support"],
    cta: "Choose Pro", featured: true,
  },
  {
    id: "business", name: "Business", price: "$149", per: "per month",
    desc: "For agencies and large workspaces.",
    features: ["Unlimited bots", "Unlimited groups", "Unlimited messages", "Team seats", "Dedicated support"],
    cta: "Choose Business",
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const choose = async (planId: string) => {
    if (!user) { window.location.href = "/auth?mode=signup"; return; }
    if (planId === "free") { window.location.href = "/dashboard"; return; }
    setLoading(planId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { plan: planId } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Stripe isn't configured yet. Add your Stripe key in settings to enable checkout.");
    } finally { setLoading(null); }
  };

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="container py-20">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.18em] text-primary mb-3">Pricing</div>
          <h1 className="font-display text-5xl text-ink text-balance">Simple plans. Grow when you're ready.</h1>
          <p className="text-ink-soft mt-4">All plans require your own OpenAI API key — your usage, your control.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {plans.map((p) => (
            <div key={p.id} className={`rounded-xl border p-6 flex flex-col ${p.featured ? "border-primary bg-card shadow-lift" : "border-border bg-card"}`}>
              {p.featured && <div className="text-xs uppercase tracking-widest text-primary mb-2">Most popular</div>}
              <h3 className="font-display text-2xl text-ink">{p.name}</h3>
              <div className="mt-3"><span className="font-display text-4xl text-ink">{p.price}</span> <span className="text-ink-soft text-sm">{p.per}</span></div>
              <p className="text-sm text-ink-soft mt-2">{p.desc}</p>
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {f}</li>
                ))}
              </ul>
              <Button
                onClick={() => choose(p.id)}
                disabled={loading === p.id}
                variant={p.featured ? "editorial" : "warm"}
                className="mt-6 w-full"
              >
                {loading === p.id ? "Loading…" : p.cta}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-ink-soft text-center mt-8">
          Stripe billing — cancel anytime. <Link to="/auth" className="text-primary hover:underline">Already a customer?</Link>
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
