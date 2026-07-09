import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardStats = {
  totalSessions: number;
  totalMinutes: number;
  averageScore: number | null;
  bestScore: number | null;
  lastSession: {
    id: string;
    topic: string;
    stance: string | null;
    score: number | null;
    summary: string | null;
    createdAt: string;
  } | null;
  recentActivity: Array<{
    id: string;
    activity_type: string;
    title: string;
    created_at: string;
  }>;
  profile: { id: string; full_name: string | null; avatar_url: string | null; email: string | null };
};

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardStats> => {
    const { supabase, userId, claims } = context;

    const [{ data: profile }, { data: sessions, error: sErr }, { data: activities }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("practice_sessions").select("id, topic, stance, score, duration_seconds, summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("activities").select("id, activity_type, title, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);
    if (sErr) throw new Error(sErr.message);

    const list = sessions ?? [];
    const scored = list.filter((s) => typeof s.score === "number");
    const avg = scored.length ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length) : null;
    const best = scored.length ? Math.max(...scored.map((s) => s.score ?? 0)) : null;
    const totalSeconds = list.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
    const last = list[0] ?? null;

    return {
      totalSessions: list.length,
      totalMinutes: Math.round(totalSeconds / 60),
      averageScore: avg,
      bestScore: best,
      lastSession: last ? { id: last.id, topic: last.topic, stance: last.stance, score: last.score, summary: last.summary, createdAt: last.created_at } : null,
      recentActivity: activities ?? [],
      profile: {
        id: userId,
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: (claims?.email as string | undefined) ?? null,
      },
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name: string }) => {
    const name = String(input?.full_name ?? "").trim();
    if (!name || name.length > 100) throw new Error("Name must be 1-100 characters");
    return { full_name: name };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ full_name: data.full_name }).eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Missing activity id");
    return { id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("activities")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
