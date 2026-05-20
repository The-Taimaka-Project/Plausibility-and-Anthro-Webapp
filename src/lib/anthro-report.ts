/**
 * Anthropometry report (GAM/SAM tables) derived from cleaned ChildRecords.
 *
 * Scope v1: MUAC-only — the same scope as the plausibility report. Tables that
 * require weight/height z-scores (3.2, 3.3, 3.4, 3.9-3.15) are kept in the
 * structure but populated with empty rows, matching the reference template.
 *
 * MUAC cutoffs (WHO):
 *   SAM   = MUAC < 115 mm and/or oedema
 *   MAM   = MUAC >= 115 mm and < 125 mm, no oedema
 *   GAM   = SAM + MAM
 *   Normal = MUAC >= 125 mm and no oedema
 *
 * CIs use the Wilson 95% interval. ENA SMART uses cluster-adjusted CIs that
 * incorporate design effect; we note this in the report header.
 */
import type { ChildRecord } from "./clean";
import { AGE_BANDS, safeKurt, safeMean, safeSkew, safeStd } from "./stats";
import { smartFlags, whoFlag } from "./who-standards";

export type AnthroAgeRow = {
  ageBand: string;
  boys: number;
  boysPct: number; // % of total in this age row that are boys
  girls: number;
  girlsPct: number;
  total: number;
  totalPct: number; // % of grand total in this age band
  ratioBoyGirl: number | null;
};

export type AnthroSampleTable = {
  rows: AnthroAgeRow[];
  totals: AnthroAgeRow;
};

export type PrevalenceCell = {
  count: number;
  n: number;
  pct: number; // 0..100
  ci95: [number, number]; // 0..100
};

export type PrevalenceBySexTable = {
  global: { all: PrevalenceCell; boys: PrevalenceCell; girls: PrevalenceCell };
  moderate: { all: PrevalenceCell; boys: PrevalenceCell; girls: PrevalenceCell };
  severe: { all: PrevalenceCell; boys: PrevalenceCell; girls: PrevalenceCell };
};

export type PrevalenceByAgeRow = {
  ageBand: string;
  total: number;
  severe: { n: number; pct: number };
  moderate: { n: number; pct: number };
  normal: { n: number; pct: number };
  oedema: { n: number; pct: number };
};

export type CombinedGamSamRow = {
  source: "MUAC" | "WHZ" | "Both" | "Oedema" | "Total";
  gam: { n: number; pct: number };
  sam: { n: number; pct: number };
};

export type WhzMatrixRow = {
  ageBand: string;
  total: number;
  severe: { n: number; pct: number }; // <-3 z
  moderate: { n: number; pct: number }; // <-2 and >=-3
  normal: { n: number; pct: number }; // >= -2
  oedema: { n: number; pct: number };
};

export type WhzKwashRow = {
  bilateralOedemaPresent: boolean;
  belowMinus3: number;
  belowMinus3Pct: number;
  atOrAboveMinus3: number;
  atOrAboveMinus3Pct: number;
};

export type ZScoreSummary = {
  n: number;
  mean: number | null;
  sd: number | null;
  skewness: number | null;
  kurtosis: number | null;
  excluded: number; // count of values flagged out
};

