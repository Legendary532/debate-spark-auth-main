import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DebateRole = "user" | "assistant";
export type DebateMessage = {
  id: string;
  role: DebateRole;
  content: string;
  created_at: string;
};

export type Debate = {
  id: string;
  topic: string;
  messages: DebateMessage[];
  for_arguments: string | null;
  against_arguments: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAI(
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured. Please try again later.");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please wait a moment and try again.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in your workspace.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI.");
  return text;
}

function newId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function nowIso() {
  return new Date().toISOString();
}

function rowToDebate(row: {
  id: string;
  topic: string;
  messages: unknown;
  for_arguments: string | null;
  against_arguments: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}): Debate {
  return {
    id: row.id,
    topic: row.topic,
    messages: (Array.isArray(row.messages) ? row.messages : []) as DebateMessage[],
    for_arguments: row.for_arguments,
    against_arguments: row.against_arguments,
    started_at: row.started_at,
    ended_at: row.ended_at,
    duration_seconds: row.duration_seconds,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (supabase: any) => supabase.from("debates");

export const getActiveDebate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Debate | null> => {
    const { data, error } = await table(context.supabase)
      .select("id, topic, messages, for_arguments, against_arguments, started_at, ended_at, duration_seconds")
      .eq("user_id", context.userId)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToDebate(data) : null;
  });

export const startDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { topic: string }) => {
    const topic = String(input?.topic ?? "").trim();
    if (!topic || topic.length > 300) throw new Error("Topic must be 1-300 characters");
    return { topic };
  })
  .handler(async ({ data, context }): Promise<Debate> => {
    const [forArgs, againstArgs, opener] = await Promise.all([
      callAI(
        "You are an expert debate coach. Produce 3 concise, well-reasoned FOR arguments (in favor) on the given topic. Format as a numbered list. No preamble.",
        [{ role: "user", content: `Topic: ${data.topic}` }],
      ),
      callAI(
        "You are an expert debate coach. Produce 3 concise, well-reasoned AGAINST arguments (opposing) on the given topic. Format as a numbered list. No preamble.",
        [{ role: "user", content: `Topic: ${data.topic}` }],
      ),
      callAI(
        "You are a sharp, respectful AI debate opponent. Greet the user in 1 sentence, state you'll challenge their view, and end with ONE pointed opening question about the topic. Keep it under 90 words.",
        [{ role: "user", content: `Topic: ${data.topic}` }],
      ),
    ]);

    const openingMessage: DebateMessage = {
      id: newId(),
      role: "assistant",
      content: opener,
      created_at: nowIso(),
    };

    const { data: inserted, error } = await table(context.supabase)
      .insert({
        user_id: context.userId,
        topic: data.topic,
        messages: [openingMessage],
        for_arguments: forArgs,
        against_arguments: againstArgs,
        started_at: nowIso(),
      })
      .select("id, topic, messages, for_arguments, against_arguments, started_at, ended_at, duration_seconds")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("activities").insert({
      user_id: context.userId,
      activity_type: "debate_started",
      title: `Started debate: ${data.topic}`,
    });

    return rowToDebate(inserted);
  });

export const sendDebateMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string; content: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    const content = String(input?.content ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    if (!content || content.length > 4000) throw new Error("Message must be 1-4000 characters");
    return { debateId, content };
  })
  .handler(async ({ data, context }): Promise<Debate> => {
    const { data: current, error: readErr } = await table(context.supabase)
      .select("id, topic, messages, for_arguments, against_arguments, started_at, ended_at, duration_seconds")
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (current.ended_at) throw new Error("Debate already ended");

    const existing = rowToDebate(current);
    const userMsg: DebateMessage = { id: newId(), role: "user", content: data.content, created_at: nowIso() };

    const history = [...existing.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const reply = await callAI(
      `You are a sharp, respectful AI debate opponent debating the topic: "${existing.topic}".
Rules:
- Give a logical counter-argument to the user's most recent message (2-4 sentences).
- Then ask ONE thought-provoking follow-up debate question.
- Stay on topic, no preamble, no lists, plain prose.
- Keep under 150 words.`,
      history,
    );

    const aiMsg: DebateMessage = { id: newId(), role: "assistant", content: reply, created_at: nowIso() };
    const updatedMessages = [...existing.messages, userMsg, aiMsg];

    const { data: updated, error: upErr } = await table(context.supabase)
      .update({ messages: updatedMessages })
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .select("id, topic, messages, for_arguments, against_arguments, started_at, ended_at, duration_seconds")
      .single();
    if (upErr) throw new Error(upErr.message);
    return rowToDebate(updated);
  });

export const clearDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    return { debateId };
  })
  .handler(async ({ data, context }): Promise<Debate> => {
    const { data: current, error: readErr } = await table(context.supabase)
      .select("topic")
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const opener = await callAI(
      "You are a sharp, respectful AI debate opponent. Greet the user in 1 sentence, say you're resetting the debate, and end with ONE pointed opening question. Under 90 words.",
      [{ role: "user", content: `Topic: ${current.topic}` }],
    );
    const openingMessage: DebateMessage = { id: newId(), role: "assistant", content: opener, created_at: nowIso() };

    const { data: updated, error } = await table(context.supabase)
      .update({ messages: [openingMessage], started_at: nowIso(), duration_seconds: 0 })
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .select("id, topic, messages, for_arguments, against_arguments, started_at, ended_at, duration_seconds")
      .single();
    if (error) throw new Error(error.message);
    return rowToDebate(updated);
  });

export const endDebate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string; duration_seconds: number }) => {
    const debateId = String(input?.debateId ?? "").trim();
    const duration_seconds = Math.max(0, Math.round(Number(input?.duration_seconds ?? 0)));
    if (!debateId) throw new Error("Missing debate");
    return { debateId, duration_seconds };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; summary: string; score: number }> => {
    const { data: current, error: readErr } = await table(context.supabase)
      .select("topic, messages")
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .single();
    if (readErr) throw new Error(readErr.message);

    const messages = (Array.isArray(current.messages) ? current.messages : []) as DebateMessage[];
    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n");

    let summary = "Debate ended.";
    let score = 0;
    if (transcript.trim()) {
      const raw = await callAI(
        `You are a debate judge. Read the transcript on topic "${current.topic}" and return ONLY minified JSON: {"summary":"2-3 sentence summary of the user's performance","score": number 0-100}. No prose, no markdown.`,
        [{ role: "user", content: transcript.slice(0, 8000) }],
      );
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as { summary?: string; score?: number };
        if (parsed.summary) summary = parsed.summary;
        if (typeof parsed.score === "number") score = Math.max(0, Math.min(100, Math.round(parsed.score)));
      } catch {
        summary = raw.slice(0, 400);
      }
    }

    const endedAt = nowIso();
    const { error: upErr } = await table(context.supabase)
      .update({ ended_at: endedAt, duration_seconds: data.duration_seconds })
      .eq("id", data.debateId)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);

    await context.supabase.from("practice_sessions").insert({
      user_id: context.userId,
      topic: current.topic,
      duration_seconds: data.duration_seconds,
      score,
      summary,
      stance: "debater",
    });

    await context.supabase.from("activities").insert({
      user_id: context.userId,
      activity_type: "debate_ended",
      title: `Ended debate: ${current.topic}`,
      metadata: { score, duration_seconds: data.duration_seconds },
    });

    return { ok: true, summary, score };
  });
