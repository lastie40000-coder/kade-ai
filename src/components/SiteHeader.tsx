import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function SiteHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/60 bg-paper/80 backdrop-blur sticky top-0 z-40">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-ink">
            KADE
          </span>
          <span className="hidden sm:inline text-xs text-ink-soft uppercase tracking-widest">
            · The communications desk
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-ink-soft">
          <Link to="/#features" className="hover:text-ink transition">Features</Link>
          <Link to="/#how" className="hover:text-ink transition">How it works</Link>
          <Link to="/pricing" className="hover:text-ink transition">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
              <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>Log in</Button>
              <Button variant="editorial" size="sm" onClick={() => navigate("/auth?mode=signup")}>Get started</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
