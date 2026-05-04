import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "owner" | "admin" | "user";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  roles: Role[];
  isOwner: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const loadRoles = async (uid: string) => {
    try {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      setRoles((data ?? []).map((r: any) => r.role as Role));
    } finally {
      setRolesLoaded(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      if (s?.user) {
        setRolesLoaded(false);
        setTimeout(() => loadRoles(s.user.id), 0);
      } else {
        setRoles([]);
        setRolesLoaded(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadRoles(s.user.id);
      } else {
        setRolesLoaded(true);
      }
      setLoading(false);
    }).catch(() => { if (mounted) { setLoading(false); setRolesLoaded(true); } });

    const safety = setTimeout(() => { if (mounted) setLoading(false); }, 4000);

    return () => {
      mounted = false;
      clearTimeout(safety);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isOwner = roles.includes("owner");

  return (
    <Ctx.Provider value={{ user, session, loading, rolesLoaded, roles, isOwner, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