export type AnthroReport = {
  meta: {
    fromDate: string;
    toDate: string;
    totalRecords: number;
    n_muac: number;
    n_boys: number;
    n_girls: number;
    n_whz: number;
    n_haz: number;
    n_waz: number;
    referenceStandard: string;
    ciMethod: string;
  };
  sample: AnthroSampleTable; // Table 3.1
  prevalenceByWhzSex: PrevalenceBySexTable; // Table 3.2
  prevalenceByWhzAge: { rows: WhzMatrixRow[]; totals: WhzMatrixRow }; // Table 3.3
  whzOedemaMatrix: WhzKwashRow[]; // Table 3.4
  prevalenceByMuacSex: PrevalenceBySexTable; // Table 3.5
  prevalenceByMuacAge: { rows: PrevalenceByAgeRow[]; totals: PrevalenceByAgeRow }; // Table 3.6
  combinedGamSamBySex: PrevalenceBySexTable; // Table 3.7
  combinedDetail: { rows: CombinedGamSamRow[]; total: CombinedGamSamRow }; // Table 3.8
  prevalenceByWazSex: PrevalenceBySexTable; // Table 3.9
  prevalenceByWazAge: { rows: WhzMatrixRow[]; totals: WhzMatrixRow }; // Table 3.10
  prevalenceByHazSex: PrevalenceBySexTable; // Table 3.11
  prevalenceByHazAge: { rows: WhzMatrixRow[]; totals: WhzMatrixRow }; // Table 3.12
  overweightBySex: PrevalenceBySexTable; // Table 3.13
  overweightByAge: { rows: WhzMatrixRow[]; totals: WhzMatrixRow }; // Table 3.14 (uses severe=WHZ>3, moderate=WHZ>2&&<=3)
  meanZScores: {
    WHZ: ZScoreSummary;
    WAZ: ZScoreSummary;
    HAZ: ZScoreSummary;
  };
};

/* ------------------ Wilson 95% CI for a proportion ------------------ */

export function wilsonCi(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  const lo = Math.max(0, (center - margin) / denom);
  const hi = Math.min(1, (center + margin) / denom);
  return [lo * 100, hi * 100];
}

function cell(k: number, n: number): PrevalenceCell {
  const pct = n === 0 ? 0 : (k / n) * 100;
  return { count: k, n, pct, ci95: wilsonCi(k, n) };
}

/* ---------------------- Builders ---------------------- */

function buildSampleTable(records: ChildRecord[]): AnthroSampleTable {
  const valid = records.filter((r) => r.age_months !== null && r.age_months >= 6 && r.age_months <= 59);
  const grandTotal = valid.length;
  const rows: AnthroAgeRow[] = AGE_BANDS.map((b) => {
    const inBand = valid.filter((r) => r.age_months! >= b.min && r.age_months! <= b.max);
    const boys = inBand.filter((r) => r.sex === "male").length;
    const girls = inBand.filter((r) => r.sex === "female").length;
    const total = inBand.length;
    return {
      ageBand: b.label.replace(/\s+/g, "").replace("to", "-").replace(/(\d+)-(\d+)/, "$1-$2"),
      boys,
      boysPct: total ? (boys / total) * 100 : 0,
      girls,
      girlsPct: total ? (girls / total) * 100 : 0,
      total,
      totalPct: grandTotal ? (total / grandTotal) * 100 : 0,
      ratioBoyGirl: girls ? boys / girls : null,
    };
  });
  const totalBoys = rows.reduce((s, r) => s + r.boys, 0);
  const totalGirls = rows.reduce((s, r) => s + r.girls, 0);
  const total = totalBoys + totalGirls;
  const totals: AnthroAgeRow = {
    ageBand: "Total",
    boys: totalBoys,
    boysPct: total ? (totalBoys / total) * 100 : 0,
    girls: totalGirls,
    girlsPct: total ? (totalGirls / total) * 100 : 0,
    total,
    totalPct: 100,
    ratioBoyGirl: totalGirls ? totalBoys / totalGirls : null,
  };
  return { rows, totals };
}

function classifyMuac(r: ChildRecord): "sam" | "mam" | "normal" | "missing" {
  if (r.muac_mm === null) return "missing";
  if (r.oedema === true) return "sam";
  if (r.muac_mm < 115) return "sam";
  if (r.muac_mm < 125) return "mam";
  return "normal";
}

