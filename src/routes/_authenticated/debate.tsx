import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Send,
  Play,
  Square,
  Eraser,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getTopics } from "@/lib/topics.functions";
import {
  getActiveDebate,
  startDebate,
  sendDebateMessage,
  clearDebate,
  endDebate,
  type Debate,
} from "@/lib/debate.functions";

export const Route = createFileRoute("/_authenticated/debate")({
  head: () => ({ meta: [{ title: "Debate — DebateGenius AI" }] }),
  component: DebatePage,
});

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function DebatePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchTopics = useServerFn(getTopics);
  const fetchActive = useServerFn(getActiveDebate);
  const startFn = useServerFn(startDebate);
  const sendFn = useServerFn(sendDebateMessage);
  const clearFn = useServerFn(clearDebate);
  const endFn = useServerFn(endDebate);

  const { data: topics } = useQuery({ queryKey: ["topics"], queryFn: () => fetchTopics() });
  const { data: activeDebate, isLoading: loadingActive } = useQuery({
    queryKey: ["debate", "active"],
    queryFn: () => fetchActive(),
  });

  const [debate, setDebate] = useState<Debate | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeDebate && !debate) {
      setDebate(activeDebate);
      const start = new Date(activeDebate.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }
  }, [activeDebate, debate]);

  useEffect(() => {
    if (!debate || debate.ended_at) return;
    const t = setInterval(() => {
      const start = new Date(debate.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [debate]);

  useEffect(() => {
    const root = scrollerRef.current;
    const el = root?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (el) el.scrollTop = el.scrollHeight;
  }, [debate?.messages.length, sending]);

  const currentTopic = topics?.current?.topic ?? null;

  async function handleStart() {
    if (!currentTopic) {
      toast.error("Select a topic first");
      navigate({ to: "/topics" });
      return;
    }
    setStarting(true);
    try {
      const d = await startFn({ data: { topic: currentTopic } });
      setDebate(d);
      setElapsed(0);
      qc.invalidateQueries({ queryKey: ["debate", "active"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start debate");
    } finally {
      setStarting(false);
    }
  }

  async function handleSend() {
    if (!debate || !input.trim() || sending) return;
    const content = input.trim();
    const optimisticId = `tmp-${Date.now()}`;
    setInput("");
    setSending(true);
    setDebate({
      ...debate,
      messages: [
        ...debate.messages,
        { id: optimisticId, role: "user", content, created_at: new Date().toISOString() },
      ],
    });
    try {
      const updated = await sendFn({ data: { debateId: debate.id, content } });
      setDebate(updated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
      setDebate((d) =>
        d ? { ...d, messages: d.messages.filter((m) => m.id !== optimisticId) } : d,
      );
      setInput(content);
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!debate || clearing) return;
    setClearing(true);
    try {
      const d = await clearFn({ data: { debateId: debate.id } });
      setDebate(d);
      setElapsed(0);
      toast.success("Chat cleared");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  }

  async function handleEnd() {
    if (!debate || ending) return;
    setEnding(true);
    try {
      const debateId = debate.id;
      const res = await endFn({ data: { debateId, duration_seconds: elapsed } });
      toast.success(`Debate ended. Score: ${res.score}`);
      setDebate(null);
      qc.invalidateQueries({ queryKey: ["debate", "active"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      navigate({ to: "/results/$debateId", params: { debateId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to end debate");
    } finally {
      setEnding(false);
    }
  }

  const messages = debate?.messages ?? [];
  const argsBlock = useMemo(
    () =>
      debate?.for_arguments || debate?.against_arguments
        ? { for: debate.for_arguments, against: debate.against_arguments }
        : null,
    [debate],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Card className="p-5 shadow-card border-primary/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Selected Topic
          </div>
          <div className="mt-2 text-xl font-semibold">
            {currentTopic ?? "No topic selected"}
          </div>
          {topics?.current?.category && (
            <div className="mt-1 text-xs text-muted-foreground">{topics.current.category}</div>
          )}
          <div className="mt-4 flex gap-2">
            <Link to="/topics" className="flex-1">
              <Button variant="outline" size="sm" className="w-full">Change topic</Button>
            </Link>
            {debate && (
              <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-mono">{formatDuration(elapsed)}</span>
              </div>
            )}
          </div>
        </Card>

        {argsBlock && (
          <>
            <Card className="p-5 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-400">
                <ThumbsUp className="h-4 w-4" /> FOR arguments
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {argsBlock.for}
              </p>
            </Card>
            <Card className="p-5 shadow-card">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-rose-400">
                <ThumbsDown className="h-4 w-4" /> AGAINST arguments
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {argsBlock.against}
              </p>
            </Card>
          </>
        )}
      </div>

      <Card className="flex h-[calc(100vh-10rem)] flex-col shadow-card lg:col-span-2">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Debate Arena</h2>
          </div>
          <div className="flex items-center gap-2">
            {debate ? (
              <>
                <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing || sending}>
                  {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
                  Clear
                </Button>
                <Button variant="destructive" size="sm" onClick={handleEnd} disabled={ending}>
                  {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  End
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={starting || !currentTopic || loadingActive}
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Start Debate
              </Button>
            )}
          </div>
        </div>

        <ScrollArea ref={scrollerRef} className="flex-1">
          <div className="space-y-4 p-5">
              {loadingActive && !debate && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {!loadingActive && !debate && (
                <div className="mx-auto max-w-md rounded-xl border border-dashed border-border p-10 text-center">
                  <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
                  <h3 className="text-lg font-semibold">Ready when you are</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentTopic
                      ? `Press Start Debate to challenge the AI on "${currentTopic}".`
                      : "Select a topic to begin debating."}
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground shadow-glow"
                        : "max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-2.5"
                    }
                  >
                    <div className="mb-0.5 text-xs opacity-70">
                      {m.role === "user" ? "You" : "AI Opponent"}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3">
                    <div className="mb-1 text-xs text-muted-foreground">AI Opponent</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
              )}
            </div>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={debate ? "Type your argument… (Enter to send, Shift+Enter for newline)" : "Start the debate to begin chatting"}
              disabled={!debate || sending || !!debate?.ended_at}
              rows={2}
              className="resize-none"
            />
            <Button
              onClick={handleSend}
              disabled={!debate || sending || !input.trim()}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
