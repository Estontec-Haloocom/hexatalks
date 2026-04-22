import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Phone, Sparkles, BarChart3, Zap, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Nav } from "@/components/landing/Nav";
import { VoiceOrb } from "@/components/VoiceOrb";
import { INDUSTRIES } from "@/lib/industries";

const features = [
  { icon: Sparkles, title: "AI-written prompts", desc: "Describe your business once. Hexatalks writes the system prompt, first message, and goals." },
  { icon: Mic, title: "Test in your browser", desc: "Talk to your agent live with one click — no setup, no phone needed." },
  { icon: Phone, title: "Real outbound calls", desc: "Attach a phone number and launch real calls in under 60 seconds." },
  { icon: BarChart3, title: "Transcripts & analytics", desc: "Every call recorded, transcribed, scored, and ready to review." },
  { icon: Zap, title: "Sub-second latency", desc: "Powered by best-in-class voice infrastructure — under 800ms response time." },
  { icon: Shield, title: "Secure by default", desc: "Per-user data isolation, SOC2-grade infrastructure, full audit trail." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero */}
      <section className="bg-hero relative overflow-hidden">
        <div className="container grid items-center gap-12 py-20 md:py-32 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Now in public beta
            </div>
            <h1 className="font-display text-5xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              Voice AI agents for <em className="text-accent not-italic">every industry</em>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Build, test and launch human-like voice agents in minutes. Pick your industry, describe your business — Hexatalks does the rest.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth?mode=signup">Build your agent <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline"><a href="#how">See how it works</a></Button>
            </div>
            <div className="mt-10 flex items-center gap-6 text-sm text-muted-foreground">
              <div><span className="font-semibold text-foreground">300M+</span> calls handled</div>
              <div className="h-4 w-px bg-border" />
              <div><span className="font-semibold text-foreground">60s</span> avg setup</div>
              <div className="h-4 w-px bg-border" />
              <div><span className="font-semibold text-foreground">&lt;800ms</span> latency</div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="flex justify-center">
            <VoiceOrb active size={360} />
          </motion.div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="border-t border-border bg-surface">
        <div className="container py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">Templates</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Start with your industry</h2>
            <p className="mt-4 text-muted-foreground">Pre-tuned prompts, voices, and goals for the use cases we see most.</p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <Card key={ind.id} className="group relative overflow-hidden p-6 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elev)]">
                <div className={`absolute inset-0 bg-gradient-to-br ${ind.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
                    <ind.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{ind.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{ind.tagline}</p>
                  <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    {ind.goals.map((g) => (
                      <li key={g} className="flex items-center gap-1.5"><Check className="h-3 w-3 text-success" />{g}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-accent">Why Hexatalks</p>
          <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">Everything you need. Nothing you don't.</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-surface">
        <div className="container py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-accent">How it works</p>
            <h2 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">From idea to live agent in 4 steps</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Pick an industry", d: "Choose a starting template tuned to your use case." },
              { n: "02", t: "Describe your business", d: "AI writes the prompt, first message and goals for you." },
              { n: "03", t: "Pick a voice", d: "Test voices instantly. Adjust model, language, temperature." },
              { n: "04", t: "Launch & call", d: "Talk in your browser or trigger real outbound calls." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-card p-6">
                <div className="font-display text-3xl text-accent">{s.n}</div>
                <h3 className="mt-3 font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="container py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary to-primary/80 p-12 text-center text-primary-foreground md:p-20">
          <h2 className="mx-auto max-w-2xl font-display text-4xl tracking-tight md:text-5xl">Your first agent is free.</h2>
          <p className="mx-auto mt-4 max-w-lg opacity-80">Sign up, build it in a minute, talk to it in your browser. Pay only when you launch real phone calls.</p>
          <Button asChild size="lg" variant="secondary" className="mt-8"><Link to="/auth?mode=signup">Start building <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Hexatalks. All rights reserved.</div>
          <div className="flex gap-6"><a href="#" className="hover:text-foreground">Privacy</a><a href="#" className="hover:text-foreground">Terms</a><a href="#" className="hover:text-foreground">Docs</a></div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