function buildPrevalenceBySex(records: ChildRecord[]): PrevalenceBySexTable {
  // Only children with a valid MUAC are included
  const withMuac = records.filter((r) => r.muac_mm !== null);
  const boys = withMuac.filter((r) => r.sex === "male");
  const girls = withMuac.filter((r) => r.sex === "female");

  const fn = (subset: ChildRecord[]) => {
    const n = subset.length;
    const sam = subset.filter((r) => classifyMuac(r) === "sam").length;
    const mam = subset.filter((r) => classifyMuac(r) === "mam").length;
    const gam = sam + mam;
    return { global: cell(gam, n), moderate: cell(mam, n), severe: cell(sam, n) };
  };
  const all = fn(withMuac);
  const b = fn(boys);
  const g = fn(girls);
  return {
    global: { all: all.global, boys: b.global, girls: g.global },
    moderate: { all: all.moderate, boys: b.moderate, girls: g.moderate },
    severe: { all: all.severe, boys: b.severe, girls: g.severe },
  };
}

function buildPrevalenceByAge(records: ChildRecord[]): { rows: PrevalenceByAgeRow[]; totals: PrevalenceByAgeRow } {
  const withMuac = records.filter((r) => r.muac_mm !== null && r.age_months !== null);
  const grand = withMuac.length;
  const rows: PrevalenceByAgeRow[] = AGE_BANDS.map((b) => {
    const subset = withMuac.filter((r) => r.age_months! >= b.min && r.age_months! <= b.max);
    const total = subset.length;
    const sam = subset.filter((r) => classifyMuac(r) === "sam").length;
    const mam = subset.filter((r) => classifyMuac(r) === "mam").length;
    const normal = subset.filter((r) => classifyMuac(r) === "normal").length;
    const oedema = subset.filter((r) => r.oedema === true).length;
    return {
      ageBand: b.label.replace(/\s+/g, "").replace("to", "-"),
      total,
      severe: { n: sam, pct: total ? (sam / total) * 100 : 0 },
      moderate: { n: mam, pct: total ? (mam / total) * 100 : 0 },
      normal: { n: normal, pct: total ? (normal / total) * 100 : 0 },
      oedema: { n: oedema, pct: total ? (oedema / total) * 100 : 0 },
    };
  });
  const sumSam = rows.reduce((s, r) => s + r.severe.n, 0);
  const sumMam = rows.reduce((s, r) => s + r.moderate.n, 0);
  const sumNormal = rows.reduce((s, r) => s + r.normal.n, 0);
  const sumOed = rows.reduce((s, r) => s + r.oedema.n, 0);
  const totals: PrevalenceByAgeRow = {
    ageBand: "Total",
    total: grand,
    severe: { n: sumSam, pct: grand ? (sumSam / grand) * 100 : 0 },
    moderate: { n: sumMam, pct: grand ? (sumMam / grand) * 100 : 0 },
    normal: { n: sumNormal, pct: grand ? (sumNormal / grand) * 100 : 0 },
    oedema: { n: sumOed, pct: grand ? (sumOed / grand) * 100 : 0 },
  };
  return { rows, totals };
}

