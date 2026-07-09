import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Trash2,
  Eye,
  History as HistoryIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getHistory,
  deleteDebateHistory,
  type HistoryItem,
} from "@/lib/history.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — DebateGenius AI" }] }),
  component: HistoryPage,
});

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function scoreTone(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function HistoryPage() {
  const qc = useQueryClient();
  const fetchHistory = useServerFn(getHistory);
  const deleteFn = useServerFn(deleteDebateHistory);

  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("__all__");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["history", { search, topic, from, to, page }],
    queryFn: () =>
      fetchHistory({
        data: {
          search,
          topic: topic === "__all__" ? "" : topic,
          from: from ? new Date(from).toISOString() : "",
          to: to ? new Date(`${to}T23:59:59`).toISOString() : "",
          page,
          pageSize: PAGE_SIZE,
        },
      }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteFn({ data: { debateId: id } });
      toast.success("Debate deleted");
      qc.invalidateQueries({ queryKey: ["history"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  function resetFilters() {
    setSearch("");
    setTopic("__all__");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HistoryIcon className="h-6 w-6 text-primary" /> Debate History
          </h1>
          <p className="text-sm text-muted-foreground">
            Review, revisit, and manage your past debates.
          </p>
        </div>
        <Link to="/progress">
          <Button variant="outline" size="sm">View progress</Button>
        </Link>
      </div>

      <Card className="p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[1fr,220px,160px,160px,auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search topic…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={topic}
            onValueChange={(v) => {
              setTopic(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="All topics" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="__all__">All topics</SelectItem>
              {data?.topics.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {isLoading && (
          <>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </>
        )}

        {!isLoading && data && data.items.length === 0 && (
          <Card className="p-10 text-center shadow-card">
            <HistoryIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="font-semibold">No debates found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your filters, or start a new debate.
            </p>
            <Link to="/debate" className="mt-4 inline-block">
              <Button className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
                Start debating
              </Button>
            </Link>
          </Card>
        )}

        {!isLoading &&
          data?.items.map((item) => (
            <HistoryRow
              key={item.debate_id}
              item={item}
              deleting={deletingId === item.debate_id}
              onDelete={() => handleDelete(item.debate_id)}
            />
          ))}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} of {totalPages} — {data.total} total
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  item,
  deleting,
  onDelete,
}: {
  item: HistoryItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  const subScores: Array<{ label: string; value: number | null }> = [
    { label: "Grammar", value: item.grammar_score },
    { label: "Vocabulary", value: item.vocabulary_score },
    { label: "Logic", value: item.logic_score },
    { label: "Communication", value: item.communication_score },
    { label: "Persuasiveness", value: item.persuasiveness_score },
  ];

  return (
    <Card className="p-5 shadow-card transition hover:border-primary/40">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{item.topic}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> {item.status}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{formatDate(item.date)}</div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {subScores.map((s) => (
              <div
                key={s.label}
                className="rounded-md border border-border bg-card/50 px-3 py-2"
              >
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </div>
                <div className={`font-mono text-sm font-semibold ${scoreTone(s.value)}`}>
                  {s.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Overall
            </div>
            <div className={`text-3xl font-bold ${scoreTone(item.overall_score)}`}>
              {item.overall_score ?? "—"}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/results/$debateId"
              params={{ debateId: item.debate_id }}
            >
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" /> View
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this debate?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the debate transcript and its feedback. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Card>
  );
}
