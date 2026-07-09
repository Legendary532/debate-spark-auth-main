import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Trophy,
  Target,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Loader2,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getProgressStats } from "@/lib/history.functions";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — DebateGenius AI" }] }),
  component: ProgressPage,
});

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function ProgressPage() {
  const fetchProgress = useServerFn(getProgressStats);
  const { data, isLoading } = useQuery({
    queryKey: ["progress"],
    queryFn: () => fetchProgress(),
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading progress…
      </div>
    );
  }

  if (data.totalDebates === 0) {
    return (
      <Card className="mx-auto max-w-lg p-10 text-center shadow-card">
        <BarChart3 className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="text-lg font-semibold">No progress yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete your first debate to start tracking your progress.
        </p>
        <Link to="/debate" className="mt-4 inline-block">
          <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            Start a debate
          </Button>
        </Link>
      </Card>
    );
  }

  const trend = data.trend;
  const trendDelta =
    trend.length >= 2 ? trend[trend.length - 1].score - trend[0].score : 0;
  const trendIcon =
    trendDelta > 0 ? (
      <ArrowUpRight className="h-4 w-4 text-emerald-400" />
    ) : trendDelta < 0 ? (
      <ArrowDownRight className="h-4 w-4 text-rose-400" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  const maxTrend = Math.max(100, ...trend.map((t) => t.score));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <TrendingUp className="h-6 w-6 text-primary" /> Progress
          </h1>
          <p className="text-sm text-muted-foreground">
            Track how your debating skills evolve over time.
          </p>
        </div>
        <Link to="/history">
          <Button variant="outline" size="sm">View history</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Total Debates"
          value={String(data.totalDebates)}
          hint={`${data.completedDebates} completed`}
        />
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Average Score"
          value={`${data.averageScore}`}
          hint="out of 100"
          tone={scoreTone(data.averageScore)}
        />
        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Highest Score"
          value={`${data.highestScore}`}
          hint="Personal best"
          tone={scoreTone(data.highestScore)}
        />
        <StatCard
          icon={<ArrowDownRight className="h-4 w-4" />}
          label="Lowest Score"
          value={`${data.lowestScore}`}
          hint="Room to grow"
          tone={scoreTone(data.lowestScore)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Performance Trend</h2>
            </div>
            <div className="flex items-center gap-1 text-sm">
              {trendIcon}
              <span className={trendDelta > 0 ? "text-emerald-400" : trendDelta < 0 ? "text-rose-400" : "text-muted-foreground"}>
                {trendDelta > 0 ? "+" : ""}
                {trendDelta} pts overall
              </span>
            </div>
          </div>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored debates yet.</p>
          ) : (
            <div className="flex h-48 items-end gap-2">
              {trend.map((t, i) => {
                const h = Math.max(4, (t.score / maxTrend) * 100);
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {t.score}
                    </div>
                    <div
                      className="w-full rounded-t bg-gradient-primary shadow-glow transition"
                      style={{ height: `${h}%` }}
                      title={`${formatDate(t.date)} — ${t.score}`}
                    />
                    <div className="text-[10px] text-muted-foreground">
                      {formatDate(t.date)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Skill Averages</h2>
          </div>
          <div className="space-y-3">
            {(
              [
                ["Grammar", data.subScoreAverages.grammar],
                ["Vocabulary", data.subScoreAverages.vocabulary],
                ["Logic", data.subScoreAverages.logic],
                ["Communication", data.subScoreAverages.communication],
                ["Persuasiveness", data.subScoreAverages.persuasiveness],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className={`font-mono ${scoreTone(value)}`}>{value}</span>
                </div>
                <Progress value={value} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 shadow-card">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Recent Performance</h2>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent scored debates.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.topic}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                </div>
                <div className={`font-mono text-lg font-semibold ${scoreTone(r.score)}`}>
                  {r.score}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <Card className="p-5 shadow-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${tone ?? ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
