/**
 * Statistical helpers for the plausibility report.
 * Pure functions; no external state.
 */
import * as ss from "simple-statistics";

/** Pearson chi-square test from observed/expected arrays. Returns {chi2, df, p}. */
export function chiSquareTest(observed: number[], expected: number[]): { chi2: number; df: number; p: number } {
  if (observed.length !== expected.length) throw new Error("length mismatch");
  let chi2 = 0;
  let df = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = expected[i];
    if (e <= 0) continue;
    chi2 += ((observed[i] - e) ** 2) / e;
    df++;
  }
  df = Math.max(1, df - 1);
  return { chi2, df, p: chiSquareSurvival(chi2, df) };
}

/** Chi-square goodness-of-fit against a uniform distribution. */
export function chiSquareUniform(counts: number[]): { chi2: number; df: number; p: number } {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = counts.map(() => total / counts.length);
  return chiSquareTest(counts, expected);
}

/** Survival function of chi-square (upper-tail p-value) using regularized upper incomplete gamma. */
export function chiSquareSurvival(x: number, df: number): number {
  if (x <= 0) return 1;
  return regularizedGammaQ(df / 2, x / 2);
}

/* ---------- gamma / incomplete gamma (Numerical Recipes-style) ---------- */

function logGamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Lower regularized incomplete gamma P(a, x). */
function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // series expansion
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  return 1 - regularizedGammaQ(a, x);
}

/** Upper regularized incomplete gamma Q(a, x) = 1 - P(a, x). */
function regularizedGammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) return 1 - regularizedGammaP(a, x);
  // continued fraction (Lentz)
  const eps = 1e-12;
  const fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpmin;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/* ---------- Digit preference (SMART formula) ---------- */

/**
 * For MUAC measured to the nearest 1 mm, the "last digit" is value % 10.
 * For weight/height to nearest 0.1, it's also a 0-9 distribution.
 * DPS = Σ |observed% − 10|.
 */
export function digitCounts(values: number[]): number[] {
  const c = new Array(10).fill(0);
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const d = Math.abs(Math.round(v)) % 10;
    c[d] += 1;
  }
  return c;
}

export function digitPercentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  return counts.map((c) => (c / total) * 100);
}

/**
 * SMART/ENA DPS uses the root-mean-square deviation from a uniform 10% per digit:
 *   DPS = round( √( Σ (p_i − 10)² ) )
 *
 * Cutoffs (SMART): 0-7 excellent · 8-12 good · 13-20 acceptable · >20 problematic.
 */
export function digitPreferenceScore(values: number[]): number {
  const pcts = digitPercentages(digitCounts(values));
  const ss = pcts.reduce((s, p) => s + (p - 10) ** 2, 0);
  return Math.round(Math.sqrt(ss));
}

/* ---------- Histograms ---------- */

export function histogram(values: number[], min: number, max: number): Record<number, number> {
  const h: Record<number, number> = {};
  for (let i = min; i <= max; i++) h[i] = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const k = Math.floor(v);
    if (k >= min && k <= max) h[k] += 1;
  }
  return h;
}

/* ---------- Sex/age ratios ---------- */

export type SexAgeCell = {
  ageBand: string;
  months: number;
  obsBoys: number;
  obsGirls: number;
  expBoys: number;
  expGirls: number;
};

export const AGE_BANDS: { label: string; min: number; max: number; months: number }[] = [
  { label: "6  to 17", min: 6, max: 17, months: 12 },
  { label: "18 to 29", min: 18, max: 29, months: 12 },
  { label: "30 to 41", min: 30, max: 41, months: 12 },
  { label: "42 to 53", min: 42, max: 53, months: 12 },
  { label: "54 to 59", min: 54, max: 59, months: 6 },
];

