import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Trophy,
  Sparkles,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Loader2,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  generateFeedback,
  getFeedbackByDebate,
  type Feedback,
} from "@/lib/feedback.functions";

export const Route = createFileRoute("/_authenticated/results/$debateId")({
  head: () => ({ meta: [{ title: "Debate Results — DebateGenius AI" }] }),
  component: ResultsPage,
});

const SUBSCORES: Array<{ key: keyof Feedback; label: string }> = [
  { key: "grammar_score", label: "Grammar" },
  { key: "vocabulary_score", label: "Vocabulary" },
  { key: "logic_score", label: "Logic" },
  { key: "communication_score", label: "Communication" },
  { key: "persuasiveness_score", label: "Persuasiveness" },
];

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function ResultsPage() {
  const { debateId } = useParams({ from: "/_authenticated/results/$debateId" });
  const fetchFeedback = useServerFn(getFeedbackByDebate);
  const runGenerate = useServerFn(generateFeedback);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["feedback", debateId],
    queryFn: () => fetchFeedback({ data: { debateId } }),
  });

  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setFeedback(data);
  }, [data]);

  useEffect(() => {
    if (isLoading || generating || feedback) return;
    if (data === null) {
      setGenerating(true);
      setError(null);
      runGenerate({ data: { debateId } })
        .then((f) => setFeedback(f))
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "Failed to generate feedback"),
        )
        .finally(() => setGenerating(false));
    }
  }, [data, isLoading, generating, feedback, debateId, runGenerate]);

  const loading = isLoading || generating || (!feedback && !error);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Button>
        </Link>
        <Link to="/debate">
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4" /> New Debate
          </Button>
        </Link>
      </div>

      {loading && (
        <Card className="p-10 text-center shadow-card">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <h2 className="text-lg font-semibold">Analyzing your debate…</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The AI is reviewing your arguments and preparing a personalized report.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Card>
      )}

      {error && !loading && (
        <Card className="p-8 text-center shadow-card">
          <p className="text-rose-400">{error}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setError(null);
              refetch();
            }}
          >
            Retry
          </Button>
        </Card>
      )}

      {feedback && !loading && (
        <>
          <Card className="overflow-hidden shadow-card border-primary/40">
            <div className="bg-gradient-primary p-6 text-primary-foreground">
              <div className="flex items-center gap-2 text-sm opacity-90">
                <Sparkles className="h-4 w-4" /> Debate Results
              </div>
              <h1 className="mt-1 text-2xl font-bold">{feedback.topic}</h1>
            </div>
            <div className="grid gap-6 p-6 md:grid-cols-[auto,1fr] md:items-center">
              <div className="flex items-center justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-primary/40 bg-card shadow-glow">
                  <div className="text-center">
                    <div className={`text-5xl font-bold ${scoreTone(feedback.overall_score)}`}>
                      {feedback.overall_score}
                    </div>
                    <div className="text-xs text-muted-foreground">/ 100</div>
                  </div>
                  <Trophy className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-card p-1.5 text-primary shadow" />
                </div>
              </div>
              <div className="space-y-4">
                {SUBSCORES.map((s) => {
                  const value = feedback[s.key] as number;
                  return (
                    <div key={s.key}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{s.label}</span>
                        <span className={`font-mono font-semibold ${scoreTone(value)}`}>
                          {value}/100
                        </span>
                      </div>
                      <Progress value={value} />
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2 text-emerald-400">
                <ThumbsUp className="h-5 w-5" />
                <h2 className="font-semibold">Strengths</h2>
              </div>
              {feedback.strengths.length === 0 ? (
                <p className="text-sm text-muted-foreground">No strengths identified yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {feedback.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2 text-rose-400">
                <ThumbsDown className="h-5 w-5" />
                <h2 className="font-semibold">Weaknesses</h2>
              </div>
              {feedback.weaknesses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No weaknesses identified.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {feedback.weaknesses.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                      <span className="text-foreground/90">{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Lightbulb className="h-5 w-5" />
              <h2 className="font-semibold">AI Improvement Suggestions</h2>
            </div>
            {feedback.improvement_suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No suggestions available.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {feedback.improvement_suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-lg border border-border bg-card/50 p-3 text-sm"
                  >
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
