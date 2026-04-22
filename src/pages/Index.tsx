import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mic, Phone, Sparkles, BarChart3, Zap, Shield, Check, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Nav } from "@/components/landing/Nav";
import { VoiceOrb } from "@/components/VoiceOrb";
import { INDUSTRIES } from "@/lib/industries";

const features = [
  { icon: Sparkles, title: "AI-written prompts", desc: "Describe your business once. Hexatalks writes the prompt, first message and goals." },
  { icon: Mic, title: "Test in browser", desc: "Talk to your agent live with one click — no setup, no phone needed." },
  { icon: Phone, title: "Real outbound calls", desc: "Attach a number and launch real phone calls in under 60 seconds." },
  { icon: Globe2, title: "10+ languages", desc: "English, Spanish, French, German, Hindi, Mandarin and more — out of the box." },
  { icon: BarChart3, title: "Transcripts & analytics", desc: "Every call recorded, transcribed and ready to review." },
  { icon: Shield, title: "Secure by default", desc: "Per-user data isolation, encrypted at rest, full audit trail." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Nav />

      {/* Hero — mobile-first */}
      <section className="bg-hero relative overflow-hidden">
        <div className="container px-5 py-16 sm:py-24 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Now in public beta
              </div>
              <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Voice AI agents for <em className="text-accent not-italic">every industry</em>.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg lg:mx-0">
                Build, test and launch human-like voice agents in minutes. Pick your industry, describe your business — Hexatalks does the rest.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Button asChild size="lg" className="w-full sm:w-auto"><Link to="/auth?mode=signup">Build your agent <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><a href="#how">See how it works</a></Button>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground sm:text-sm lg:justify-start">
                <div><span className="font-semibold text-foreground">300M+</span> calls</div>
                <div className="hidden h-3 w-px bg-border sm:block" />
                <div><span className="font-semibold text-foreground">60s</span> setup</div>
                <div className="hidden h-3 w-px bg-border sm:block" />
                <div><span className="font-semibold text-foreground">&lt;800ms</span> latency</div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="flex justify-center">
              <VoiceOrb active size={280} className="sm:hidden" />
              <VoiceOrb active size={360} className="hidden sm:block" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="border-t border-border bg-surface">
        <div className="container px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-accent sm:text-sm">Templates</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl md:text-5xl">Start with your industry</h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">Pre-tuned prompts, voices, and goals for the use cases we see most.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDUSTRIES.map((ind) => (
              <Card key={ind.id} className="group relative overflow-hidden p-5 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elev)] sm:p-6">
                <div className={`absolute inset-0 bg-gradient-to-br ${ind.accent} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground sm:h-11 sm:w-11">
                    <ind.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold sm:text-lg">{ind.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{ind.tagline}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
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
      <section id="features" className="container px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-accent sm:text-sm">Why Hexatalks</p>
          <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl md:text-5xl">Everything you need. Nothing you don't.</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
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
        <div className="container px-5 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-accent sm:text-sm">How it works</p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl md:text-5xl">From idea to live agent in 4 steps</h2>
          </div>
          <div className="mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", t: "Pick an industry", d: "Choose a starting template tuned to your use case." },
              { n: "02", t: "Describe your business", d: "AI writes the prompt, first message and goals for you." },
              { n: "03", t: "Pick a voice", d: "Choose from natural voices and 10+ languages." },
              { n: "04", t: "Launch & call", d: "Talk in your browser or trigger real outbound calls." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="font-display text-3xl text-accent">{s.n}</div>
                <h3 className="mt-3 font-semibold">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="container px-5 py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-primary-foreground sm:rounded-3xl sm:p-14 md:p-20">
          <h2 className="mx-auto max-w-2xl font-display text-3xl tracking-tight sm:text-4xl md:text-5xl">Your first agent is free.</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm opacity-80 sm:text-base">Sign up, build it in a minute, talk to it in your browser. Pay only when you launch real phone calls.</p>
          <Button asChild size="lg" variant="secondary" className="mt-7 w-full sm:w-auto"><Link to="/auth?mode=signup">Start building <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:text-sm">
          <div>© {new Date().getFullYear()} Hexatalks. All rights reserved.</div>
          <div className="flex gap-5"><a href="#" className="hover:text-foreground">Privacy</a><a href="#" className="hover:text-foreground">Terms</a><a href="#" className="hover:text-foreground">Docs</a></div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
