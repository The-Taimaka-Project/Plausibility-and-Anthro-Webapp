/**
 * Joins parent + members CSVs, applies the column mapping, and produces normalized
 * ChildRecords ready for the report engine. Mirrors single_day_survey_output_ena.R.
 */
import Papa from "papaparse";
import type { ColumnMapping } from "./column-mapping";
import { haz, waz, whz } from "./who-standards";

export type ChildRecord = {
  survey_date: string; // ISO yyyy-mm-dd
  cluster: number | string;
  pair: string; // p01..p13
  id: number; // sequential within hh_id
  hh_id: number | string;
  sex: "male" | "female" | "other";
  birthdate: string | null;
  age_months: number | null;
  muac_mm: number | null; // millimetres
  weight_kg: number | null;
  height_cm: number | null;
  oedema: boolean | null;
  // Computed z-scores (null when inputs missing or out of WHO range)
  whz: number | null;
  haz: number | null;
  waz: number | null;
};

export function parseCsv(text: string): Record<string, string>[] {
  const out = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return out.data;
}

function leftJoin(
  members: Record<string, string>[],
  parent: Record<string, string>[]
): Record<string, string>[] {
  const idx = new Map<string, Record<string, string>>();
  for (const p of parent) {
    const key = p["KEY"];
    if (key) idx.set(key, p);
  }
  return members.map((m) => {
    const pk = m["PARENT_KEY"];
    const p = pk ? idx.get(pk) : undefined;
    return p ? { ...p, ...m } : { ...m };
  });
}

function normalizePair(raw: string | undefined): string {
  if (!raw) return "p00";
  const digits = raw.match(/\d+/)?.[0] ?? "0";
  return `p${digits.padStart(2, "0")}`;
}

function toIsoDate(raw: string | undefined): string {
  if (!raw) return "";
  // ODK Central dates are usually ISO already; strip time portion if present.
  return raw.slice(0, 10);
}

function parseNum(raw: string | undefined): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSex(raw: string | undefined): "male" | "female" | "other" {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "male" || v === "m" || v === "1") return "male";
  if (v === "female" || v === "f" || v === "2") return "female";
  return "other";
}

export type CleanOptions = {
  mapping: ColumnMapping;
  fromDate?: string; // ISO inclusive
  toDate?: string; // ISO inclusive
};

export function cleanSubmissions(
  parentCsv: string,
  membersCsv: string | undefined,
  opts: CleanOptions
): { headers: string[]; records: ChildRecord[] } {
  const parent = parseCsv(parentCsv);
  const members = membersCsv ? parseCsv(membersCsv) : parent; // MUAC-only forms may collapse — defensive default
  const headers = members[0] ? Object.keys(members[0]) : [];

  const joined = membersCsv ? leftJoin(members, parent) : parent;
  const m = opts.mapping;

  // Drop test rows
  const filtered = joined.filter((r) => {
    if (m.child_name && m.test_name_value) {
      const v = r[m.child_name];
      if (v !== undefined && String(v) === String(m.test_name_value)) return false;
    }
    // Drop rows without a survey_date
    if (!r[m.survey_date]) return false;
    const iso = toIsoDate(r[m.survey_date]);
    if (opts.fromDate && iso < opts.fromDate) return false;
    if (opts.toDate && iso > opts.toDate) return false;
    return true;
  });

  // Build records (without sequential id yet)
  const prelim = filtered.map((r) => {
    const muacRaw = m.muac ? parseNum(r[m.muac]) : null;
    const muac_mm = muacRaw === null ? null : m.muac_unit === "mm" ? muacRaw : Math.round(muacRaw * 10);
    return {
      survey_date: toIsoDate(r[m.survey_date]),
      cluster: r[m.cluster] ?? "",
      pair: normalizePair(r[m.team]),
      hh_id: r[m.hh_id] ?? "",
      sex: parseSex(r[m.sex]),
      birthdate: m.birthdate ? r[m.birthdate]?.slice(0, 10) || null : null,
      age_months: parseNum(r[m.age_months]),
      muac_mm,
      weight_kg: m.weight ? parseNum(r[m.weight]) : null,
      height_cm: m.height ? parseNum(r[m.height]) : null,
      oedema: m.oedema
        ? (() => {
            const v = (r[m.oedema] ?? "").toLowerCase();
            if (v === "true" || v === "yes" || v === "1") return true;
            if (v === "false" || v === "no" || v === "0") return false;
            return null;
          })()
        : null,
    };
  });

  // Sequential id per hh_id (within the cohort, preserving order), and z-scores.
  const seq = new Map<string, number>();
  const records: ChildRecord[] = prelim.map((r) => {
    const key = `${r.hh_id}`;
    const n = (seq.get(key) ?? 0) + 1;
    seq.set(key, n);
    // WHO z-scores only apply to a known sex; "other" gets null.
    const sex = r.sex === "male" || r.sex === "female" ? r.sex : null;
    const z_whz = sex && r.age_months !== null && r.height_cm !== null && r.weight_kg !== null
      ? whz(sex, r.age_months, r.height_cm, r.weight_kg)
      : null;
    const z_haz = sex && r.age_months !== null && r.height_cm !== null
      ? haz(sex, r.age_months, r.height_cm)
      : null;
    const z_waz = sex && r.age_months !== null && r.weight_kg !== null
      ? waz(sex, r.age_months, r.weight_kg)
      : null;
    return { ...r, id: n, whz: z_whz, haz: z_haz, waz: z_waz };
  });

  // Sort
  records.sort((a, b) => {
    if (a.survey_date !== b.survey_date) return a.survey_date < b.survey_date ? -1 : 1;
    const ca = Number(a.cluster), cb = Number(b.cluster);
    if (Number.isFinite(ca) && Number.isFinite(cb) && ca !== cb) return ca - cb;
    if (a.pair !== b.pair) return a.pair < b.pair ? -1 : 1;
    const ha = Number(a.hh_id), hb = Number(b.hh_id);
    if (Number.isFinite(ha) && Number.isFinite(hb) && ha !== hb) return ha - hb;
    return a.id - b.id;
  });

  return { headers, records };
}

export function toEnaCsv(records: ChildRecord[]): string {
  const header = ["survey_date", "cluster", "pair", "id", "hh_id", "sex", "birthdate", "age", "blank1", "blank2", "blank3", "muac"];
  const lines = [header.join(",")];
  for (const r of records) {
    lines.push([
      r.survey_date,
      r.cluster,
      r.pair,
      r.id,
      r.hh_id,
      r.sex,
      r.birthdate ?? "",
      r.age_months ?? "",
      "",
      "",
      "",
      r.muac_mm ?? "",
    ].join(","));
  }
  return lines.join("\n") + "\n";
}
