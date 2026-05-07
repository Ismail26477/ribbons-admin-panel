import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: AppRole[] }) => {
  const { user, loading, hasRole } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to="/auth" state={{ from: loc }} replace />;
  if (roles && roles.length > 0 && !hasRole(...roles))
    return (
      <div className="flex h-screen items-center justify-center p-8 text-center text-muted-foreground">
        You don't have permission to view this page.
      </div>
    );
  return <>{children}</>;
};
