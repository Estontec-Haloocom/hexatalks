import { ReactNode, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bot, Phone, Settings, LogOut, Plus, Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  const SidebarInner = (
    <>
      <Link to="/" className="flex h-16 items-center justify-between border-b border-border px-5">
        <img src={logo} alt="Hexatalks" className="h-7 w-auto" />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </Link>
      <div className="px-3 pt-4">
        <Button onClick={() => { navigate("/app/agents/new"); setOpen(false); }} className="w-full" size="sm">
          <Plus className="h-4 w-4" /> New agent
        </Button>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
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
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-surface">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-background lg:flex">
        {SidebarInner}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-background">
            {SidebarInner}
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="grid h-9 w-9 place-items-center rounded-md hover:bg-secondary">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/"><img src={logo} alt="Hexatalks" className="h-6 w-auto" /></Link>
          <Button size="sm" variant="ghost" onClick={() => navigate("/app/agents/new")}><Plus className="h-4 w-4" /></Button>
        </div>
        {children}
      </main>
    </div>
  );
};

export const PageHeader = ({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-background px-5 py-5 sm:px-8 sm:py-6">
    <div>
      <h1 className="font-display text-2xl tracking-tight sm:text-3xl">{title}</h1>
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
