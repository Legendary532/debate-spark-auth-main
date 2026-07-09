import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HistoryItem = {
  debate_id: string;
  topic: string;
  date: string;
  ended_at: string | null;
  duration_seconds: number;
  status: "Completed" | "In Progress";
  overall_score: number | null;
  grammar_score: number | null;
  vocabulary_score: number | null;
  logic_score: number | null;
  communication_score: number | null;
  persuasiveness_score: number | null;
  has_feedback: boolean;
};

export type HistoryPage = {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  topics: string[];
};

export type ProgressStats = {
  totalDebates: number;
  completedDebates: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  totalMinutes: number;
  recent: Array<{ date: string; topic: string; score: number }>;
  trend: Array<{ date: string; score: number }>;
  subScoreAverages: {
    grammar: number;
    vocabulary: number;
    logic: number;
    communication: number;
    persuasiveness: number;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toItem(debate: any, feedback: any | null): HistoryItem {
  return {
    debate_id: debate.id,
    topic: debate.topic,
    date: debate.started_at ?? debate.created_at,
    ended_at: debate.ended_at,
    duration_seconds: debate.duration_seconds ?? 0,
    status: debate.ended_at ? "Completed" : "In Progress",
    overall_score: feedback?.overall_score ?? null,
    grammar_score: feedback?.grammar_score ?? null,
    vocabulary_score: feedback?.vocabulary_score ?? null,
    logic_score: feedback?.logic_score ?? null,
    communication_score: feedback?.communication_score ?? null,
    persuasiveness_score: feedback?.persuasiveness_score ?? null,
    has_feedback: !!feedback,
  };
}

export const getHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      search?: string;
      topic?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    }) => {
      const page = Math.max(1, Math.round(Number(input?.page ?? 1)));
      const pageSize = Math.min(50, Math.max(1, Math.round(Number(input?.pageSize ?? 10))));
      return {
        search: (input?.search ?? "").trim().slice(0, 200),
        topic: (input?.topic ?? "").trim().slice(0, 200),
        from: (input?.from ?? "").trim(),
        to: (input?.to ?? "").trim(),
        page,
        pageSize,
      };
    },
  )
  .handler(async ({ data, context }): Promise<HistoryPage> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = context.supabase
      .from("debates")
      .select("id, topic, started_at, ended_at, created_at, duration_seconds", { count: "exact" })
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (data.search) query = query.ilike("topic", `%${data.search}%`);
    if (data.topic) query = query.eq("topic", data.topic);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);

    const fromIdx = (data.page - 1) * data.pageSize;
    const toIdx = fromIdx + data.pageSize - 1;
    query = query.range(fromIdx, toIdx);

    const { data: debates, error, count } = await query;
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ids = (debates ?? []).map((d: any) => d.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feedbackMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: fbs, error: fbErr } = await context.supabase
        .from("feedback")
        .select(
          "debate_id, overall_score, grammar_score, vocabulary_score, logic_score, communication_score, persuasiveness_score",
        )
        .eq("user_id", context.userId)
        .in("debate_id", ids);
      if (fbErr) throw new Error(fbErr.message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      feedbackMap = new Map((fbs ?? []).map((f: any) => [f.debate_id, f]));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (debates ?? []).map((d: any) => toItem(d, feedbackMap.get(d.id) ?? null));

    const { data: topicRows } = await context.supabase
      .from("debates")
      .select("topic")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topics = Array.from(new Set((topicRows ?? []).map((r: any) => r.topic as string))).sort();

    return { items, total: count ?? items.length, page: data.page, pageSize: data.pageSize, topics };
  });

export const getDebateDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    return { debateId };
  })
  .handler(async ({ data, context }) => {
    const { data: debate, error } = await context.supabase
      .from("debates")
      .select("*")
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);

    const { data: feedback } = await context.supabase
      .from("feedback")
      .select("*")
      .eq("debate_id", data.debateId)
      .eq("user_id", context.userId)
      .maybeSingle();

    return { debate, feedback };
  });

export const deleteDebateHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    return { debateId };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Feedback has ON DELETE CASCADE via debates FK.
    const { error } = await context.supabase
      .from("debates")
      .delete()
      .eq("id", data.debateId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProgressStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressStats> => {
    const { data: debates, error: dErr } = await context.supabase
      .from("debates")
      .select("id, topic, created_at, ended_at, duration_seconds")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (dErr) throw new Error(dErr.message);

    const { data: feedback, error: fErr } = await context.supabase
      .from("feedback")
      .select(
        "debate_id, topic, overall_score, grammar_score, vocabulary_score, logic_score, communication_score, persuasiveness_score, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (fErr) throw new Error(fErr.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDebates = (debates ?? []) as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allFeedback = (feedback ?? []) as any[];

    const totalDebates = allDebates.length;
    const completedDebates = allDebates.filter((d) => !!d.ended_at).length;
    const totalMinutes = Math.round(
      allDebates.reduce((s, d) => s + (d.duration_seconds ?? 0), 0) / 60,
    );

    const scores = allFeedback.map((f) => f.overall_score as number);
    const averageScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const highestScore = scores.length ? Math.max(...scores) : 0;
    const lowestScore = scores.length ? Math.min(...scores) : 0;

    const avg = (k: keyof (typeof allFeedback)[number]) =>
      allFeedback.length
        ? Math.round(
            allFeedback.reduce((s, f) => s + ((f[k] as number) ?? 0), 0) / allFeedback.length,
          )
        : 0;

    const trend = allFeedback.map((f) => ({
      date: f.created_at as string,
      score: f.overall_score as number,
    }));

    const recent = [...allFeedback]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map((f) => ({
        date: f.created_at as string,
        topic: f.topic as string,
        score: f.overall_score as number,
      }));

    return {
      totalDebates,
      completedDebates,
      averageScore,
      highestScore,
      lowestScore,
      totalMinutes,
      recent,
      trend,
      subScoreAverages: {
        grammar: avg("grammar_score"),
        vocabulary: avg("vocabulary_score"),
        logic: avg("logic_score"),
        communication: avg("communication_score"),
        persuasiveness: avg("persuasiveness_score"),
      },
    };
  });
