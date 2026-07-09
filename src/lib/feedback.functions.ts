import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Feedback = {
  id: string;
  debate_id: string;
  topic: string;
  overall_score: number;
  grammar_score: number;
  vocabulary_score: number;
  logic_score: number;
  communication_score: number;
  persuasiveness_score: number;
  strengths: string[];
  weaknesses: string[];
  improvement_suggestions: string[];
  created_at: string;
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callAI(system: string, user: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured.");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty AI response.");
  return text;
}

function clamp(n: unknown): number {
  const v = Math.round(Number(n ?? 0));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

function toStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.trim().length > 0).slice(0, 8);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFeedback(row: any): Feedback {
  return {
    id: row.id,
    debate_id: row.debate_id,
    topic: row.topic,
    overall_score: row.overall_score,
    grammar_score: row.grammar_score,
    vocabulary_score: row.vocabulary_score,
    logic_score: row.logic_score,
    communication_score: row.communication_score,
    persuasiveness_score: row.persuasiveness_score,
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
    improvement_suggestions: Array.isArray(row.improvement_suggestions)
      ? row.improvement_suggestions
      : [],
    created_at: row.created_at,
  };
}

export const generateFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    return { debateId };
  })
  .handler(async ({ data, context }): Promise<Feedback> => {
    // Return existing feedback if already generated
    const { data: existing } = await context.supabase
      .from("feedback")
      .select("*")
      .eq("debate_id", data.debateId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return rowToFeedback(existing);

    const { data: debate, error: dErr } = await context.supabase
      .from("debates")
      .select("id, topic, messages, user_id")
      .eq("id", data.debateId)
      .eq("user_id", context.userId)
      .single();
    if (dErr) throw new Error(dErr.message);

    const messages = (Array.isArray(debate.messages) ? debate.messages : []) as Array<{
      role: string;
      content: string;
    }>;
    const userTurns = messages.filter((m) => m.role === "user");
    const transcript = messages
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n")
      .slice(0, 10000);

    let scores = {
      grammar: 0,
      vocabulary: 0,
      logic: 0,
      communication: 0,
      persuasiveness: 0,
    };
    let strengths: string[] = [];
    let weaknesses: string[] = [];
    let suggestions: string[] = [];

    if (userTurns.length > 0) {
      const raw = await callAI(
        `You are an expert debate coach evaluating a user's performance in a debate.
Return ONLY minified JSON (no markdown, no prose) with this exact shape:
{"grammar":<0-100>,"vocabulary":<0-100>,"logic":<0-100>,"communication":<0-100>,"persuasiveness":<0-100>,"strengths":["...","..."],"weaknesses":["...","..."],"improvement_suggestions":["...","..."]}
Score ONLY the User's turns. Provide 3-5 concise items per list.`,
        `Topic: ${debate.topic}\n\nTranscript:\n${transcript}`,
      );
      try {
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        scores = {
          grammar: clamp(parsed.grammar),
          vocabulary: clamp(parsed.vocabulary),
          logic: clamp(parsed.logic),
          communication: clamp(parsed.communication),
          persuasiveness: clamp(parsed.persuasiveness),
        };
        strengths = toStrArray(parsed.strengths);
        weaknesses = toStrArray(parsed.weaknesses);
        suggestions = toStrArray(parsed.improvement_suggestions);
      } catch {
        weaknesses = ["Could not parse detailed feedback."];
      }
    } else {
      weaknesses = ["No user arguments were recorded in this debate."];
      suggestions = ["Start the debate and respond to the AI to receive scoring."];
    }

    const overall = Math.round(
      (scores.grammar +
        scores.vocabulary +
        scores.logic +
        scores.communication +
        scores.persuasiveness) /
        5,
    );

    const { data: inserted, error: insErr } = await context.supabase
      .from("feedback")
      .insert({
        user_id: context.userId,
        debate_id: data.debateId,
        topic: debate.topic,
        overall_score: overall,
        grammar_score: scores.grammar,
        vocabulary_score: scores.vocabulary,
        logic_score: scores.logic,
        communication_score: scores.communication,
        persuasiveness_score: scores.persuasiveness,
        strengths,
        weaknesses,
        improvement_suggestions: suggestions,
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    await context.supabase.from("activities").insert({
      user_id: context.userId,
      activity_type: "feedback_generated",
      title: `Feedback ready: ${debate.topic}`,
      metadata: { debate_id: data.debateId, overall_score: overall },
    });

    return rowToFeedback(inserted);
  });

export const getFeedbackByDebate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { debateId: string }) => {
    const debateId = String(input?.debateId ?? "").trim();
    if (!debateId) throw new Error("Missing debate");
    return { debateId };
  })
  .handler(async ({ data, context }): Promise<Feedback | null> => {
    const { data: row, error } = await context.supabase
      .from("feedback")
      .select("*")
      .eq("debate_id", data.debateId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? rowToFeedback(row) : null;
  });
