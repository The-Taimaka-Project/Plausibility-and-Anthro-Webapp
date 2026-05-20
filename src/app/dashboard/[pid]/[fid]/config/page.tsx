"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save, Download, Upload } from "lucide-react";
import {
  CANONICAL_FIELDS,
  loadMapping,
  saveMapping,
  suggestDefaults,
  exportAllMappings,
  importAllMappings,
  type ColumnMapping,
} from "@/lib/column-mapping";

export default function ConfigPage({ params }: { params: Promise<{ pid: string; fid: string }> }) {
  const { pid, fid } = use(params);
  const fidDecoded = decodeURIComponent(fid);
  const router = useRouter();

  const [tables, setTables] = useState<{ parent: string; members?: string } | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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

  useEffect(() => {
    if (!tables) return;
    // Combine headers from parent + members
    const pHeaders = Papa.parse(tables.parent, { header: true, skipEmptyLines: true, preview: 1 }).meta.fields ?? [];
    const mHeaders = tables.members
      ? Papa.parse(tables.members, { header: true, skipEmptyLines: true, preview: 1 }).meta.fields ?? []
      : [];
    const allHeaders = Array.from(new Set([...pHeaders, ...mHeaders]));
    setHeaders(allHeaders);
    const existing = loadMapping(pid, fidDecoded);
    setMapping(existing ?? suggestDefaults(allHeaders));
  }, [tables, pid, fidDecoded]);

  function update<K extends keyof ColumnMapping>(k: K, v: ColumnMapping[K]) {
    setMapping((m) => (m ? { ...m, [k]: v } : m));
  }

  function save() {
    if (!mapping) return;
    saveMapping(pid, fidDecoded, mapping);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  }

  function doExport() {
    const json = exportAllMappings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plausibility-mappings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importAllMappings(String(reader.result));
        const existing = loadMapping(pid, fidDecoded);
        if (existing) setMapping(existing);
        alert("Mappings imported.");
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/${pid}/${fid}`}><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Configure columns</h1>
          <p className="text-sm text-muted-foreground">Map this form's ODK columns to the canonical fields.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
          <label className="cursor-pointer">
            <input type="file" accept="application/json" onChange={doImport} className="hidden" />
            <span className="inline-flex h-8 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">
              <Upload className="h-4 w-4" /> Import
            </span>
          </label>
        </div>
      </div>

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {!mapping && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      {mapping && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Field mapping</CardTitle>
            <CardDescription>
              Source columns are auto-detected from a sample of your data. Adjust if needed and save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CANONICAL_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr] md:items-center">
                <div>
                  <Label>
                    {f.label}
                    {f.required && <span className="ml-1 text-destructive">*</span>}
                  </Label>
                  {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                </div>
                <Select
                  value={(mapping[f.key] as string) ?? ""}
                  onChange={(e) => update(f.key, e.target.value as never)}
                >
                  <option value="">— none —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </Select>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr] md:items-center">
              <Label>MUAC unit</Label>
              <Select
                value={mapping.muac_unit ?? "cm"}
                onChange={(e) => update("muac_unit", e.target.value as "cm" | "mm")}
              >
                <option value="cm">cm (converted to mm)</option>
                <option value="mm">mm</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr] md:items-center">
              <Label>Test row child_name value</Label>
              <Input
                placeholder="e.g. 1000"
                value={mapping.test_name_value ?? ""}
                onChange={(e) => update("test_name_value", e.target.value || undefined)}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={save}>
                <Save className="h-4 w-4" /> Save mapping
              </Button>
              {savedAt && <span className="text-sm text-emerald-600">Saved</span>}
            </div>
          </CardContent>
        </Card>
      )}
    </AppShell>
  );
}
