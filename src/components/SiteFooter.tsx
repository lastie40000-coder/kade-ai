import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="container py-12 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="font-display text-xl text-ink">KADE</div>
          <p className="text-ink-soft mt-2 max-w-xs">
            Knowledge Acquisition & Dynamic Engagement — the calm communications desk for your Telegram community.
          </p>
        </div>
        <div>
          <div className="font-medium mb-3">Product</div>
          <ul className="space-y-2 text-ink-soft">
            <li><Link to="/#features" className="hover:text-ink">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-ink">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-medium mb-3">Account</div>
          <ul className="space-y-2 text-ink-soft">
            <li><Link to="/auth" className="hover:text-ink">Log in</Link></li>
            <li><Link to="/auth?mode=signup" className="hover:text-ink">Sign up</Link></li>
          </ul>
        </div>
        <div className="text-ink-soft">
          © {new Date().getFullYear()} KADE
        </div>
      </div>
    </footer>
  );
}
