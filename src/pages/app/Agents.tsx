import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Plus, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { INDUSTRIES } from "@/lib/industries";

type Agent = { id: string; name: string; industry: string; created_at: string; first_message: string };

const Agents = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("agents").select("id,name,industry,created_at,first_message").order("created_at", { ascending: false }).then(({ data }) => {
      setAgents((data as Agent[]) ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <PageHeader title="Agents" description="Voice AI agents you've created." actions={
        <Button asChild><Link to="/app/agents/new"><Plus className="h-4 w-4" /> New agent</Link></Button>
      } />
      <div className="p-8">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : agents.length === 0 ? (
          <Card className="grid place-items-center p-16 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent"><Mic className="h-6 w-6" /></div>
            <h3 className="mt-5 font-display text-2xl tracking-tight">No agents yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">Create your first voice AI agent in under a minute. Pick an industry to get started.</p>
            <Button asChild className="mt-6"><Link to="/app/agents/new">Create your first agent</Link></Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => {
              const ind = INDUSTRIES.find((i) => i.id === a.industry);
              const Icon = ind?.icon ?? Bot;
              return (
                <Link key={a.id} to={`/app/agents/${a.id}`}>
                  <Card className="p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev)]">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{ind?.name ?? a.industry}</div>
                      </div>
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">"{a.first_message}"</p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Agents;