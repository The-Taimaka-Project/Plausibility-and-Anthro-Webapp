"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings, FileBarChart, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { useMapping } from "@/lib/use-mapping";

export default function FormPage({ params }: { params: Promise<{ pid: string; fid: string }> }) {
  const { pid, fid } = use(params);
  const fidDecoded = decodeURIComponent(fid);
  const router = useRouter();
  const { mapping, ready } = useMapping(pid, fidDecoded);

  const [tables, setTables] = useState<{ parent: string; members?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  // Auto-suggest date range from data once the mapping is set
  const dateColumn = mapping?.survey_date;
  const submissionDates = useMemo(() => {
    if (!tables?.parent || !dateColumn) return [];
    const rows = Papa.parse<Record<string, string>>(tables.parent, { header: true, skipEmptyLines: true }).data;
    const dates = rows
      .map((r) => (r[dateColumn] ?? "").slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    return Array.from(new Set(dates)).sort();
  }, [tables, dateColumn]);

  useEffect(() => {
    if (submissionDates.length && !fromDate && !toDate) {
      setFromDate(submissionDates[submissionDates.length - 1]);
      setToDate(submissionDates[submissionDates.length - 1]);
    }
  }, [submissionDates, fromDate, toDate]);

  function generate() {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/dashboard/${pid}/${fid}/report?${params}`);
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${pid}`}><ArrowLeft className="h-4 w-4" /> All forms</Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{fidDecoded}</h1>
        <p className="text-sm text-muted-foreground">Set the date range, then generate the plausibility report.</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {!tables && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
        </div>
      )}

      {tables && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Date range</CardTitle>
              <CardDescription>
                {submissionDates.length
                  ? `${submissionDates.length} day${submissionDates.length === 1 ? "" : "s"} of submissions`
                  : "No submissions found"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from">From</Label>
                  <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to">To</Label>
                  <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>

              {submissionDates.length > 0 && (
                <div>
                  <Label className="mb-1.5 block">Quick pick</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {submissionDates.slice(-10).reverse().map((d) => (
                      <Button
                        key={d}
                        size="sm"
                        variant={fromDate === d && toDate === d ? "default" : "outline"}
                        onClick={() => { setFromDate(d); setToDate(d); }}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={generate} disabled={!mapping || !fromDate || !toDate}>
                  <FileBarChart className="h-4 w-4" /> Generate report
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/dashboard/${pid}/${fid}/config`}>
                    <Settings className="h-4 w-4" /> Configure columns
                  </Link>
                </Button>
              </div>
              {ready && !mapping && (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  No column mapping saved for this form yet — configure it before generating the report.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submissions</CardTitle>
              <CardDescription>Parsed from ODK export</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parent rows</span>
                  <span className="font-mono">
                    {Papa.parse(tables.parent, { header: true, skipEmptyLines: true }).data.length}
                  </span>
                </div>
                {tables.members && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member rows</span>
                    <span className="font-mono">
                      {Papa.parse(tables.members, { header: true, skipEmptyLines: true }).data.length}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
