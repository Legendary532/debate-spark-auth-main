import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sparkles, Brain, TrendingUp, Zap, Mic, ShieldCheck, Mail, Github, Twitter,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DebateGenius AI — Master the art of debate" },
      { name: "description", content: "Practice debates with a personalized AI opponent, get instant feedback, and track your rhetorical growth with DebateGenius AI." },
      { property: "og:title", content: "DebateGenius AI — Master the art of debate" },
      { property: "og:description", content: "Practice debates with a personalized AI opponent, get instant feedback, and track your growth." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function LandingNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="#home" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-gradient">DebateGenius AI</span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: "#home", label: "Home" },
            { href: "#features", label: "Features" },
            { href: "#about", label: "About" },
            { href: "#contact", label: "Contact" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link to="/dashboard">
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-hero">
      <LandingNav />

      <main className="mx-auto max-w-6xl px-4">
        <section id="home" className="py-24 text-center scroll-mt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> AI-powered debate coaching
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold sm:text-6xl md:text-7xl">
            Master the art of <span className="text-gradient">debate</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Practice with an AI opponent, get instant feedback, and track your progress from novice to genius.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                Start free
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline">Login</Button>
            </Link>
          </div>
        </section>

        <section id="features" className="grid gap-6 pb-24 sm:grid-cols-2 lg:grid-cols-3 scroll-mt-20">
          {[
            { icon: Brain, title: "AI Opponent", body: "Challenge a debater tuned to your level, any topic, any stance." },
            { icon: Zap, title: "Instant Feedback", body: "Real-time scoring on logic, evidence, and rhetorical strength." },
            { icon: TrendingUp, title: "Track Progress", body: "See sessions, scores, and improvement trends in your dashboard." },
            { icon: Mic, title: "Curated Topics", body: "AI, Education, Politics, Healthcare and more — or bring your own." },
            { icon: ShieldCheck, title: "Private & Secure", body: "Your practice history is protected with row-level security." },
            { icon: Sparkles, title: "Grow Every Day", body: "Sharpen argumentation with structured, repeatable practice." },
          ].map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6 shadow-card">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-accent">
                <Icon className="h-5 w-5 text-accent-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </section>

        <section id="about" className="grid gap-8 pb-24 md:grid-cols-2 md:items-center scroll-mt-20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">About</span>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
              Built for people who <span className="text-gradient">think out loud</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              DebateGenius AI is your always-available sparring partner. Whether you're preparing
              for a school competition, sharpening arguments for work, or exploring ideas for fun,
              our AI adapts to your level and pushes you to think more clearly.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every session becomes a data point in your growth — no dummy metrics, no filler content,
              just real practice you can measure.
            </p>
          </div>
          <Card className="p-6 shadow-card">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { k: "6+", v: "Topic categories" },
                { k: "100%", v: "Private practice" },
                { k: "24/7", v: "AI availability" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="text-3xl font-bold text-gradient">{s.k}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="contact" className="pb-24 scroll-mt-20">
          <Card className="p-8 shadow-card text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-primary">Contact</span>
            <h2 className="mt-3 text-3xl font-bold">Get in touch</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Questions, feedback, or partnership ideas? We'd love to hear from you.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <a href="mailto:hello@debategenius.ai">
                <Button variant="outline">
                  <Mail className="mr-2 h-4 w-4" /> hello@debategenius.ai
                </Button>
              </a>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  Create your account
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded bg-gradient-primary shadow-glow">
              <Sparkles className="h-3 w-3 text-primary-foreground" />
            </span>
            <span>© {new Date().getFullYear()} DebateGenius AI</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" aria-label="Twitter" className="hover:text-foreground"><Twitter className="h-4 w-4" /></a>
            <a href="#" aria-label="GitHub" className="hover:text-foreground"><Github className="h-4 w-4" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
