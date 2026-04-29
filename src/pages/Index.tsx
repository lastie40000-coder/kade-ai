import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { MessagesSquare, Shield, BookOpen, Users, Sparkles, Settings2 } from "lucide-react";

const features = [
  { icon: MessagesSquare, title: "Conversations, not just commands", body: "KADE reads context, replies like a thoughtful teammate, and knows when to stay quiet." },
  { icon: BookOpen, title: "Reads your blogs & docs", body: "Point it at your knowledge sources. It cites them when it answers." },
  { icon: Shield, title: "Group administration", body: "Add, remove, mute, warn, pin, schedule. Set rules once, enforce them everywhere." },
  { icon: Users, title: "Multi-bot, multi-group", body: "One workspace for every community you run. Assign rules per bot or per group." },
  { icon: Sparkles, title: "Bring your own AI key", body: "Connect your OpenAI key — your usage, your model choices, your control." },
  { icon: Settings2, title: "Live admin desk", body: "Watch replies in real time. Pause, edit, take over, hand back. Full audit trail." },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />

      {/* HERO */}
      <section className="container pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-soft mb-6">
            <span className="h-px w-8 bg-primary" />
            Knowledge Acquisition & Dynamic Engagement
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] text-ink text-balance">
            A communications desk for your <em className="text-primary not-italic">Telegram</em> community.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-ink-soft max-w-2xl text-balance">
            KADE answers questions from your blog and group history, moderates with the rules you set, and works alongside you — not in place of you.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="editorial" size="xl">
              <Link to="/auth?mode=signup">Start free</Link>
            </Button>
            <Button asChild variant="warm" size="xl">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-soft">Free plan · No card required · Bring your own OpenAI key</p>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border max-w-3xl">
          {[
            { k: "Languages", v: "40+" },
            { k: "Avg response", v: "<2s" },
            { k: "Bots per workspace", v: "Unlimited" },
          ].map((s) => (
            <div key={s.k} className="bg-paper p-6 text-center">
              <div className="font-display text-3xl text-ink">{s.v}</div>
              <div className="text-xs uppercase tracking-widest text-ink-soft mt-1">{s.k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="border-t border-border/60 bg-paper-soft">
        <div className="container py-20 md:py-28">
          <div className="max-w-2xl mb-16">
            <div className="text-xs uppercase tracking-[0.18em] text-primary mb-3">Features</div>
            <h2 className="font-display text-4xl md:text-5xl text-ink text-balance">
              Everything a careful community manager needs.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {features.map((f) => (
              <div key={f.title} className="bg-paper p-8">
                <f.icon className="h-6 w-6 text-primary mb-5" />
                <h3 className="font-display text-xl text-ink mb-2">{f.title}</h3>
                <p className="text-ink-soft text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-primary mb-3">How it works</div>
            <h2 className="font-display text-4xl md:text-5xl text-ink text-balance">
              Set it up in an afternoon. Refine it forever.
            </h2>
          </div>
          <ol className="space-y-8">
            {[
              ["01", "Create your bot in Telegram", "Paste the bot token into KADE — that's it."],
              ["02", "Add knowledge & rules", "Drop blog URLs, write house rules, define tone of voice."],
              ["03", "Add to a group", "Invite KADE. Promote it to admin if you want moderation powers."],
              ["04", "Watch the desk", "See every message and reply in your dashboard. Step in anytime."],
            ].map(([n, t, d]) => (
              <li key={n} className="flex gap-6 border-t border-border pt-6">
                <span className="font-display text-2xl text-primary">{n}</span>
                <div>
                  <div className="font-medium text-ink">{t}</div>
                  <div className="text-ink-soft text-sm mt-1">{d}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-24">
        <div className="rounded-xl border border-border bg-gradient-warm p-12 md:p-16 text-center shadow-lift">
          <h2 className="font-display text-4xl md:text-5xl text-ink text-balance max-w-2xl mx-auto">
            Your community deserves a calm, well-read desk clerk.
          </h2>
          <p className="text-ink-soft mt-4 max-w-xl mx-auto">
            Try KADE free. Upgrade when your community grows.
          </p>
          <Button asChild variant="editorial" size="xl" className="mt-8">
            <Link to="/auth?mode=signup">Create your workspace</Link>
          </Button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
