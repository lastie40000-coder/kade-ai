import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children, ownerOnly = false }: { children: ReactNode; ownerOnly?: boolean }) {
  const { user, loading, rolesLoaded, isOwner } = useAuth();
  if (loading || (user && !rolesLoaded)) {
    return <div className="min-h-screen flex items-center justify-center text-ink-soft">Loading…</div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (ownerOnly && !isOwner) return <Navigate to="/dashboard" replace />;
  if (!ownerOnly && isOwner) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
