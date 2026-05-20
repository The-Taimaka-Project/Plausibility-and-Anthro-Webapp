"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, Printer } from "lucide-react";
import { useMapping } from "@/lib/use-mapping";
import { cleanSubmissions } from "@/lib/clean";
import { buildAnthroReport } from "@/lib/anthro-report";
import { AnthroTables } from "@/components/anthro-tables";

export default function AnthroPage({ params }: { params: Promise<{ pid: string; fid: string }> }) {
  const { pid, fid } = use(params);
  const fidDecoded = decodeURIComponent(fid);
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") ?? "";
  const to = search.get("to") ?? "";
  const { mapping, ready } = useMapping(pid, fidDecoded);

  const [tables, setTables] = useState<{ parent: string; members?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/odk/projects/${pid}/forms/${fid}/submissions`)
      .then(async (r) => {
        if (r.status === 401) return router.push("/sign-in");
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setTables({ parent: d.parent, members: d.members });
      })
      .catch((e) => setError(e.message));
  }, [pid, fid, router]);

  const anthro = useMemo(() => {
    if (!tables || !mapping) return null;
    const { records } = cleanSubmissions(tables.parent, tables.members, {
      mapping,
      fromDate: from || undefined,
      toDate: to || undefined,
    });
    return buildAnthroReport(records, { fromDate: from, toDate: to });
  }, [tables, mapping, from, to]);

  async function downloadDocx() {
    if (!anthro) return;
    const res = await fetch("/api/report/anthro-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anthro),
    });
    if (!res.ok) {
      alert("Anthropometry report generation failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fidDecoded}_anthropometry_${from}_${to}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/${pid}/${fid}/report?from=${from}&to=${to}`}>
              <ArrowLeft className="h-4 w-4" /> Back to plausibility report
            </Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Anthropometry report</h1>
          <p className="text-sm text-muted-foreground">
            {fidDecoded} · {from === to ? from : `${from} to ${to}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" onClick={downloadDocx} disabled={!anthro}>
            <FileText className="h-4 w-4" /> Download Word
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {ready && !mapping && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          No column mapping is configured for this form. <Link href={`/dashboard/${pid}/${fid}/config`} className="underline">Configure it first</Link>.
        </div>
      )}
      {!anthro && !error && mapping && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building anthropometry tables…
        </div>
      )}

      {anthro && <AnthroTables report={anthro} />}
    </AppShell>
  );
}