/** Compute sex/age contingency for the ENA sex/age table. */
export function sexAgeTable(records: { sex: string; age_months: number | null }[]): {
  cells: SexAgeCell[];
  totals: { boys: number; girls: number; total: number };
  pSex: number;
  pAge: number;
  pAgeRatio: number; // 6-29 vs 30-59
  pAgeBoys: number;
  pAgeGirls: number;
  pSexAge: number;
} {
  const valid = records.filter((r) => r.age_months !== null && r.age_months >= 6 && r.age_months <= 59);
  const boys = valid.filter((r) => r.sex === "male").length;
  const girls = valid.filter((r) => r.sex === "female").length;
  const total = boys + girls;
  // Expected proportion of boys/girls in each age band is based on the SMART/WHO reference
  // distribution; ENA derives expectations from the demographic model where each year of age
  // contributes equally, with the 54-59 band weighted at 6/12. We use that here.
  const totalMonths = AGE_BANDS.reduce((s, b) => s + b.months, 0); // 54
  const cells: SexAgeCell[] = AGE_BANDS.map((b) => {
    const fraction = b.months / totalMonths;
    const obsBoys = valid.filter((r) => r.sex === "male" && r.age_months! >= b.min && r.age_months! <= b.max).length;
    const obsGirls = valid.filter((r) => r.sex === "female" && r.age_months! >= b.min && r.age_months! <= b.max).length;
    return {
      ageBand: b.label,
      months: b.months,
      obsBoys,
      obsGirls,
      expBoys: boys * fraction,
      expGirls: girls * fraction,
    };
  });

  // Sex ratio chi-square: against expected 50/50 (or against the SMART reference of 1.03 m:f; we use 50/50)
  const pSex = chiSquareTest([boys, girls], [total / 2, total / 2]).p;

  // Age distribution chi-square (overall) — combine boys+girls per band against expected uniform-per-month
  const ageObs = cells.map((c) => c.obsBoys + c.obsGirls);
  const ageExp = cells.map((c) => c.expBoys + c.expGirls);
  const pAge = chiSquareTest(ageObs, ageExp).p;

  // Age ratio: 6-29 vs 30-59 (the SMART "age ratio" line — expected ratio 0.85)
  const young = valid.filter((r) => r.age_months! >= 6 && r.age_months! <= 29).length;
  const old = valid.filter((r) => r.age_months! >= 30 && r.age_months! <= 59).length;
  // Expected ratio 0.85 → expYoung fraction = 0.85/1.85, expOld = 1/1.85.
  const expYoung = total * (0.85 / 1.85);
  const expOld = total * (1 / 1.85);
  const pAgeRatio = chiSquareTest([young, old], [expYoung, expOld]).p;

  const pAgeBoys = chiSquareTest(
    cells.map((c) => c.obsBoys),
    cells.map((c) => c.expBoys),
  ).p;
  const pAgeGirls = chiSquareTest(
    cells.map((c) => c.obsGirls),
    cells.map((c) => c.expGirls),
  ).p;
  // Sex/age combined: chi-square on the 2x5 table
  const obsCombined = cells.flatMap((c) => [c.obsBoys, c.obsGirls]);
  const expCombined = cells.flatMap((c) => [c.expBoys, c.expGirls]);
  const pSexAge = chiSquareTest(obsCombined, expCombined).p;

  return { cells, totals: { boys, girls, total }, pSex, pAge, pAgeRatio, pAgeBoys, pAgeGirls, pSexAge };
}

/* ---------- Misc ---------- */

export function safeStd(values: number[]): number | null {
  if (values.length < 2) return null;
  return ss.standardDeviation(values);
}
export function safeMean(values: number[]): number | null {
  if (values.length < 1) return null;
  return ss.mean(values);
}
export function safeSkew(values: number[]): number | null {
  if (values.length < 3) return null;
  return ss.sampleSkewness(values);
}
export function safeKurt(values: number[]): number | null {
  if (values.length < 4) return null;
  return ss.sampleKurtosis(values);
}