function buildCombinedDetail(records: ChildRecord[]): { rows: CombinedGamSamRow[]; total: CombinedGamSamRow } {
  // Denominator: children with either valid MUAC or valid WHZ.
  const valid = records.filter((r) => {
    const whzOk = r.whz !== null && !whoFlag(r.whz, "WHZ");
    return r.muac_mm !== null || whzOk;
  });
  const n = valid.length;
  const hasMuac = (r: ChildRecord) => r.muac_mm !== null;
  const hasWhz = (r: ChildRecord) => r.whz !== null && !whoFlag(r.whz, "WHZ");

  // "MUAC" row: cases identified by MUAC only (not by WHZ).
  const muacGam = valid.filter((r) => hasMuac(r) && r.muac_mm! < 125 && !(hasWhz(r) && r.whz! < -2)).length;
  const muacSam = valid.filter((r) => hasMuac(r) && r.muac_mm! < 115 && !(hasWhz(r) && r.whz! < -3)).length;
  // "WHZ" row: cases identified by WHZ only (not by MUAC).
  const whzGam = valid.filter((r) => hasWhz(r) && r.whz! < -2 && !(hasMuac(r) && r.muac_mm! < 125)).length;
  const whzSam = valid.filter((r) => hasWhz(r) && r.whz! < -3 && !(hasMuac(r) && r.muac_mm! < 115)).length;
  // "Both" row: cases flagged by both MUAC and WHZ.
  const bothGam = valid.filter((r) => hasMuac(r) && r.muac_mm! < 125 && hasWhz(r) && r.whz! < -2).length;
  const bothSam = valid.filter((r) => hasMuac(r) && r.muac_mm! < 115 && hasWhz(r) && r.whz! < -3).length;
  const oedemaN = valid.filter((r) => r.oedema === true).length;

  const rows: CombinedGamSamRow[] = [
    { source: "MUAC", gam: { n: muacGam, pct: n ? (muacGam / n) * 100 : 0 }, sam: { n: muacSam, pct: n ? (muacSam / n) * 100 : 0 } },
    { source: "WHZ", gam: { n: whzGam, pct: n ? (whzGam / n) * 100 : 0 }, sam: { n: whzSam, pct: n ? (whzSam / n) * 100 : 0 } },
    { source: "Both", gam: { n: bothGam, pct: n ? (bothGam / n) * 100 : 0 }, sam: { n: bothSam, pct: n ? (bothSam / n) * 100 : 0 } },
    { source: "Oedema", gam: { n: oedemaN, pct: n ? (oedemaN / n) * 100 : 0 }, sam: { n: oedemaN, pct: n ? (oedemaN / n) * 100 : 0 } },
  ];

  const totalGam = valid.filter((r) =>
    (hasWhz(r) && r.whz! < -2) || (hasMuac(r) && r.muac_mm! < 125) || r.oedema === true
  ).length;
  const totalSam = valid.filter((r) =>
    (hasWhz(r) && r.whz! < -3) || (hasMuac(r) && r.muac_mm! < 115) || r.oedema === true
  ).length;
  const total: CombinedGamSamRow = {
    source: "Total",
    gam: { n: totalGam, pct: n ? (totalGam / n) * 100 : 0 },
    sam: { n: totalSam, pct: n ? (totalSam / n) * 100 : 0 },
  };
  return { rows, total };
}

/* ----------------------- Z-score-based table builders ----------------------- */

type ZKind = "whz" | "haz" | "waz";
const Z_FLAG_KIND = { whz: "WHZ", haz: "HAZ", waz: "WAZ" } as const;

function zOf(r: ChildRecord, kind: ZKind): number | null {
  return r[kind];
}

/** Records that contributed a usable z-score after WHO biological-plausibility flagging. */
function filterFlagged(records: ChildRecord[], kind: ZKind): ChildRecord[] {
  return records.filter((r) => {
    const z = zOf(r, kind);
    return z !== null && !whoFlag(z, Z_FLAG_KIND[kind]);
  });
}

function buildPrevalenceByZSex(records: ChildRecord[], kind: ZKind): PrevalenceBySexTable {
  const valid = filterFlagged(records, kind);
  const fn = (subset: ChildRecord[]) => {
    const n = subset.length;
    const sev = subset.filter((r) => (zOf(r, kind)! < -3) || (kind === "whz" && r.oedema === true)).length;
    const mod = subset.filter((r) => {
      const z = zOf(r, kind)!;
      // Moderate: <-2 and >= -3, no oedema (for WHZ)
      if (kind === "whz") return z < -2 && z >= -3 && r.oedema !== true;
      return z < -2 && z >= -3;
    }).length;
    const gam = sev + mod;
    return { global: cell(gam, n), moderate: cell(mod, n), severe: cell(sev, n) };
  };
  const all = fn(valid);
  const b = fn(valid.filter((r) => r.sex === "male"));
  const g = fn(valid.filter((r) => r.sex === "female"));
  return {
    global: { all: all.global, boys: b.global, girls: g.global },
    moderate: { all: all.moderate, boys: b.moderate, girls: g.moderate },
    severe: { all: all.severe, boys: b.severe, girls: g.severe },
  };
}

