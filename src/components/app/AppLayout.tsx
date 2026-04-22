import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bot, Phone, Settings, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import logo from "@/assets/hexatalks-logo.webp";

const nav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/agents", label: "Agents", icon: Bot },
  { to: "/app/phone-numbers", label: "Phone numbers", icon: Phone },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen w-full bg-surface">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-background">
        <Link to="/" className="flex h-16 items-center border-b border-border px-5">
          <img src={logo} alt="Hexatalks" className="h-7 w-auto" />
        </Link>
        <div className="px-3 pt-4">
          <Button onClick={() => navigate("/app/agents/new")} className="w-full" size="sm"><Plus className="h-4 w-4" /> New agent</Button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}>
              <n.icon className="h-4 w-4" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{user?.email}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate("/"); }} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
};

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-background px-8 py-6">
    <div>
      <h1 className="font-display text-3xl tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions}
  </div>
);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  if (!user) { navigate("/auth", { replace: true }); return null; }
  return <AppLayout>{children}</AppLayout>;
};
