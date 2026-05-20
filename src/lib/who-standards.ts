/**
 * WHO 2006 growth-standards z-score calculations.
 *
 * Formula (LMS method):
 *   if L != 0:  z = ((value / M)^L - 1) / (L * S)
 *   if L == 0:  z = ln(value / M) / S
 *
 * After computing the raw z, WHO applies an adjustment for extreme values
 * (the SD2/SD3 splice) so the distribution is finite at the tails. See
 * WHO Anthro Survey Analyser — "Computation of z-scores" (formulas 9-13).
 *
 * Convention: for ages 6–59 months, WFL is used when age < 24 mo, WFH otherwise.
 * Heights/lengths are clipped to the table range.
 */
import { WFA_BOYS, WFA_GIRLS, type LMS } from "./who-data/wfa";
import { HFA_BOYS, HFA_GIRLS } from "./who-data/hfa";
import { WFL_BOYS, WFL_GIRLS } from "./who-data/wfl";
import { WFH_BOYS, WFH_GIRLS } from "./who-data/wfh";

export type Sex = "male" | "female";

/* ----------------------- core z-score ----------------------- */

function rawZ(value: number, lms: LMS): number {
  const { l, m, s } = lms;
  if (l === 0) return Math.log(value / m) / s;
  return (Math.pow(value / m, l) - 1) / (l * s);
}

/**
 * Adjusted z-score with WHO SD2/SD3 extension for the tails (z < -3 or z > 3).
 * Outside ±3, the z is rescaled so the cutoff distances correspond to
 * (SD3 − SD2) on either side of ±3.
 */
function adjustedZ(value: number, lms: LMS): number {
  const z = rawZ(value, lms);
  if (z >= -3 && z <= 3) return z;
  // Compute the value at ±2 and ±3 SD to derive the splice
  const { l, m, s } = lms;
  const x = (sd: number) =>
    l === 0 ? m * Math.exp(s * sd) : m * Math.pow(1 + l * s * sd, 1 / l);
  if (z > 3) {
    const SD3 = x(3);
    const SD23 = SD3 - x(2);
    return 3 + (value - SD3) / SD23;
  }
  // z < -3
  const SDneg3 = x(-3);
  const SDneg23 = x(-2) - SDneg3;
  return -3 + (value - SDneg3) / SDneg23;
}

function lookupMonth(table: Record<number, LMS>, ageMonths: number): LMS | null {
  if (!Number.isFinite(ageMonths)) return null;
  const lo = Math.floor(ageMonths);
  const hi = Math.ceil(ageMonths);
  const tLo = table[lo];
  if (!tLo) return null;
  if (lo === hi) return tLo;
  const tHi = table[hi];
  if (!tHi) return tLo;
  const w = ageMonths - lo;
  return {
    l: tLo.l + (tHi.l - tLo.l) * w,
    m: tLo.m + (tHi.m - tLo.m) * w,
    s: tLo.s + (tHi.s - tLo.s) * w,
  };
}

function lookupCm(table: Record<string, LMS>, cm: number, lo: number, hi: number): LMS | null {
  if (!Number.isFinite(cm)) return null;
  // Clip silently — out-of-range measurements should not crash the report.
  const c = Math.min(Math.max(cm, lo), hi);
  // Round to nearest 0.1 cm
  const k = (Math.round(c * 10) / 10).toFixed(1);
  return table[k] ?? null;
}

/* ----------------------- public API ----------------------- */

/**
 * Weight-for-height/length z-score. Uses WFL when age < 24 months, WFH otherwise.
 * Returns null if any input is missing/invalid or out of WHO range.
 */
export function whz(sex: Sex, ageMonths: number, heightCm: number, weightKg: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return null;
  let lms: LMS | null;
  if (ageMonths < 24) {
    const tbl = sex === "male" ? WFL_BOYS : WFL_GIRLS;
    lms = lookupCm(tbl, heightCm, 45.0, 110.0);
  } else {
    const tbl = sex === "male" ? WFH_BOYS : WFH_GIRLS;
    lms = lookupCm(tbl, heightCm, 65.0, 120.0);
  }
  if (!lms) return null;
  return adjustedZ(weightKg, lms);
}

/**
 * Height-for-age z-score (months 0–60).
 */
export function haz(sex: Sex, ageMonths: number, heightCm: number): number | null {
  if (!Number.isFinite(heightCm) || heightCm <= 0) return null;
  if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 60) return null;
  const tbl = sex === "male" ? HFA_BOYS : HFA_GIRLS;
  const lms = lookupMonth(tbl, ageMonths);
  if (!lms) return null;
  return adjustedZ(heightCm, lms);
}

/**
 * Weight-for-age z-score (months 0–60).
 */
export function waz(sex: Sex, ageMonths: number, weightKg: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(ageMonths) || ageMonths < 0 || ageMonths > 60) return null;
  const tbl = sex === "male" ? WFA_BOYS : WFA_GIRLS;
  const lms = lookupMonth(tbl, ageMonths);
  if (!lms) return null;
  return adjustedZ(weightKg, lms);
}

/* ----------------------- flagging ----------------------- */

export type FlagProcedure = "none" | "who" | "smart";

/**
 * WHO biological-plausibility flags. A z-score is flagged when it falls outside
 * a fixed range; ENA's defaults are: WHZ ±5, HAZ ±6/−6 (some use ±6), WAZ −6/+5.
 */
export function whoFlag(z: number | null, kind: "WHZ" | "HAZ" | "WAZ"): boolean {
  if (z === null || !Number.isFinite(z)) return false;
  if (kind === "WHZ") return z < -5 || z > 5;
  if (kind === "HAZ") return z < -6 || z > 6;
  return z < -6 || z > 5; // WAZ
}

/**
 * SMART flags: exclude observations whose z-score is more than ±3 SD from the
 * observed mean. Done iteratively until the flag set stabilizes (typically 1–2 passes).
 */
export function smartFlags(values: (number | null)[]): boolean[] {
  // Initialise as "not flagged" for every finite value
  const flagged = values.map((v) => v === null || !Number.isFinite(v));
  const arr = values.map((v) => (v === null || !Number.isFinite(v) ? NaN : (v as number)));
  for (let iter = 0; iter < 5; iter++) {
    const kept = arr.filter((v, i) => !flagged[i] && Number.isFinite(v));
    if (kept.length < 2) break;
    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    const sd = Math.sqrt(kept.reduce((a, b) => a + (b - mean) ** 2, 0) / (kept.length - 1));
    const newFlagged = flagged.slice();
    for (let i = 0; i < arr.length; i++) {
      if (flagged[i]) continue;
      newFlagged[i] = arr[i] < mean - 3 * sd || arr[i] > mean + 3 * sd;
    }
    if (newFlagged.every((v, i) => v === flagged[i])) break;
    for (let i = 0; i < flagged.length; i++) flagged[i] = newFlagged[i];
  }
  return flagged;
}
