/**
 * Builds a PlausibilityReport (pure data) from cleaned ChildRecords.
 * Matches the structure of ENA's plausibility report (jan17_2026.docx) for the
 * MUAC-only case; WHZ/HAZ/WAZ sections render as null and are shown as "—" in the UI.
 */
import type { ChildRecord } from "./clean";
import {
  AGE_BANDS,
  chiSquareSurvival,
  chiSquareTest,
  digitCounts,
  digitPercentages,
  digitPreferenceScore,
  histogram,
  safeKurt,
  safeMean,
  safeSkew,
  safeStd,
  sexAgeTable,
} from "./stats";
import { smartFlags, whoFlag } from "./who-standards";

export type ScoreBand = "excellent" | "good" | "acceptable" | "problematic";

function scoreFlagged(pct: number): { score: number; band: ScoreBand } {
  if (pct <= 2.5) return { score: 0, band: "excellent" };
  if (pct <= 5) return { score: 5, band: "good" };
  if (pct <= 7.5) return { score: 10, band: "acceptable" };
  return { score: 20, band: "problematic" };
}
function scorePValue(p: number): { score: number; band: ScoreBand } {
  if (p > 0.1) return { score: 0, band: "excellent" };
  if (p > 0.05) return { score: 2, band: "good" };
  if (p > 0.001) return { score: 4, band: "acceptable" };
  return { score: 10, band: "problematic" };
}
function scoreDPS(dps: number): { score: number; band: ScoreBand } {
  if (dps <= 7) return { score: 0, band: "excellent" };
  if (dps <= 12) return { score: 2, band: "good" };
  if (dps <= 20) return { score: 4, band: "acceptable" };
  return { score: 10, band: "problematic" };
}
/** SMART standard-deviation criterion for WHZ. Excellent 0.8–1.1; problematic ≤0.8 or ≥1.2. */
function scoreWhzSd(sd: number | null): { score: number; band: ScoreBand } {
  if (sd === null) return { score: 0, band: "excellent" };
  if (sd >= 0.9 && sd <= 1.1) return { score: 0, band: "excellent" };
  if (sd >= 0.85 && sd <= 1.15) return { score: 5, band: "good" };
  if (sd >= 0.8 && sd <= 1.2) return { score: 10, band: "acceptable" };
  return { score: 20, band: "problematic" };
}
/** SMART skewness/kurtosis: <±0.2 excellent, <±0.4 good, <±0.6 acceptable, else problematic. */
function scoreSkewKurt(v: number | null): { score: number; band: ScoreBand } {
  if (v === null) return { score: 0, band: "excellent" };
  const a = Math.abs(v);
  if (a < 0.2) return { score: 0, band: "excellent" };
  if (a < 0.4) return { score: 1, band: "good" };
  if (a < 0.6) return { score: 3, band: "acceptable" };
  return { score: 5, band: "problematic" };
}

export type PlausibilityReport = {
  meta: {
    generatedAt: string;
    fromDate: string;
    toDate: string;
    formId: string;
    projectId: number | string;
    totalRecords: number;
    referenceStandard: string;
  };
  overallScore: {
    rows: { label: string; flag: string; unit: string; value: string; score: number; band: ScoreBand }[];
    totalScore: number;
    bandLabel: string;
  };
  missing: {
    weight: string[];
    height: string[];
    pctWithBirthdate: number;
  };
  ageDistribution: { month: number; count: number }[];
  monthOfBirth: { month: number; label: string; count: number }[];
  sexAge: ReturnType<typeof sexAgeTable>;
  digitPref: {
    weight: { counts: number[]; percents: number[]; dps: number } | null;
    height: { counts: number[]; percents: number[]; dps: number } | null;
    muac: { counts: number[]; percents: number[]; dps: number } | null;
  };
  // WHZ/HAZ/WAZ are placeholders until weight/height come online
  zScores: {
    WHZ: ZScoreStats | null;
    HAZ: ZScoreStats | null;
    WAZ: ZScoreStats | null;
  };
  byTeam: {
    team: string;
    n: number;
    sexRatio: number;
    ageRatio6_29_vs_30_59: number;
    sexAge: ReturnType<typeof sexAgeTable>;
    digitPref: { weight: number | null; height: number | null; muac: number | null };
    muacDigitPct: number[]; // per-digit % (length 10) for diagnostic callouts
  }[];
  teamSummary: TeamSummary[];
};

