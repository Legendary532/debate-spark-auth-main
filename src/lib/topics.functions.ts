import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TOPIC_CATEGORIES = [
  "AI",
  "Education",
  "Technology",
  "Healthcare",
  "Climate Change",
  "Politics",
] as const;

export type TopicCategory = (typeof TOPIC_CATEGORIES)[number] | "Custom";

export type UserTopic = {
  id: string;
  category: string;
  topic: string;
  is_custom: boolean;
  created_at: string;
};

export const getTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ current: UserTopic | null; history: UserTopic[] }> => {
    const { data, error } = await context.supabase
      .from("user_topics")
      .select("id, category, topic, is_custom, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const list = (data ?? []) as UserTopic[];
    return { current: list[0] ?? null, history: list };
  });

export const selectTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { category: string; topic?: string }) => {
    const category = String(input?.category ?? "").trim();
    if (!category || category.length > 60) throw new Error("Invalid category");
    const isCustom = category === "Custom";
    const topic = String(input?.topic ?? "").trim();
    const finalTopic = isCustom ? topic : (topic || category);
    if (!finalTopic || finalTopic.length > 200) throw new Error("Topic must be 1-200 characters");
    return { category, topic: finalTopic, is_custom: isCustom };
  })
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase
      .from("user_topics")
      .insert({ user_id: context.userId, category: data.category, topic: data.topic, is_custom: data.is_custom })
      .select("id, category, topic, is_custom, created_at")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activities").insert({
      user_id: context.userId,
      activity_type: "topic_selected",
      title: `Selected topic: ${data.topic}`,
      metadata: { category: data.category, is_custom: data.is_custom },
    });
    return inserted as UserTopic;
  });

export const deleteTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Missing topic id");
    return { id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("user_topics")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

