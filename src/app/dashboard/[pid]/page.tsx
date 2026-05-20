"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

type Form = { xmlFormId: string; name: string; submissions?: number };

export default function ProjectPage({ params }: { params: Promise<{ pid: string }> }) {
  const { pid } = use(params);
  const router = useRouter();
  const [forms, setForms] = useState<Form[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/odk/projects/${pid}/forms`)
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/sign-in");
          return;
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setForms(d.forms);
      })
      .catch((e) => setError(e.message));
  }, [pid, router]);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4" /> All projects</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Forms in project #{pid}</h1>
          <p className="text-sm text-muted-foreground">Select a form to generate a plausibility report.</p>
        </div>
      </div>
      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {!forms && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading forms…
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {forms?.map((f) => (
          <Link key={f.xmlFormId} href={`/dashboard/${pid}/${encodeURIComponent(f.xmlFormId)}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> {f.name ?? f.xmlFormId}
                  </span>
                </CardTitle>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">{f.xmlFormId}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
