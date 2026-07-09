import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard, updateProfile } from "@/lib/dashboard.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — DebateGenius AI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const fetchDashboard = useServerFn(getDashboard);
  const save = useServerFn(updateProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.profile.full_name) setName(data.profile.full_name); }, [data?.profile.full_name]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ data: { full_name: name } });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">Your profile</h1>
      <p className="mt-1 text-muted-foreground">Manage the details on your account.</p>

      <Card className="mt-6 p-6 shadow-card">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-gradient-primary shadow-glow">
            <User className="h-6 w-6 text-primary-foreground" />
          </span>
          <div>
            <div className="text-lg font-semibold">{data?.profile.full_name || "—"}</div>
            <div className="text-sm text-muted-foreground">{data?.profile.email}</div>
          </div>
        </div>

        <form onSubmit={onSave} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="fn">Full name</Label>
            <Input id="fn" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <Button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
