"use client";

import type {
  AnthroReport,
  PrevalenceBySexTable,
  PrevalenceCell,
  WhzMatrixRow,
} from "@/lib/anthro-report";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

function fmt(n: number, d = 1) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function cellFmt(c: PrevalenceCell) {
  if (c.n === 0) return "—";
  return `(${c.count}) ${fmt(c.pct, 1)}% · ${fmt(c.ci95[0], 1)}–${fmt(c.ci95[1], 1)} 95% CI`;
}

/** Reusable "All / Boys / Girls × Global / Moderate / Severe" table. */
function PrevSexCard({
  title,
  description,
  data,
  globalLabel,
  moderateLabel,
  severeLabel,
  hideModerate = false,
}: {
  title: string;
  description?: string;
  data: PrevalenceBySexTable;
  globalLabel: string;
  moderateLabel: string;
  severeLabel: string;
  hideModerate?: boolean;
}) {
  return (
    <Card className="report-section">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH></TH>
              <TH>All (n={data.global.all.n})</TH>
              <TH>Boys (n={data.global.boys.n})</TH>
              <TH>Girls (n={data.global.girls.n})</TH>
            </TR>
          </THead>
          <TBody>
            <TR>
              <TD className="font-semibold">{globalLabel}</TD>
              <TD>{cellFmt(data.global.all)}</TD>
              <TD>{cellFmt(data.global.boys)}</TD>
              <TD>{cellFmt(data.global.girls)}</TD>
            </TR>
            {!hideModerate && (
              <TR>
                <TD className="font-semibold">{moderateLabel}</TD>
                <TD>{cellFmt(data.moderate.all)}</TD>
                <TD>{cellFmt(data.moderate.boys)}</TD>
                <TD>{cellFmt(data.moderate.girls)}</TD>
              </TR>
            )}
            <TR>
              <TD className="font-semibold">{severeLabel}</TD>
              <TD>{cellFmt(data.severe.all)}</TD>
              <TD>{cellFmt(data.severe.boys)}</TD>
              <TD>{cellFmt(data.severe.girls)}</TD>
            </TR>
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Reusable "by age band" table with Severe / Moderate / Normal / Oedema columns. */
function ByAgeCard({
  title,
  description,
  rows,
  totals,
  severeLabel,
  moderateLabel,
  normalLabel,
  showOedema = true,
}: {
  title: string;
  description?: string;
  rows: WhzMatrixRow[];
  totals: WhzMatrixRow;
  severeLabel: string;
  moderateLabel: string;
  normalLabel: string;
  showOedema?: boolean;
}) {
  return (
    <Card className="report-section">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <THead>
            <TR>
              <TH rowSpan={2}>Age (mo)</TH>
              <TH rowSpan={2}>Total</TH>
              <TH colSpan={2}>{severeLabel}</TH>
              <TH colSpan={2}>{moderateLabel}</TH>
              <TH colSpan={2}>{normalLabel}</TH>
              {showOedema && <TH colSpan={2}>Oedema</TH>}
            </TR>
            <TR>
              <TH>n</TH><TH>%</TH>
              <TH>n</TH><TH>%</TH>
              <TH>n</TH><TH>%</TH>
              {showOedema && <><TH>n</TH><TH>%</TH></>}
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.ageBand}>
                <TD>{r.ageBand}</TD>
                <TD>{r.total}</TD>
                <TD>{r.severe.n}</TD>
                <TD>{fmt(r.severe.pct)}</TD>
                <TD>{r.moderate.n}</TD>
                <TD>{fmt(r.moderate.pct)}</TD>
                <TD>{r.normal.n}</TD>
                <TD>{fmt(r.normal.pct)}</TD>
                {showOedema && <><TD>{r.oedema.n}</TD><TD>{fmt(r.oedema.pct)}</TD></>}
              </TR>
            ))}
            <TR className="font-semibold">
              <TD>{totals.ageBand}</TD>
              <TD>{totals.total}</TD>
              <TD>{totals.severe.n}</TD>
              <TD>{fmt(totals.severe.pct)}</TD>
              <TD>{totals.moderate.n}</TD>
              <TD>{fmt(totals.moderate.pct)}</TD>
              <TD>{totals.normal.n}</TD>
              <TD>{fmt(totals.normal.pct)}</TD>
              {showOedema && <><TD>{totals.oedema.n}</TD><TD>{fmt(totals.oedema.pct)}</TD></>}
            </TR>
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AnthroTables({ report }: { report: AnthroReport }) {
  const hasMuac = report.meta.n_muac > 0;
  const hasWhz = report.meta.n_whz > 0;
  const hasWaz = report.meta.n_waz > 0;
  const hasHaz = report.meta.n_haz > 0;
  const coverage = [
    hasMuac ? `${report.meta.n_muac} with MUAC` : null,
    hasWhz ? `${report.meta.n_whz} with WHZ` : null,
    hasHaz ? `${report.meta.n_haz} with HAZ` : null,
    hasWaz ? `${report.meta.n_waz} with WAZ` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Reference: {report.meta.referenceStandard}. CIs: {report.meta.ciMethod}.
        {coverage && <><br />n = {coverage}.</>}
      </div>

      {/* Table 3.1 */}
      <Card className="report-section">
        <CardHeader>
          <CardTitle className="text-base">Table 3.1 — Distribution of age and sex</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH rowSpan={2}>Age (mo)</TH>
                <TH colSpan={2}>Boys</TH>
                <TH colSpan={2}>Girls</TH>
                <TH colSpan={2}>Total</TH>
                <TH rowSpan={2}>Ratio b:g</TH>
              </TR>
              <TR>
                <TH>n</TH><TH>%</TH><TH>n</TH><TH>%</TH><TH>n</TH><TH>%</TH>
              </TR>
            </THead>
            <TBody>
              {report.sample.rows.map((r) => (
                <TR key={r.ageBand}>
                  <TD>{r.ageBand}</TD>
                  <TD>{r.boys}</TD>
                  <TD>{fmt(r.boysPct)}</TD>
                  <TD>{r.girls}</TD>
                  <TD>{fmt(r.girlsPct)}</TD>
                  <TD>{r.total}</TD>
                  <TD>{fmt(r.totalPct)}</TD>
                  <TD>{r.ratioBoyGirl !== null ? fmt(r.ratioBoyGirl, 1) : "—"}</TD>
                </TR>
              ))}
              <TR className="font-semibold">
                <TD>{report.sample.totals.ageBand}</TD>
                <TD>{report.sample.totals.boys}</TD>
                <TD>{fmt(report.sample.totals.boysPct)}</TD>
                <TD>{report.sample.totals.girls}</TD>
                <TD>{fmt(report.sample.totals.girlsPct)}</TD>
                <TD>{report.sample.totals.total}</TD>
                <TD>{fmt(report.sample.totals.totalPct)}</TD>
                <TD>{report.sample.totals.ratioBoyGirl !== null ? fmt(report.sample.totals.ratioBoyGirl, 1) : "—"}</TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Table 3.2 — WHZ */}
      {hasWhz && (
        <PrevSexCard
          title="Table 3.2 — Acute malnutrition by weight-for-height z-score and sex"
          description="Wasting based on WHZ. WHO flag (|z|>5) applied to exclude implausible values."
          data={report.prevalenceByWhzSex}
          globalLabel="Global (WHZ < -2 and/or oedema)"
          moderateLabel="Moderate (WHZ < -2 and ≥ -3, no oedema)"
          severeLabel="Severe (WHZ < -3 and/or oedema)"
        />
      )}

      {/* Table 3.3 — WHZ by age */}
      {hasWhz && (
        <ByAgeCard
          title="Table 3.3 — Acute malnutrition by WHZ and age"
          rows={report.prevalenceByWhzAge.rows}
          totals={report.prevalenceByWhzAge.totals}
          severeLabel="Severe (WHZ < -3)"
          moderateLabel="Moderate (-3 ≤ WHZ < -2)"
          normalLabel="Normal (WHZ ≥ -2)"
        />
      )}

      {/* Table 3.4 — WHZ × oedema */}
      {hasWhz && (
      <Card className="report-section">
        <CardHeader>
          <CardTitle className="text-base">Table 3.4 — Acute malnutrition and oedema by WHZ</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH></TH>
                <TH>WHZ &lt; -3</TH>
                <TH>WHZ ≥ -3</TH>
              </TR>
            </THead>
            <TBody>
              {report.whzOedemaMatrix.map((row) => {
                const label = row.bilateralOedemaPresent
                  ? row.belowMinus3 > 0
                    ? "Bilateral oedema present"
                    : "Bilateral oedema present"
                  : "Bilateral oedema absent";
                const sevLabel = row.bilateralOedemaPresent ? "Marasmic kwashiorkor" : "Marasmic";
                const norLabel = row.bilateralOedemaPresent ? "Kwashiorkor" : "Not severely malnourished";
                return (
                  <TR key={String(row.bilateralOedemaPresent)}>
                    <TD className="font-semibold">{label}</TD>
                    <TD>
                      <span className="font-medium">{sevLabel}</span>{" "}
                      <span className="text-muted-foreground">
                        — {row.belowMinus3} ({fmt(row.belowMinus3Pct)}%)
                      </span>
                    </TD>
                    <TD>
                      <span className="font-medium">{norLabel}</span>{" "}
                      <span className="text-muted-foreground">
                        — {row.atOrAboveMinus3} ({fmt(row.atOrAboveMinus3Pct)}%)
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Table 3.5 — MUAC */}
      {hasMuac && (
        <PrevSexCard
          title="Table 3.5 — Acute malnutrition by MUAC and sex"
          description="SAM < 115 mm · MAM 115–<125 mm · GAM < 125 mm and/or oedema"
          data={report.prevalenceByMuacSex}
          globalLabel="Global (GAM)"
          moderateLabel="Moderate (MAM)"
          severeLabel="Severe (SAM)"
        />
      )}

      {/* Table 3.6 — MUAC by age */}
      {hasMuac && (
        <ByAgeCard
          title="Table 3.6 — Acute malnutrition by MUAC and age"
          rows={report.prevalenceByMuacAge.rows}
          totals={report.prevalenceByMuacAge.totals}
          severeLabel="Severe (<115 mm)"
          moderateLabel="Moderate (115–<125 mm)"
          normalLabel="Normal (≥125 mm)"
        />
      )}

      {/* Table 3.7 — Combined */}
      {(hasMuac || hasWhz) && (
        <PrevSexCard
          title="Table 3.7 — Combined GAM/SAM (WHZ ∪ MUAC ∪ oedema)"
          description="Cases meeting any criterion (WHZ z-score or MUAC mm cutoff or bilateral oedema)."
          data={report.combinedGamSamBySex}
          globalLabel="Combined GAM"
          moderateLabel="Moderate"
          severeLabel="Combined SAM"
          hideModerate
        />
      )}

      {/* Table 3.8 — Detail */}
      {(hasMuac || hasWhz) && (
      <Card className="report-section">
        <CardHeader>
          <CardTitle className="text-base">Table 3.8 — Detailed numbers for combined GAM/SAM</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH rowSpan={2}>Source</TH>
                <TH colSpan={2}>GAM</TH>
                <TH colSpan={2}>SAM</TH>
              </TR>
              <TR>
                <TH>n</TH><TH>%</TH>
                <TH>n</TH><TH>%</TH>
              </TR>
            </THead>
            <TBody>
              {report.combinedDetail.rows
                .filter((r) => {
                  // Hide rows whose data source is absent: WHZ/Both row when no WHZ; MUAC row when no MUAC
                  if (r.source === "WHZ" || r.source === "Both") return hasWhz;
                  if (r.source === "MUAC") return hasMuac;
                  return true; // Oedema row always shown when we have data
                })
                .map((r) => (
                  <TR key={r.source}>
                    <TD className="font-semibold">{r.source}</TD>
                    <TD>{r.gam.n}</TD>
                    <TD>{fmt(r.gam.pct)}</TD>
                    <TD>{r.sam.n}</TD>
                    <TD>{fmt(r.sam.pct)}</TD>
                  </TR>
                ))}
              <TR className="font-semibold">
                <TD>{report.combinedDetail.total.source}</TD>
                <TD>{report.combinedDetail.total.gam.n}</TD>
                <TD>{fmt(report.combinedDetail.total.gam.pct)}</TD>
                <TD>{report.combinedDetail.total.sam.n}</TD>
                <TD>{fmt(report.combinedDetail.total.sam.pct)}</TD>
              </TR>
            </TBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Table 3.9 — WAZ */}
      {hasWaz && (
        <PrevSexCard
          title="Table 3.9 — Underweight (WAZ) by sex"
          data={report.prevalenceByWazSex}
          globalLabel="Underweight (WAZ < -2)"
          moderateLabel="Moderate (-3 ≤ WAZ < -2)"
          severeLabel="Severe (WAZ < -3)"
        />
      )}

      {/* Table 3.10 — WAZ by age */}
      {hasWaz && (
        <ByAgeCard
          title="Table 3.10 — Underweight by age (WAZ)"
          rows={report.prevalenceByWazAge.rows}
          totals={report.prevalenceByWazAge.totals}
          severeLabel="Severe (WAZ < -3)"
          moderateLabel="Moderate (-3 ≤ WAZ < -2)"
          normalLabel="Normal (WAZ ≥ -2)"
        />
      )}

      {/* Table 3.11 — HAZ */}
      {hasHaz && (
        <PrevSexCard
          title="Table 3.11 — Stunting (HAZ) by sex"
          data={report.prevalenceByHazSex}
          globalLabel="Stunting (HAZ < -2)"
          moderateLabel="Moderate (-3 ≤ HAZ < -2)"
          severeLabel="Severe (HAZ < -3)"
        />
      )}

      {/* Table 3.12 — HAZ by age */}
      {hasHaz && (
        <ByAgeCard
          title="Table 3.12 — Stunting by age (HAZ)"
          rows={report.prevalenceByHazAge.rows}
          totals={report.prevalenceByHazAge.totals}
          severeLabel="Severe (HAZ < -3)"
          moderateLabel="Moderate (-3 ≤ HAZ < -2)"
          normalLabel="Normal (HAZ ≥ -2)"
          showOedema={false}
        />
      )}

      {/* Table 3.13 — Overweight */}
      {hasWhz && (
        <PrevSexCard
          title="Table 3.13 — Overweight by WHZ and sex (no oedema)"
          data={report.overweightBySex}
          globalLabel="Overweight (WHZ > 2)"
          moderateLabel="Moderate (2 < WHZ ≤ 3)"
          severeLabel="Severe (WHZ > 3)"
        />
      )}

      {/* Table 3.14 — Overweight by age */}
      {hasWhz && (
        <ByAgeCard
          title="Table 3.14 — Overweight by age (WHZ, no oedema)"
          rows={report.overweightByAge.rows}
          totals={report.overweightByAge.totals}
          severeLabel="Severe (WHZ > 3)"
          moderateLabel="Moderate (2 < WHZ ≤ 3)"
          normalLabel="Normal (WHZ ≤ 2)"
          showOedema={false}
        />
      )}

      {/* Table 3.15 — Mean z-scores (omit rows whose indicator has no data) */}
      {(hasWhz || hasWaz || hasHaz) && (
        <Card className="report-section">
          <CardHeader>
            <CardTitle className="text-base">Table 3.15 — Mean z-scores (SMART exclusion)</CardTitle>
            <CardDescription>
              Values outside observed mean ± 3 SD are excluded iteratively (SMART flag procedure).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Indicator</TH>
                  <TH>n</TH>
                  <TH>Mean ± SD</TH>
                  <TH>Skewness</TH>
                  <TH>Kurtosis</TH>
                  <TH>Excluded</TH>
                </TR>
              </THead>
              <TBody>
                {(["WHZ", "WAZ", "HAZ"] as const)
                  .filter((k) => report.meanZScores[k].n > 0)
                  .map((k) => {
                    const v = report.meanZScores[k];
                    const cell = (n: number | null, d = 2) => (n === null ? "—" : n.toFixed(d));
                    return (
                      <TR key={k}>
                        <TD className="font-semibold">{k}</TD>
                        <TD>{v.n}</TD>
                        <TD>
                          {cell(v.mean)} ± {cell(v.sd)}
                        </TD>
                        <TD>{cell(v.skewness)}</TD>
                        <TD>{cell(v.kurtosis)}</TD>
                        <TD>{v.excluded}</TD>
                      </TR>
                    );
                  })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
