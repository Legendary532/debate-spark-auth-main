import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getDashboard, deleteActivity } from "@/lib/dashboard.functions";
import { getTopics } from "@/lib/topics.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, Target, Flame, Activity, MessageSquare, Sparkles, User, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — DebateGenius AI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const fetchDashboard = useServerFn(getDashboard);
  const fetchTopics = useServerFn(getTopics);
  const removeActivity = useServerFn(deleteActivity);
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data } = useQuery(queryOptions({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() }));
  const { data: topics } = useQuery(queryOptions({ queryKey: ["topics"], queryFn: () => fetchTopics() }));

  async function handleDeleteActivity(id: string) {
    setDeletingId(id);
    try {
      await removeActivity({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["topics"] });
      await qc.invalidateQueries({ queryKey: ["progress"] });
      await qc.invalidateQueries({ queryKey: ["history"] });
      toast.success("Activity removed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove activity");
    } finally {
      setDeletingId(null);
    }
  }

  if (!data) return <div className="animate-pulse text-muted-foreground">Loading your arena...</div>;

  const firstName = (data.profile.full_name || data.profile.email || "Debater").split(" ")[0];
  const stats = [
    { label: "Practice Sessions", value: data.totalSessions, icon: MessageSquare, hint: "Total debates" },
    { label: "Minutes Trained", value: data.totalMinutes, icon: Clock, hint: "Time on stage" },
    { label: "Average Score", value: data.averageScore ?? "—", icon: Target, hint: "Across all sessions" },
    { label: "Best Score", value: data.bestScore ?? "—", icon: Trophy, hint: "Personal record" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Welcome back,</p>
        <h1 className="mt-1 text-4xl font-bold">Hey <span className="text-gradient">{firstName}</span> 👋</h1>
        <p className="mt-2 text-muted-foreground">Here's how your debate practice is going.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-5 shadow-card md:col-span-1">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-primary shadow-glow">
              <User className="h-6 w-6 text-primary-foreground" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{data.profile.full_name || firstName}</div>
              <div className="truncate text-xs text-muted-foreground">{data.profile.email ?? "—"}</div>
            </div>
          </div>
          <Link to="/profile">
            <Button variant="outline" size="sm" className="mt-4 w-full">Edit profile</Button>
          </Link>
        </Card>

        <Card className="p-5 shadow-card md:col-span-2 border-primary/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Current topic
          </div>
          {topics?.current ? (
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xl font-semibold">{topics.current.topic}</div>
                <div className="text-xs text-muted-foreground">
                  {topics.current.category} · {formatDistanceToNow(new Date(topics.current.created_at), { addSuffix: true })}
                </div>
              </div>
              <Link to="/topics">
                <Button variant="outline" size="sm">Change topic</Button>
              </Link>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Choose a debate topic to get started.</p>
              <Link to="/topics">
                <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                  Select topic
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label} className="p-5 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-accent">
                <Icon className="h-4 w-4 text-accent-foreground" />
              </span>
            </div>
            <div className="mt-4 text-3xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 shadow-card lg:col-span-2">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Previous Debate</h2>
          </div>
          {data.lastSession ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Topic</div>
                <div className="mt-1 text-lg font-medium">{data.lastSession.topic}</div>
              </div>
              {data.lastSession.stance && (
                <div className="inline-block rounded-full bg-secondary px-3 py-1 text-xs">
                  Stance: {data.lastSession.stance}
                </div>
              )}
              {data.lastSession.summary && (
                <p className="text-sm text-muted-foreground leading-relaxed">{data.lastSession.summary}</p>
              )}
              <div className="flex items-center gap-4 pt-2 text-sm">
                {typeof data.lastSession.score === "number" && (
                  <span className="font-medium">Score: <span className="text-gradient">{data.lastSession.score}</span></span>
                )}
                <span className="text-muted-foreground">{formatDistanceToNow(new Date(data.lastSession.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">No debates yet — your first session summary will appear here.</p>
            </div>
          )}
        </Card>

        <Card className="p-6 shadow-card">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Progress</h2>
          </div>
          <div className="mt-4 space-y-4">
            <ProgressRow label="Avg score" value={data.averageScore ?? 0} max={100} />
            <ProgressRow label="Best score" value={data.bestScore ?? 0} max={100} />
            <ProgressRow label="Sessions toward 10" value={Math.min(data.totalSessions, 10)} max={10} />
          </div>
        </Card>
      </div>

      <Card className="p-6 shadow-card">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Recent Activity</h2>
        </div>
        {data.recentActivity.length ? (
          <ul className="mt-4 divide-y divide-border">
            {data.recentActivity.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.activity_type}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteActivity(a.id)}
                    disabled={deletingId === a.id}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Remove activity"
                  >
                    {deletingId === a.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Activity from your practice sessions will show up here.</p>
        )}
      </Card>
    </div>
  );
}

function ProgressRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}{max === 100 ? "%" : ` / ${max}`}</span>
      </div>
      <Progress value={pct} className="mt-2" />
    </div>
  );
}