function buildPrevalenceByZAge(
  records: ChildRecord[],
  kind: ZKind
): { rows: WhzMatrixRow[]; totals: WhzMatrixRow } {
  const valid = filterFlagged(records, kind);
  const rows: WhzMatrixRow[] = AGE_BANDS.map((b) => {
    const subset = valid.filter((r) => r.age_months !== null && r.age_months >= b.min && r.age_months <= b.max);
    const total = subset.length;
    const sev = subset.filter((r) => (zOf(r, kind)! < -3) || (kind === "whz" && r.oedema === true)).length;
    const mod = subset.filter((r) => {
      const z = zOf(r, kind)!;
      if (kind === "whz") return z < -2 && z >= -3 && r.oedema !== true;
      return z < -2 && z >= -3;
    }).length;
    const norm = subset.filter((r) => {
      const z = zOf(r, kind)!;
      if (kind === "whz") return z >= -2 && r.oedema !== true;
      return z >= -2;
    }).length;
    const oed = subset.filter((r) => r.oedema === true).length;
    return {
      ageBand: b.label.replace(/\s+/g, "").replace("to", "-"),
      total,
      severe: { n: sev, pct: total ? (sev / total) * 100 : 0 },
      moderate: { n: mod, pct: total ? (mod / total) * 100 : 0 },
      normal: { n: norm, pct: total ? (norm / total) * 100 : 0 },
      oedema: { n: oed, pct: total ? (oed / total) * 100 : 0 },
    };
  });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const sumSev = rows.reduce((s, r) => s + r.severe.n, 0);
  const sumMod = rows.reduce((s, r) => s + r.moderate.n, 0);
  const sumNorm = rows.reduce((s, r) => s + r.normal.n, 0);
  const sumOed = rows.reduce((s, r) => s + r.oedema.n, 0);
  const totals: WhzMatrixRow = {
    ageBand: "Total",
    total,
    severe: { n: sumSev, pct: total ? (sumSev / total) * 100 : 0 },
    moderate: { n: sumMod, pct: total ? (sumMod / total) * 100 : 0 },
    normal: { n: sumNorm, pct: total ? (sumNorm / total) * 100 : 0 },
    oedema: { n: sumOed, pct: total ? (sumOed / total) * 100 : 0 },
  };
  return { rows, totals };
}

/** Table 3.4 — marasmic-kwashiorkor 2×2 cross of WHZ < -3 with oedema. */
function buildWhzOedemaMatrix(records: ChildRecord[]): WhzKwashRow[] {
  const valid = filterFlagged(records, "whz");
  const n = valid.length || 1;
  const oedSev = valid.filter((r) => r.oedema === true && r.whz! < -3).length;
  const oedNotSev = valid.filter((r) => r.oedema === true && r.whz! >= -3).length;
  const noOedSev = valid.filter((r) => r.oedema !== true && r.whz! < -3).length;
  const noOedNotSev = valid.filter((r) => r.oedema !== true && r.whz! >= -3).length;
  return [
    {
      bilateralOedemaPresent: true,
      belowMinus3: oedSev,
      belowMinus3Pct: (oedSev / n) * 100,
      atOrAboveMinus3: oedNotSev,
      atOrAboveMinus3Pct: (oedNotSev / n) * 100,
    },
    {
      bilateralOedemaPresent: false,
      belowMinus3: noOedSev,
      belowMinus3Pct: (noOedSev / n) * 100,
      atOrAboveMinus3: noOedNotSev,
      atOrAboveMinus3Pct: (noOedNotSev / n) * 100,
    },
  ];
}

