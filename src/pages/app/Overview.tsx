import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Phone, Activity, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/app/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Overview = () => {
  const [stats, setStats] = useState({ agents: 0, numbers: 0, calls: 0 });

  useEffect(() => {
    (async () => {
      const [a, n, c] = await Promise.all([
        supabase.from("agents").select("id", { count: "exact", head: true }),
        supabase.from("phone_numbers").select("id", { count: "exact", head: true }),
        supabase.from("calls").select("id", { count: "exact", head: true }),
      ]);
      setStats({ agents: a.count ?? 0, numbers: n.count ?? 0, calls: c.count ?? 0 });
    })();
  }, []);

  const cards = [
    { label: "Agents", value: stats.agents, icon: Bot },
    { label: "Phone numbers", value: stats.numbers, icon: Phone },
    { label: "Calls", value: stats.calls, icon: Activity },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Your voice AI workspace at a glance." />
      <div className="space-y-6 px-5 py-6 sm:space-y-8 sm:p-8">
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">{c.value}</div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden bg-gradient-to-br from-primary to-primary/85 p-6 text-primary-foreground sm:p-8">
          <h2 className="font-display text-xl tracking-tight sm:text-2xl">Build your first voice agent</h2>
          <p className="mt-2 max-w-xl text-sm opacity-80">Pick an industry, describe your business, and we'll generate a production-ready agent in 60 seconds.</p>
          <Button asChild className="mt-5 w-full sm:w-auto" variant="secondary"><Link to="/app/agents/new">Get started <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </Card>
      </div>
    </>
  );
};

export default Overview;
