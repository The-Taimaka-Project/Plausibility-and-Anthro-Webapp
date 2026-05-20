"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FolderKanban, ChevronRight } from "lucide-react";

type Project = { id: number; name: string };

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/odk/projects")
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/sign-in");
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load");
        setProjects(data.projects);
      })
      .catch((e) => setError(e.message));
  }, [router]);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">Pick an ODK Central project to continue.</p>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {!projects && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <Link key={p.id} href={`/dashboard/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  <span className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4 text-primary" /> {p.name}
                  </span>
                </CardTitle>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">Project #{p.id}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
