/**
 * Thin wrapper over the ODK Central REST API.
 * All calls run server-side; the browser never sees the session token.
 *
 * Reference endpoints (mirrors what ruODK uses):
 *   POST /v1/sessions                                  → { token }
 *   GET  /v1/projects
 *   GET  /v1/projects/:pid/forms
 *   GET  /v1/projects/:pid/forms/:fid/submissions.csv.zip?repeats=true
 */
import JSZip from "jszip";

export type Session = { baseUrl: string; token: string };

export type Project = { id: number; name: string };
export type Form = { xmlFormId: string; name: string; submissions?: number };

function withSlash(url: string) {
  return url.replace(/\/+$/, "");
}

export async function odkLogin(baseUrl: string, email: string, password: string): Promise<Session> {
  const url = `${withSlash(baseUrl)}/v1/sessions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`ODK login failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("ODK login: no token returned");
  return { baseUrl: withSlash(baseUrl), token: data.token };
}

export async function odkLogout(session: Session): Promise<void> {
  await fetch(`${session.baseUrl}/v1/sessions/${session.token}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${session.token}` },
    cache: "no-store",
  }).catch(() => {});
}

async function get<T>(session: Session, path: string): Promise<T> {
  const res = await fetch(`${session.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ODK GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export async function listProjects(session: Session): Promise<Project[]> {
  return get<Project[]>(session, `/v1/projects`);
}

export async function listForms(session: Session, pid: number): Promise<Form[]> {
  return get<Form[]>(session, `/v1/projects/${pid}/forms`);
}

export type SubmissionTables = { parent: string; members?: string; tables: Record<string, string> };

/**
 * Downloads the .csv.zip export for a form (with repeats) and returns the parent CSV
 * + the members (or any other repeat-group) CSVs as raw text.
 */
export async function exportSubmissions(
  session: Session,
  pid: number,
  fid: string
): Promise<SubmissionTables> {
  const url = `${session.baseUrl}/v1/projects/${pid}/forms/${encodeURIComponent(fid)}/submissions.csv.zip?attachments=false`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ODK export failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const tables: Record<string, string> = {};
  let parent: string | undefined;
  let members: string | undefined;
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir || !name.endsWith(".csv")) continue;
    const text = await entry.async("string");
    tables[name] = text;
    // Heuristic: parent CSV is named `<fid>.csv`; repeat-group CSVs are `<fid>-<group>.csv`.
    if (name === `${fid}.csv`) parent = text;
    else if (name.startsWith(`${fid}-`)) members = members ?? text;
  }
  if (!parent) {
    // Fallback: pick the CSV with no dash after fid.
    const keys = Object.keys(tables);
    parent = tables[keys[0]];
  }
  return { parent: parent!, members, tables };
}