/** Table 3.13 — overweight by sex (WHZ > 2). Severe: WHZ > 3. */
function buildOverweightBySex(records: ChildRecord[]): PrevalenceBySexTable {
  const valid = filterFlagged(records, "whz").filter((r) => r.oedema !== true);
  const fn = (subset: ChildRecord[]) => {
    const n = subset.length;
    const over = subset.filter((r) => r.whz! > 2).length;
    const sev = subset.filter((r) => r.whz! > 3).length;
    const mod = over - sev;
    return { global: cell(over, n), moderate: cell(mod, n), severe: cell(sev, n) };
  };
  const all = fn(valid);
  const b = fn(valid.filter((r) => r.sex === "male"));
  const g = fn(valid.filter((r) => r.sex === "female"));
  return {
    global: { all: all.global, boys: b.global, girls: g.global },
    moderate: { all: all.moderate, boys: b.moderate, girls: g.moderate },
    severe: { all: all.severe, boys: b.severe, girls: g.severe },
  };
}

function buildOverweightByAge(records: ChildRecord[]): { rows: WhzMatrixRow[]; totals: WhzMatrixRow } {
  const valid = filterFlagged(records, "whz").filter((r) => r.oedema !== true);
  const rows: WhzMatrixRow[] = AGE_BANDS.map((b) => {
    const subset = valid.filter((r) => r.age_months !== null && r.age_months >= b.min && r.age_months <= b.max);
    const total = subset.length;
    const sev = subset.filter((r) => r.whz! > 3).length;
    const mod = subset.filter((r) => r.whz! > 2 && r.whz! <= 3).length;
    return {
      ageBand: b.label.replace(/\s+/g, "").replace("to", "-"),
      total,
      severe: { n: sev, pct: total ? (sev / total) * 100 : 0 },
      moderate: { n: mod, pct: total ? (mod / total) * 100 : 0 },
      normal: { n: total - sev - mod, pct: total ? ((total - sev - mod) / total) * 100 : 0 },
      oedema: { n: 0, pct: 0 },
    };
  });
  const total = rows.reduce((s, r) => s + r.total, 0);
  const sumSev = rows.reduce((s, r) => s + r.severe.n, 0);
  const sumMod = rows.reduce((s, r) => s + r.moderate.n, 0);
  return {
    rows,
    totals: {
      ageBand: "Total",
      total,
      severe: { n: sumSev, pct: total ? (sumSev / total) * 100 : 0 },
      moderate: { n: sumMod, pct: total ? (sumMod / total) * 100 : 0 },
      normal: { n: total - sumSev - sumMod, pct: total ? ((total - sumSev - sumMod) / total) * 100 : 0 },
      oedema: { n: 0, pct: 0 },
    },
  };
}

/** Table 3.15 — mean z-scores using SMART exclusion (observed mean ± 3 SD). */
function buildZScoreSummary(records: ChildRecord[], kind: ZKind): ZScoreSummary {
  const zs = records.map((r) => zOf(r, kind));
  const withWhoFlag = zs.map((z) => (z !== null && whoFlag(z, Z_FLAG_KIND[kind]) ? null : z));
  const flags = smartFlags(withWhoFlag);
  const kept = withWhoFlag
    .map((z, i) => (flags[i] || z === null ? null : z))
    .filter((z): z is number => z !== null);
  const excluded = zs.filter((z) => z !== null).length - kept.length;
  return {
    n: kept.length,
    mean: safeMean(kept),
    sd: safeStd(kept),
    skewness: safeSkew(kept),
    kurtosis: safeKurt(kept),
    excluded,
  };
}

/* ----------------------- assembly ----------------------- */

