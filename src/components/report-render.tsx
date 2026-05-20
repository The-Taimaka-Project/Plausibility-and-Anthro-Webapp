"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { PlausibilityReport } from "@/lib/report-engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const BAND_COLORS: Record<string, string> = {
  excellent: "bg-emerald-100 text-emerald-900",
  good: "bg-sky-100 text-sky-900",
  acceptable: "bg-amber-100 text-amber-900",
  problematic: "bg-rose-100 text-rose-900",
};

function fmtP(p: number) {
  return p < 0.001 ? "<0.001" : p.toFixed(3);
}
function fmtNum(n: number, digits = 1) {
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function ReportRender({ report }: { report: PlausibilityReport }) {
  return (
    <div className="space-y-6">
      <Card className="report-section">
        <CardHeader>
          <CardTitle>Overall data quality</CardTitle>
          <CardDescription>
            Reference: {report.meta.referenceStandard} · {report.meta.totalRecords} records ·{" "}
            {report.meta.fromDate} to {report.meta.toDate}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Criterion</TH>
                <TH>Flags</TH>
                <TH>Unit</TH>
                <TH>Value</TH>
                <TH>Score</TH>
              </TR>
            </THead>
            <TBody>
              {report.overallScore.rows.map((r) => (
                <TR key={r.label}>
                  <TD className="font-semibold">{r.label}</TD>
                  <TD>{r.flag}</TD>
                  <TD>{r.unit}</TD>
                  <TD>{r.value}</TD>
                  <TD>
                    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", BAND_COLORS[r.band])}>
                      {r.score}
                    </span>
                  </TD>
                </TR>
              ))}
              <TR>
                <TD className="font-semibold" colSpan={4}>OVERALL SCORE</TD>
                <TD className="font-semibold">{report.overallScore.totalScore}</TD>
              </TR>
            </TBody>
          </Table>
          <p className="mt-3 text-sm text-muted-foreground">
            Survey overall score: <span className="font-semibold capitalize">{report.overallScore.bandLabel}</span>.
          </p>
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Missing data &amp; birthdate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Children with exact birthday:</span>{" "}
            <span className="font-semibold">{report.missing.pctWithBirthdate}%</span>
          </p>
          <p>
            <span className="text-muted-foreground">Rows missing weight:</span>{" "}
            <span className="font-semibold">{report.missing.weight.length}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Rows missing height:</span>{" "}
            <span className="font-semibold">{report.missing.height.length}</span>
          </p>
          {report.missing.weight.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">Show missing weight lines</summary>
              <p className="mt-1 break-words font-mono text-xs">{report.missing.weight.join(", ")}</p>
            </details>
          )}
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Age distribution (months)</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.ageDistribution} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" interval={4} fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Sex × age (chi-square)</CardTitle>
          <CardDescription>
            Overall sex ratio: p={fmtP(report.sexAge.pSex)} · Age ratio (6-29 vs 30-59): p=
            {fmtP(report.sexAge.pAgeRatio)} · Overall age distribution: p={fmtP(report.sexAge.pAge)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Age band</TH>
                <TH>Months</TH>
                <TH>Boys obs/exp (ratio)</TH>
                <TH>Girls obs/exp (ratio)</TH>
                <TH>Total obs/exp (ratio)</TH>
                <TH>Ratio boys/girls</TH>
              </TR>
            </THead>
            <TBody>
              {report.sexAge.cells.map((c) => {
                const ratio = c.obsGirls ? c.obsBoys / c.obsGirls : Infinity;
                return (
                  <TR key={c.ageBand}>
                    <TD className="font-semibold">{c.ageBand}</TD>
                    <TD>{c.months}</TD>
                    <TD>
                      {c.obsBoys}/{fmtNum(c.expBoys, 1)} ({fmtNum(c.expBoys ? c.obsBoys / c.expBoys : 0, 1)})
                    </TD>
                    <TD>
                      {c.obsGirls}/{fmtNum(c.expGirls, 1)} ({fmtNum(c.expGirls ? c.obsGirls / c.expGirls : 0, 1)})
                    </TD>
                    <TD>
                      {c.obsBoys + c.obsGirls}/{fmtNum(c.expBoys + c.expGirls, 1)}
                    </TD>
                    <TD>{Number.isFinite(ratio) ? fmtNum(ratio, 2) : "—"}</TD>
                  </TR>
                );
              })}
              <TR className="font-semibold">
                <TD>6 to 59</TD>
                <TD>54</TD>
                <TD>{report.sexAge.totals.boys}</TD>
                <TD>{report.sexAge.totals.girls}</TD>
                <TD>{report.sexAge.totals.total}</TD>
                <TD />
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Distribution of month of birth</CardTitle>
        </CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.monthOfBirth} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Digit preference — MUAC (mm)</CardTitle>
          <CardDescription>
            DPS = {report.digitPref.muac?.dps ?? "—"} · 0-7 excellent, 8-12 good, 13-20 acceptable, &gt;20 problematic
          </CardDescription>
        </CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={(report.digitPref.muac?.percents ?? []).map((p, i) => ({ digit: `.${i}`, pct: Math.round(p * 10) / 10 }))}
              margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="digit" fontSize={11} />
              <YAxis fontSize={11} unit="%" />
              <Tooltip />
              <Bar dataKey="pct" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="report-section">
        <CardHeader>
          <CardTitle>Analysis by team (pair)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Team</TH>
                <TH>n</TH>
                <TH>Sex ratio (m/f)</TH>
                <TH>Age ratio (6-29 / 30-59)</TH>
                <TH>MUAC DPS</TH>
              </TR>
            </THead>
            <TBody>
              {report.byTeam.map((t) => (
                <TR key={t.team}>
                  <TD className="font-semibold">{t.team}</TD>
                  <TD>{t.n}</TD>
                  <TD>{Number.isFinite(t.sexRatio) ? fmtNum(t.sexRatio, 2) : "—"}</TD>
                  <TD>{Number.isFinite(t.ageRatio6_29_vs_30_59) ? fmtNum(t.ageRatio6_29_vs_30_59, 2) : "—"}</TD>
                  <TD>{t.digitPref.muac ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <TeamSummaryCard report={report} />
    </div>
  );
}

function TeamSummaryCard({ report }: { report: PlausibilityReport }) {
  const doingWell = report.teamSummary.filter((t) => t.band === "excellent" || t.band === "good");
  const needsReview = report.teamSummary.filter((t) => t.band === "acceptable" || t.band === "problematic");

  return (
    <Card className="report-section">
      <CardHeader>
        <CardTitle>Team performance summary</CardTitle>
        <CardDescription>
          Each team scored against SMART thresholds on MUAC digit preference, sex ratio, and age ratio.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Doing well ({doingWell.length})
          </h3>
          {doingWell.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams in this group.</p>
          ) : (
            <ul className="space-y-2">
              {doingWell.map((t) => (
                <li key={t.team} className="rounded-md border bg-emerald-50/50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.team}</span>
                    <span className="text-xs text-muted-foreground">n={t.n} · score {t.totalScore}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {t.metrics.map((m) => (
                      <span key={m.label} className={cn("rounded-md px-1.5 py-0.5", BAND_COLORS[m.band])}>
                        {m.label.split(" ")[0]} {m.value}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
            Needs review ({needsReview.length})
          </h3>
          {needsReview.length === 0 ? (
            <p className="text-sm text-muted-foreground">All teams within acceptable range.</p>
          ) : (
            <ul className="space-y-2">
              {needsReview.map((t) => (
                <li
                  key={t.team}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    t.band === "problematic" ? "bg-rose-50/60" : "bg-amber-50/60",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.team}</span>
                    <span className="text-xs text-muted-foreground">n={t.n} · score {t.totalScore}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {t.issues.map((issue) => (
                      <li key={issue}>• {issue}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
