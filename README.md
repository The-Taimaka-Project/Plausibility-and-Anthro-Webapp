# Plausibility & Anthropometry Webapp

A web app built for Taimaka's ODK workflow. It pulls anthropometric survey
submissions from ODK Central, computes WHO growth-standard z-scores, and
generates two reports used for SMART-style nutrition surveys:

1. A **plausibility report** — the data-quality check that mirrors ENA for
   SMART (flagged values, sex/age distribution, digit preference, standard
   deviation, skewness, kurtosis), each scored *excellent / good / acceptable /
   problematic*.
2. An **anthropometry report** — GAM / SAM / MAM prevalence tables with 95%
   confidence intervals, broken down by sex and age band.

Reports can be exported to **PDF** and **DOCX**.

As with the [standardization-test-webapp](https://github.com/The-Taimaka-Project/standardization-test-webapp),
the most reusable part of this repository is the **calculation logic** in
`src/lib`, which is independent of the ODK integration and the UI.

> **Scope (v1):** MUAC-only. Tables and report sections that require
> weight/height z-scores (WHZ/HAZ/WAZ) are scaffolded in the data structures
> but rendered as `—` until weight/height capture is added.

## Calculation logic

All statistics are pure functions with no external state, so they can be reused
outside this app:

| Module | Responsibility |
|---|---|
| `src/lib/who-standards.ts` + `src/lib/who-data/` | WHO 2006 growth standards (LMS tables): WFA, HFA, WFL, WFH, and WHZ/HAZ/WAZ z-scores |
| `src/lib/stats.ts` | Chi-square tests, digit-preference score, histograms, mean/SD/skewness/kurtosis |
| `src/lib/clean.ts` | Joins parent + member CSVs, applies the column mapping, normalizes records, attaches z-scores |
| `src/lib/report-engine.ts` | Builds the plausibility report (pure data) |
| `src/lib/anthro-report.ts` | Builds the GAM/SAM/MAM prevalence tables |
| `src/lib/column-mapping.ts` | Maps a form's columns to the canonical fields |

### Z-scores (LMS method)

WHO z-scores are computed from the LMS tables:

```
if L != 0:  z = ((value / M)^L - 1) / (L * S)
if L == 0:  z =  ln(value / M) / S
```

Extreme values use the WHO SD2/SD3 splice so the tails stay finite. For ages
6–59 months, weight-for-length (WFL) is used when age < 24 months and
weight-for-height (WFH) otherwise.

### MUAC cutoffs (WHO)

| Class | Definition |
|---|---|
| SAM (severe) | MUAC < 115 mm **and/or** oedema |
| MAM (moderate) | 115 mm ≤ MUAC < 125 mm, no oedema |
| GAM (global) | SAM + MAM |
| Normal | MUAC ≥ 125 mm, no oedema |

Prevalence confidence intervals use the Wilson 95% interval. (ENA SMART uses
cluster-adjusted CIs that incorporate the design effect; this is noted in the
report header.)

### Plausibility scoring

Each check is scored against SMART thresholds and rolled into an overall
quality band:

| Check | Excellent | Good | Acceptable | Problematic |
|---|---|---|---|---|
| % flagged values | ≤ 2.5% | ≤ 5% | ≤ 7.5% | > 7.5% |
| Distribution p-value | > 0.1 | > 0.05 | > 0.001 | ≤ 0.001 |
| Digit preference score | ≤ 7 | ≤ 12 | ≤ 20 | > 20 |
| WHZ standard deviation | 0.9–1.1 | 0.85–1.15 | 0.8–1.2 | outside 0.8–1.2 |
| Skewness / kurtosis | < ±0.2 | < ±0.4 | < ±0.6 | ≥ ±0.6 |

## ODK workflow

1. **Sign in** to your ODK Central server (`/sign-in`). Credentials are
   exchanged for a session token — see [Security](#security).
2. **Pick a project and form** (`/dashboard` → project → form). The app pulls
   submissions as CSV directly from ODK Central.
3. **Configure the column mapping** (`/dashboard/[pid]/[fid]/config`) so the
   form's fields map to the canonical record (sex, birthdate, MUAC, oedema, …).
4. **View the reports** — plausibility (`.../report`) and anthropometry
   (`.../anthro`) — then export to PDF or DOCX.

The `Reference/` folder contains the source materials this implementation was
built against: the ODK XLSForm, a sample cleaned dataset, the original ENA
report templates, and the R script (`single_day_survey_output_ena.R`) whose
cleaning logic `clean.ts` mirrors.

## Configuration

The sign-in page pre-fills the ODK Central server URL from an environment
variable so users don't have to type it:

```bash
cp .env.example .env.local
# then edit .env.local:
NEXT_PUBLIC_ODK_BASE_URL=https://your-odk-server.example.org
```

`.env.local` is gitignored and never committed. When deploying (e.g. Vercel),
set `NEXT_PUBLIC_ODK_BASE_URL` in the platform's environment settings.

## Development

```bash
npm install
npm run dev     # start the dev server (http://localhost:3000)
npm run build   # production build
npm run start   # serve the production build
npm run lint    # lint
```

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
Radix UI · Zustand (state) · PapaParse (CSV) · simple-statistics ·
JSZip (ODK export unzip) · @react-pdf/renderer (PDF) · docx (DOCX) · Recharts.

## Security

- ODK credentials are entered at runtime and **never stored in the repo or in
  code**. The password is exchanged for an ODK session token, which is held in
  an `httpOnly` cookie; the browser never sees the raw token.
- Real connection details live only in `.env.local` (gitignored).
- Do not commit `Reference/odk_creds.txt`, `.env*` (other than `.env.example`),
  or any `*.creds` / `*.credentials` files — these are excluded in
  `.gitignore`.
