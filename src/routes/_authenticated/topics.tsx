import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getTopics, selectTopic, deleteTopic, TOPIC_CATEGORIES } from "@/lib/topics.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Brain, GraduationCap, Cpu, HeartPulse, CloudRain, Landmark, Sparkles, Loader2, Check, X, Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/topics")({
  head: () => ({ meta: [{ title: "Choose a Topic — DebateGenius AI" }] }),
  component: TopicsPage,
});

const ICONS: Record<string, typeof Brain> = {
  AI: Brain,
  Education: GraduationCap,
  Technology: Cpu,
  Healthcare: HeartPulse,
  "Climate Change": CloudRain,
  Politics: Landmark,
};

function TopicsPage() {
  const fetchTopics = useServerFn(getTopics);
  const saveTopic = useServerFn(selectTopic);
  const removeTopic = useServerFn(deleteTopic);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["topics"], queryFn: () => fetchTopics() });

  const [pending, setPending] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = data?.current ?? null;

  async function pick(category: string) {
    setPending(category);
    try {
      await saveTopic({ data: { category } });
      await qc.invalidateQueries({ queryKey: ["topics"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Topic set: ${category}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save topic");
    } finally {
      setPending(null);
    }
  }

  async function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!custom.trim()) { toast.error("Enter a topic"); return; }
    setCustomLoading(true);
    try {
      await saveTopic({ data: { category: "Custom", topic: custom.trim() } });
      await qc.invalidateQueries({ queryKey: ["topics"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Custom topic saved");
      setCustom("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save topic");
    } finally {
      setCustomLoading(false);
    }
  }

  async function removeCustom(id: string) {
    setDeletingId(id);
    try {
      await removeTopic({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["topics"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Topic deleted");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete topic");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Topic Selection</p>
        <h1 className="mt-1 text-4xl font-bold">Pick a <span className="text-gradient">debate topic</span></h1>
        <p className="mt-2 text-muted-foreground">Choose a category below or bring your own.</p>
      </div>

      {current && (
        <Card className="p-5 shadow-card border-primary/40">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" /> Current topic
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-xl font-semibold">{current.topic}</div>
              <div className="text-xs text-muted-foreground">
                {current.category} · {formatDistanceToNow(new Date(current.created_at), { addSuffix: true })}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              Back to dashboard
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOPIC_CATEGORIES.map((cat) => {
          const Icon = ICONS[cat] ?? Sparkles;
          const active = current?.category === cat;
          const loading = pending === cat;
          return (
            <Card
              key={cat}
              className={`p-5 shadow-card transition ${active ? "border-primary" : "hover:border-primary/50"}`}
            >
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-accent">
                  <Icon className="h-5 w-5 text-accent-foreground" />
                </span>
                {active && <span className="text-xs text-primary">Selected</span>}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{cat}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Debate hot takes and arguments about {cat.toLowerCase()}.</p>
              <Button
                className="mt-4 w-full bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                onClick={() => pick(cat)}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {active ? "Reselect" : "Choose"}
              </Button>
            </Card>
          );
        })}

        <Card className="p-5 shadow-card border-dashed">
          <div className="flex items-start justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold">Custom Topic</h3>
          <p className="mt-1 text-sm text-muted-foreground">Type any topic you want to debate.</p>
          <form onSubmit={submitCustom} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="custom-topic" className="sr-only">Custom topic</Label>
              <Input
                id="custom-topic"
                placeholder="e.g. Universal basic income"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                disabled={customLoading}
              >
                {customLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save custom topic
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCustom("")}
                disabled={customLoading || !custom}
                title="Clear input"
              >
                <X className="h-4 w-4" /> Clear
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {data?.history && data.history.length > 1 && (
        <Card className="p-6 shadow-card">
          <h2 className="text-lg font-semibold">Previous topics</h2>
          <ul className="mt-4 divide-y divide-border">
            {data.history.slice(1).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.topic}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.category}{t.is_custom ? " · Custom" : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </span>
                  {t.is_custom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustom(t.id)}
                      disabled={deletingId === t.id}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Delete custom topic"
                    >
                      {deletingId === t.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
