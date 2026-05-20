/**
 * Per-form mapping from ODK column names → the canonical fields the report engine expects.
 * Stored in localStorage under `colmap:{pid}:{fid}`. The schema reserves weight/height/oedema
 * so the same configs work when those surveys come online.
 */
export type ColumnMapping = {
  // Required-ish (the report can't run without these)
  survey_date: string;
  cluster: string;
  team: string; // e.g. "pair"
  hh_id: string;
  sex: string;
  age_months: string; // calculated months
  // Optional
  child_name?: string;
  test_name_value?: string; // rows where child_name === this are dropped
  birthdate?: string;
  muac?: string;
  muac_unit?: "cm" | "mm";
  // Reserved for v2
  weight?: string;
  height?: string;
  oedema?: string;
};

export const CANONICAL_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean; hint?: string }[] = [
  { key: "survey_date", label: "Survey date", required: true },
  { key: "cluster", label: "Cluster", required: true },
  { key: "team", label: "Team / pair", required: true, hint: "e.g. pair" },
  { key: "hh_id", label: "Household ID", required: true },
  { key: "sex", label: "Sex", required: true, hint: "values: male/female" },
  { key: "age_months", label: "Age (months)", required: true },
  { key: "child_name", label: "Child name", required: false, hint: "used to drop test rows" },
  { key: "birthdate", label: "Birthdate", required: false },
  { key: "muac", label: "MUAC", required: false },
  { key: "weight", label: "Weight (kg) — reserved", required: false },
  { key: "height", label: "Height/length (cm) — reserved", required: false },
  { key: "oedema", label: "Oedema — reserved", required: false },
];

/**
 * Find the best-matching ODK column for a canonical field.
 *
 * Scoring (higher wins):
 *   - exact match on the full column name             → 1000
 *   - exact match on the LAST segment after "-"       →  800   (handles nested ODK groups)
 *   - last-segment substring match                    →  500
 *   - full-name substring match                       →  200
 * Earlier entries in `candidates` rank above later ones at the same tier.
 * `avoid` substrings subtract 1000 from the score.
 */
function findColumn(
  headers: string[],
  candidates: string[],
  avoid: string[] = []
): string {
  let best = { header: "", score: 0 };
  for (const h of headers) {
    const full = h.toLowerCase();
    const last = full.split("-").pop() ?? full;
    let score = 0;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i].toLowerCase();
      const rank = candidates.length - i;
      if (full === c) score = Math.max(score, 1000 + rank);
      else if (last === c) score = Math.max(score, 800 + rank);
      else if (last.includes(c)) score = Math.max(score, 500 + rank);
      else if (full.includes(c)) score = Math.max(score, 200 + rank);
    }
    for (const a of avoid) if (full.includes(a.toLowerCase())) score -= 1000;
    if (score > best.score) best = { header: h, score };
  }
  return best.score > 0 ? best.header : "";
}

export function suggestDefaults(headers: string[]): ColumnMapping {
  // For each canonical field, list candidate names in ranked order plus disqualifying
  // substrings. Covers both flat ODK forms (rapid_muac_survey) and deeply-nested SMART forms.
  const survey_date = findColumn(headers, ["survey_date", "date"], ["submissiondate", "deathdate", "birthdate"]);
  const team = findColumn(headers, ["team_number", "pair", "team"]);
  // SMART forms often lack a discrete cluster column. Fall back to team_number so the
  // cluster axis still has a value (the user can change it in the config editor).
  const cluster = findColumn(headers, ["cluster"]) || team;
  const hh_id = findColumn(headers, ["hh_id", "household_id", "hhid"]);
  // `c_sex`/`sex1` is the per-child sex on the members CSV; avoid the parent's sex_p1..sex_p15 roster cols.
  const sex = findColumn(headers, ["c_sex", "sex1", "sex"], ["sex_p", "sex_list", "sex_abriev"]);
  // Last-segment "age" picks the calculated age field; ignore years/mortality/approx variants.
  const age_months = findColumn(headers, ["age"], ["age_years", "age_mort", "age_months_approx", "age_under59"]);
  const child_name = findColumn(
    headers,
    ["child_name", "name"],
    ["facility", "otp_name", "settlement", "hoh_name", "instancename", "card_name", "first_name", "submittername", "formversion"]
  );
  const birthdate = findColumn(headers, ["birthdate", "dob"]);
  // Bare "muac" segment (the calculated cm value), not muac_measurement/_status/_valid.
  const muac = findColumn(headers, ["muac"], ["muac_measurement", "muac_status", "muac_valid", "wfh_lookup"]);
  // SMART uses `final_hl` (the resolved height/length after standing/recumbent logic);
  // older forms may use `hl` or `length`.
  const height = findColumn(
    headers,
    ["final_hl", "hl", "length", "height"],
    ["hl_measurement", "hl_rounded", "hl_hint", "hl_mismatch", "length_measurement", "length_rounded"]
  );
  // Final measured weight, not the raw caregiver/pt readings.
  const weight = findColumn(
    headers,
    ["weight"],
    ["weight_rounded", "cg_weight", "pt_weight", "ptonly_weight", "weightcheck", "invalidweight"]
  );
  // Bare oedema flag, not photo/check/status/valid.
  const oedema = findColumn(
    headers,
    ["c_oedema", "oedema", "edema"],
    ["oedema_status", "oedema_check", "oedema_photo", "oedema_valid"]
  );

  return {
    survey_date,
    cluster,
    team,
    hh_id,
    sex,
    age_months,
    child_name,
    test_name_value: "1000",
    birthdate,
    muac,
    muac_unit: "cm",
    weight,
    height,
    oedema,
  };
}

const KEY_PREFIX = "colmap:";
export const mappingKey = (pid: string | number, fid: string) => `${KEY_PREFIX}${pid}:${fid}`;

export function loadMapping(pid: string | number, fid: string): ColumnMapping | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(mappingKey(pid, fid));
  return raw ? (JSON.parse(raw) as ColumnMapping) : null;
}

export function saveMapping(pid: string | number, fid: string, m: ColumnMapping) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(mappingKey(pid, fid), JSON.stringify(m));
}

export function exportAllMappings(): string {
  if (typeof window === "undefined") return "{}";
  const out: Record<string, ColumnMapping> = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      out[k] = JSON.parse(window.localStorage.getItem(k)!);
    }
  }
  return JSON.stringify(out, null, 2);
}

export function importAllMappings(json: string) {
  if (typeof window === "undefined") return;
  const parsed = JSON.parse(json) as Record<string, ColumnMapping>;
  for (const [k, v] of Object.entries(parsed)) {
    if (k.startsWith(KEY_PREFIX)) {
      window.localStorage.setItem(k, JSON.stringify(v));
    }
  }
}
