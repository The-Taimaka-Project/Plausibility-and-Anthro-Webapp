"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, ExternalLink, FileDown, Loader2, Printer } from "lucide-react";
import { useMapping } from "@/lib/use-mapping";
import { cleanSubmissions, toEnaCsv } from "@/lib/clean";
import { buildReport } from "@/lib/report-engine";
import { ReportRender } from "@/components/report-render";

export default function ReportPage({ params }: { params: Promise<{ pid: string; fid: string }> }) {
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

  const { report, records } = useMemo(() => {
    if (!tables || !mapping) return { report: null, records: null };
    const { records } = cleanSubmissions(tables.parent, tables.members, {
      mapping,
      fromDate: from || undefined,
      toDate: to || undefined,
    });
    const report = buildReport(records, { fromDate: from, toDate: to, formId: fidDecoded, projectId: pid });
    return { report, records };
  }, [tables, mapping, from, to, fidDecoded, pid]);

  function downloadCsv() {
    if (!records) return;
    const csv = toEnaCsv(records);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fidDecoded}_cleaned_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    if (!report) return;
    const res = await fetch("/api/report/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) {
      alert("PDF generation failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fidDecoded}_plausibility_${from}_${to}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }


  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 no-print">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/${pid}/${fid}`}><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Plausibility report</h1>
          <p className="text-sm text-muted-foreground">
            {fidDecoded} · {from === to ? from : `${from} to ${to}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!records}>
            <Download className="h-4 w-4" /> Cleaned CSV
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link
              href={`/dashboard/${pid}/${fid}/anthro?from=${from}&to=${to}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" /> Anthropometry report
            </Link>
          </Button>
          <Button size="sm" onClick={downloadPdf} disabled={!report}>
            <FileDown className="h-4 w-4" /> Plausibility PDF
          </Button>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {ready && !mapping && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          No column mapping is configured for this form. <Link href={`/dashboard/${pid}/${fid}/config`} className="underline">Configure it first</Link>.
        </div>
      )}
      {(!tables || !report) && !error && mapping && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Building report…
        </div>
      )}

      {report && <ReportRender report={report} />}
    </AppShell>
  );
}