export type TeamSummary = {
  team: string;
  n: number;
  totalScore: number;
  band: ScoreBand;
  metrics: {
    label: string;
    value: string;
    score: number;
    band: ScoreBand;
  }[];
  issues: string[]; // human-readable callouts for metrics in acceptable/problematic bands
};

export type ZScoreStats = {
  n: number;
  mean: number | null;
  sd: number | null;
  skewness: number | null;
  kurtosis: number | null;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function buildReport(
  records: ChildRecord[],
  meta: { fromDate: string; toDate: string; formId: string; projectId: number | string }
): PlausibilityReport {
  const total = records.length;
  // Missing weight/height — in MUAC-only mode, all rows.
  const missingWeight: string[] = [];
  const missingHeight: string[] = [];
  records.forEach((r, i) => {
    if (r.weight_kg === null) missingWeight.push(`Line=${i + 1}/ID=${r.id}`);
    if (r.height_cm === null) missingHeight.push(`Line=${i + 1}/ID=${r.id}`);
  });

  const withBirthdate = records.filter((r) => r.birthdate).length;
  const pctWithBirthdate = total ? Math.round((withBirthdate / total) * 1000) / 10 : 0;

  // Age distribution 6..60
  const ageMonths = records.map((r) => r.age_months).filter((x): x is number => x !== null);
  const ageHist = histogram(ageMonths, 6, 60);
  const ageDistribution = Object.entries(ageHist).map(([m, c]) => ({ month: Number(m), count: c }));

  // Month of birth
  const mob = new Array(12).fill(0);
  for (const r of records) {
    if (!r.birthdate) continue;
    const m = Number(r.birthdate.slice(5, 7));
    if (m >= 1 && m <= 12) mob[m - 1]++;
  }
  const monthOfBirth = mob.map((c, i) => ({ month: i + 1, label: MONTH_LABELS[i], count: c }));

  const sa = sexAgeTable(records);

  // Digit preference — MUAC mm + weight (kg.0/.1) + height (cm.0/.1)
  const muacVals = records.map((r) => r.muac_mm).filter((x): x is number => x !== null);
  const muacCounts = digitCounts(muacVals);
  const muacPct = digitPercentages(muacCounts);
  const muacDPS = digitPreferenceScore(muacVals);
  // For weight/height in kg/cm we look at the first decimal: multiply by 10 then take last digit.
  const weightDecimals = records.map((r) => r.weight_kg).filter((x): x is number => x !== null).map((v) => Math.round(v * 10));
  const heightDecimals = records.map((r) => r.height_cm).filter((x): x is number => x !== null).map((v) => Math.round(v * 10));
  const weightDPS = weightDecimals.length ? digitPreferenceScore(weightDecimals) : null;
  const heightDPS = heightDecimals.length ? digitPreferenceScore(heightDecimals) : null;

  // WHZ-based plausibility stats (using SMART flag procedure)
  const whzVals = records.map((r) => r.whz);
  const whzAfterWho = whzVals.map((z) => (z !== null && whoFlag(z, "WHZ") ? null : z));
  const whzFlags = smartFlags(whzAfterWho);
  const whzKept = whzAfterWho
    .map((z, i) => (whzFlags[i] || z === null ? null : z))
    .filter((z): z is number => z !== null);
  const whzN = whzKept.length;
  const whzSd = safeStd(whzKept);
  const whzSkew = safeSkew(whzKept);
  const whzKurt = safeKurt(whzKept);
  const whzFlaggedCount = whzVals.filter((z) => z !== null).length - whzN;
  const whzFlaggedPct = whzVals.length ? (whzFlaggedCount / whzVals.filter((z) => z !== null).length) * 100 : 0;

  const overallSexP = sa.pSex;
  const overallAgeRatioP = sa.pAgeRatio;

  // Each criterion is only included when the underlying data exists for it. Rows that
  // can't be computed (e.g. WHZ-based rows in a MUAC-only survey) are omitted entirely
  // so they don't penalize the total score.
  const hasWhz = whzVals.some((z) => z !== null);
  const hasMuac = muacVals.length > 0;
  const hasWeight = weightDPS !== null;
  const hasHeight = heightDPS !== null;

  type Row = { label: string; flag: string; unit: string; value: string; score: number; band: ScoreBand };
  const overallScoreRows: Row[] = [];

  if (hasWhz) {
    overallScoreRows.push({
      label: "Flagged data",
      flag: "Incl",
      unit: "%",
      value: `${whzFlaggedPct.toFixed(1)}%`,
      ...scoreFlagged(whzFlaggedPct),
    });
  }
  overallScoreRows.push({
    label: "Overall Sex ratio",
    flag: "Incl",
    unit: "p",
    value: `p=${overallSexP.toFixed(3)}`,
    ...scorePValue(overallSexP),
  });
  overallScoreRows.push({
    label: "Age ratio (6-29 vs 30-59)",
    flag: "Incl",
    unit: "p",
    value: `p=${overallAgeRatioP.toFixed(3)}`,
    ...scorePValue(overallAgeRatioP),
  });
  if (hasWeight) {
    overallScoreRows.push({
      label: "Dig pref score - weight",
      flag: "Incl",
      unit: "#",
      value: `${weightDPS}`,
      ...scoreDPS(weightDPS),
    });
  }
  if (hasHeight) {
    overallScoreRows.push({
      label: "Dig pref score - height",
      flag: "Incl",
      unit: "#",
      value: `${heightDPS}`,
      ...scoreDPS(heightDPS),
    });
  }
  if (hasMuac) {
    overallScoreRows.push({
      label: "Dig pref score - MUAC",
      flag: "Incl",
      unit: "#",
      value: `${muacDPS}`,
      ...scoreDPS(muacDPS),
    });
  }
  if (hasWhz) {
    overallScoreRows.push({
      label: "Standard Dev WHZ",
      flag: "Excl",
      unit: "SD",
      value: whzSd !== null ? whzSd.toFixed(2) : "—",
      ...scoreWhzSd(whzSd),
    });
    overallScoreRows.push({
      label: "Skewness WHZ",
      flag: "Excl",
      unit: "#",
      value: whzSkew !== null ? whzSkew.toFixed(2) : "—",
      ...scoreSkewKurt(whzSkew),
    });
    overallScoreRows.push({
      label: "Kurtosis WHZ",
      flag: "Excl",
      unit: "#",
      value: whzKurt !== null ? whzKurt.toFixed(2) : "—",
      ...scoreSkewKurt(whzKurt),
    });
    overallScoreRows.push({
      label: "Poisson dist WHZ-2",
      flag: "Excl",
      unit: "p",
      value: "—",
      score: 0,
      band: "excellent",
    });
  }
  const totalScore = overallScoreRows.reduce((s, r) => s + r.score, 0);
  let bandLabel = "excellent";
  if (totalScore > 24) bandLabel = "problematic";
  else if (totalScore > 14) bandLabel = "acceptable";
  else if (totalScore > 9) bandLabel = "good";

  // By team (pair)
  const teams = Array.from(new Set(records.map((r) => r.pair))).sort();
  const byTeam = teams.map((team) => {
    const subset = records.filter((r) => r.pair === team);
    const males = subset.filter((r) => r.sex === "male").length;
    const females = subset.filter((r) => r.sex === "female").length;
    const young = subset.filter((r) => r.age_months !== null && r.age_months >= 6 && r.age_months <= 29).length;
    const old = subset.filter((r) => r.age_months !== null && r.age_months >= 30 && r.age_months <= 59).length;
    const teamSA = sexAgeTable(subset);
    const muacSubset = subset.map((r) => r.muac_mm).filter((x): x is number => x !== null);
    const muacTeamCounts = digitCounts(muacSubset);
    const muacTeamPct = digitPercentages(muacTeamCounts);
    return {
      team,
      n: subset.length,
      sexRatio: females ? males / females : Infinity,
      ageRatio6_29_vs_30_59: old ? young / old : Infinity,
      sexAge: teamSA,
      digitPref: {
        weight: null,
        height: null,
        muac: muacSubset.length ? digitPreferenceScore(muacSubset) : null,
      },
      muacDigitPct: muacTeamPct,
    };
  });

  // Per-team performance summary against SMART thresholds
  const teamSummary: TeamSummary[] = byTeam.map((t) => {
    const muacScore = t.digitPref.muac !== null ? scoreDPS(t.digitPref.muac) : null;
    const sexScore = scorePValue(t.sexAge.pSex);
    const ageScore = scorePValue(t.sexAge.pAgeRatio);
    const metrics = [
      ...(muacScore
        ? [{ label: "MUAC digit preference", value: String(t.digitPref.muac), ...muacScore }]
        : []),
      { label: "Sex ratio", value: `p=${t.sexAge.pSex.toFixed(3)}`, ...sexScore },
      { label: "Age ratio (6-29 vs 30-59)", value: `p=${t.sexAge.pAgeRatio.toFixed(3)}`, ...ageScore },
    ];
    const totalScore = metrics.reduce((s, m) => s + m.score, 0);
    let band: ScoreBand = "excellent";
    if (metrics.some((m) => m.band === "problematic")) band = "problematic";
    else if (metrics.some((m) => m.band === "acceptable")) band = "acceptable";
    else if (metrics.some((m) => m.band === "good")) band = "good";
    const issues = metrics
      .filter((m) => m.band === "acceptable" || m.band === "problematic")
      .map((m) => {
        let suffix = "";
        if (m.label === "MUAC digit preference") {
          // Identify digits used too often: ≥5 percentage points above the uniform 10% baseline,
          // ranked by deviation. Cap at 3 digits to keep the line readable.
          const flagged = t.muacDigitPct
            .map((pct, digit) => ({ digit, pct, dev: pct - 10 }))
            .filter((d) => d.dev >= 5)
            .sort((a, b) => b.dev - a.dev)
            .slice(0, 3);
          if (flagged.length) {
            suffix = ` — favoring ${flagged.map((d) => `.${d.digit} (${d.pct.toFixed(0)}%)`).join(", ")}`;
          }
        }
        return `${m.label}: ${m.value} (${m.band})${suffix}`;
      });
    return { team: t.team, n: t.n, totalScore, band, metrics, issues };
  });
  // Sort: best teams first
  teamSummary.sort((a, b) => a.totalScore - b.totalScore || a.team.localeCompare(b.team));

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      fromDate: meta.fromDate,
      toDate: meta.toDate,
      formId: meta.formId,
      projectId: meta.projectId,
      totalRecords: total,
      referenceStandard: "WHO standards 2006",
    },
    overallScore: { rows: overallScoreRows, totalScore, bandLabel },
    missing: {
      weight: missingWeight,
      height: missingHeight,
      pctWithBirthdate,
    },
    ageDistribution,
    monthOfBirth,
    sexAge: sa,
    digitPref: {
      weight: null,
      height: null,
      muac: { counts: muacCounts, percents: muacPct, dps: muacDPS },
    },
    zScores: { WHZ: null, HAZ: null, WAZ: null },
    byTeam,
    teamSummary,
  };
}

// Re-export so the chi-square fns are accessible from one place if needed elsewhere
export { chiSquareTest, chiSquareSurvival, safeMean, safeStd, safeSkew, safeKurt };
