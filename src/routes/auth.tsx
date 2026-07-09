import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — DebateGenius AI" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);
const nameSchema = z.string().trim().min(1, "Name required").max(100);

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(mode ?? "signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-hero px-4 py-8">
      <div className="mx-auto max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-display font-bold text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <span className="text-gradient">DebateGenius AI</span>
        </Link>
        <Card className="p-6 shadow-card">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
              <TabsTrigger value="forgot">Forgot</TabsTrigger>
            </TabsList>
            <TabsContent value="signin"><SignInForm /></TabsContent>
            <TabsContent value="signup"><SignUpForm /></TabsContent>
            <TabsContent value="forgot"><ForgotForm /></TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function GoogleButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  async function onClick() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error(result.error.message ?? "Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    window.location.href = "/dashboard";
  }
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.5-1.7 4.3-5.5 4.3-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.9 14.7 3 12 3 6.9 3 2.7 7.2 2.7 12.4S6.9 21.8 12 21.8c6.9 0 11.5-4.9 11.5-11.7 0-.8-.1-1.4-.2-1.9H12z"/></svg>
      )}
      {label}
    </Button>
  );
}

function SignInForm() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = z.object({ email: emailSchema, password: passwordSchema }).safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(p.data);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard", replace: true });
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div><Label htmlFor="si-email">Email</Label><Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><Label htmlFor="si-pw">Password</Label><Input id="si-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Sign in
      </Button>
      <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">OR</span></div></div>
      <GoogleButton label="Continue with Google" />
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema }).safeParse({ name, email, password });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: p.data.email, password: p.data.password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: p.data.name } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (data.session) { toast.success("Account created!"); navigate({ to: "/dashboard", replace: true }); }
    else { toast.success("Check your email to confirm your account."); }
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div><Label htmlFor="su-name">Full name</Label><Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
      <div><Label htmlFor="su-email">Email</Label><Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div><Label htmlFor="su-pw">Password</Label><Input id="su-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create account
      </Button>
      <div className="relative py-2"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center"><span className="bg-card px-2 text-xs text-muted-foreground">OR</span></div></div>
      <GoogleButton label="Sign up with Google" />
    </form>
  );
}

function ForgotForm() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = emailSchema.safeParse(email);
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(p.data, { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password reset email sent.");
  }
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link.</p>
      <div><Label htmlFor="fp-email">Email</Label><Input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link
      </Button>
    </form>
  );
}