export function buildAnthroReport(
  records: ChildRecord[],
  meta: { fromDate: string; toDate: string }
): AnthroReport {
  const withMuac = records.filter((r) => r.muac_mm !== null);
  const muacBased = buildPrevalenceBySex(records);
  // Table 3.7 (combined GAM/SAM) = WHZ <-2 OR MUAC<125 OR oedema for GAM,
  // WHZ <-3 OR MUAC<115 OR oedema for SAM. Implement via classification predicate.
  const combinedBySex = buildCombinedGamSamBySex(records);

  return {
    meta: {
      fromDate: meta.fromDate,
      toDate: meta.toDate,
      totalRecords: records.length,
      n_muac: withMuac.length,
      n_boys: withMuac.filter((r) => r.sex === "male").length,
      n_girls: withMuac.filter((r) => r.sex === "female").length,
      n_whz: records.filter((r) => r.whz !== null && !whoFlag(r.whz, "WHZ")).length,
      n_haz: records.filter((r) => r.haz !== null && !whoFlag(r.haz, "HAZ")).length,
      n_waz: records.filter((r) => r.waz !== null && !whoFlag(r.waz, "WAZ")).length,
      referenceStandard: "WHO standards 2006",
      ciMethod: "Wilson 95% (SRS approximation)",
    },
    sample: buildSampleTable(records),
    prevalenceByWhzSex: buildPrevalenceByZSex(records, "whz"),
    prevalenceByWhzAge: buildPrevalenceByZAge(records, "whz"),
    whzOedemaMatrix: buildWhzOedemaMatrix(records),
    prevalenceByMuacSex: muacBased,
    prevalenceByMuacAge: buildPrevalenceByAge(records),
    combinedGamSamBySex: combinedBySex,
    combinedDetail: buildCombinedDetail(records),
    prevalenceByWazSex: buildPrevalenceByZSex(records, "waz"),
    prevalenceByWazAge: buildPrevalenceByZAge(records, "waz"),
    prevalenceByHazSex: buildPrevalenceByZSex(records, "haz"),
    prevalenceByHazAge: buildPrevalenceByZAge(records, "haz"),
    overweightBySex: buildOverweightBySex(records),
    overweightByAge: buildOverweightByAge(records),
    meanZScores: {
      WHZ: buildZScoreSummary(records, "whz"),
      WAZ: buildZScoreSummary(records, "waz"),
      HAZ: buildZScoreSummary(records, "haz"),
    },
  };
}

/** Table 3.7 — combined GAM/SAM using WHZ OR MUAC OR oedema. */
function buildCombinedGamSamBySex(records: ChildRecord[]): PrevalenceBySexTable {
  // Combined denominator: children with either valid WHZ or valid MUAC
  const valid = records.filter((r) => {
    const whzOk = r.whz !== null && !whoFlag(r.whz, "WHZ");
    return whzOk || r.muac_mm !== null;
  });
  const fn = (subset: ChildRecord[]) => {
    const n = subset.length;
    const isSam = (r: ChildRecord) =>
      (r.whz !== null && !whoFlag(r.whz, "WHZ") && r.whz < -3) ||
      (r.muac_mm !== null && r.muac_mm < 115) ||
      r.oedema === true;
    const isGam = (r: ChildRecord) =>
      (r.whz !== null && !whoFlag(r.whz, "WHZ") && r.whz < -2) ||
      (r.muac_mm !== null && r.muac_mm < 125) ||
      r.oedema === true;
    const sam = subset.filter(isSam).length;
    const gam = subset.filter(isGam).length;
    const mod = gam - sam;
    return { global: cell(gam, n), moderate: cell(mod, n), severe: cell(sam, n) };
  };
  const all = fn(valid);
  const b = fn(valid.filter((r) => r.sex === "male"));
  const g = fn(valid.filter((r) => r.sex === "female"));
  return {
    global: { all: all.global, boys: b.global, girls: g.global },
    moderate: { all: all.moderate, boys: b.moderate, girls: g.moderate },
    severe: { all: all.severe, boys: b.severe, girls: g.severe },
  };
}
