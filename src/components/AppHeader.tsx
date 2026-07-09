import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function AppHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-gradient">DebateGenius AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          {email ? (
            <>
              <Link to="/dashboard" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>Dashboard</Link>
              <Link to="/topics" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>Topics</Link>
              <Link to="/debate" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>Debate</Link>
              <Link to="/history" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>History</Link>
              <Link to="/progress" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>Progress</Link>
              <Link to="/profile" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "px-3 py-2 text-sm text-foreground font-medium" }}>Profile</Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
