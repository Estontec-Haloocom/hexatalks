import { ReactNode, useState } from "react";
import { Link, Navigate, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Bot, Phone, Settings, LogOut, Plus, Menu, X, FileAudio, MessageSquareHeart, Building2, Check, ChevronsUpDown, PlugZap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { useDevSettings } from "@/hooks/use-dev-settings";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import logo from "@/assets/hexatalks-logo.webp";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { orgs, currentOrg, switchOrg } = useOrg();
  const { settings } = useDevSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const nav = [
    { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/agents", label: "Agents", icon: Bot },
    { to: "/app/phone-numbers", label: "Phone numbers", icon: Phone },
    { to: "/app/transcriptions", label: "Transcriptions", icon: FileAudio },
    { to: "/app/feedback", label: "Feedback", icon: MessageSquareHeart },
    ...(settings.dev_mode_enabled ? [{ to: "/app/integrations", label: "Integrations", icon: PlugZap }] : []),
    { to: "/app/organisation", label: "Organisation", icon: Building2 },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ];

  const SidebarInner = (
    <>
      <Link to="/" className="flex h-16 items-center justify-between border-b border-border px-5">
        <img src={logo} alt="Hexatalks" className="h-7 w-auto" />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </Link>
      {/* Org switcher */}
      <div className="px-3 pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:bg-secondary/60">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{currentOrg?.name ?? "No organisation"}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{currentOrg?.role ?? "—"}</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {orgs.map((o) => (
              <DropdownMenuItem key={o.id} onClick={() => switchOrg(o.id)} className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">{o.name}</span>
                {o.is_personal && <Badge variant="outline" className="text-[10px]">Personal</Badge>}
                {o.id === currentOrg?.id && <Check className="h-3.5 w-3.5 text-accent" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { navigate("/app/organisation"); setOpen(false); }}>
              <Plus className="h-3.5 w-3.5" /> Create or manage organisations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
};

