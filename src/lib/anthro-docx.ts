/**
 * Generates a well-formatted Word document for the anthropometry report.
 * Mirrors the structure of the on-screen tables.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
  type ITableCellOptions,
} from "docx";
import type {
  AnthroReport,
  PrevalenceBySexTable,
  PrevalenceCell,
  WhzMatrixRow,
} from "./anthro-report";

const BORDER: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const HEADER_SHADING = { type: ShadingType.CLEAR, fill: "F1F5F9", color: "auto" };
const TOTAL_SHADING = { type: ShadingType.CLEAR, fill: "FAFAFA", color: "auto" };

function fmt(n: number, d = 1) {
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function prevText(c: PrevalenceCell): string {
  if (c.n === 0) return "—";
  return `(${c.count}) ${fmt(c.pct, 1)}%  ${fmt(c.ci95[0], 1)}–${fmt(c.ci95[1], 1)} 95% CI`;
}
function p(text: string, opts: { bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 18 })],
  });
}
type CellOpts = {
  header?: boolean;
  total?: boolean;
  bold?: boolean;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  rowSpan?: number;
  columnSpan?: number;
};
function cell(text: string, opts: CellOpts = {}): TableCell {
  const cellOpts: ITableCellOptions = {
    borders: ALL_BORDERS,
    children: [p(text, { bold: opts.header || opts.bold, align: opts.align ?? AlignmentType.LEFT })],
    rowSpan: opts.rowSpan,
    columnSpan: opts.columnSpan,
    shading: opts.header ? HEADER_SHADING : opts.total ? TOTAL_SHADING : undefined,
  };
  return new TableCell(cellOpts);
}
function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    children: [new TextRun({ text })],
    spacing: { before: 240, after: 120 },
  });
}
function tableTitle(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22 })],
    spacing: { before: 200, after: 80 },
  });
}
function note(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 16, color: "555555" })],
    spacing: { after: 120 },
  });
}

/* ---------- generic table builders ---------- */

function prevSexTable(
  data: PrevalenceBySexTable,
  labels: { global: string; moderate: string; severe: string },
  hideModerate = false
): Table {
  const head = new TableRow({
    children: [
      cell("", { header: true }),
      cell(`All (n=${data.global.all.n})`, { header: true, align: AlignmentType.CENTER }),
      cell(`Boys (n=${data.global.boys.n})`, { header: true, align: AlignmentType.CENTER }),
      cell(`Girls (n=${data.global.girls.n})`, { header: true, align: AlignmentType.CENTER }),
    ],
  });
  const make = (label: string, c: { all: PrevalenceCell; boys: PrevalenceCell; girls: PrevalenceCell }) =>
    new TableRow({
      children: [
        cell(label, { bold: true }),
        cell(prevText(c.all), { align: AlignmentType.CENTER }),
        cell(prevText(c.boys), { align: AlignmentType.CENTER }),
        cell(prevText(c.girls), { align: AlignmentType.CENTER }),
      ],
    });
  const rows = [head, make(labels.global, data.global)];
  if (!hideModerate) rows.push(make(labels.moderate, data.moderate));
  rows.push(make(labels.severe, data.severe));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function byAgeTable(
  rows: WhzMatrixRow[],
  totals: WhzMatrixRow,
  labels: { severe: string; moderate: string; normal: string },
  showOedema = true
): Table {
  const nCols = showOedema ? 4 : 3;
  const head1Children = [
    cell("Age (mo)", { header: true, rowSpan: 2, align: AlignmentType.CENTER }),
    cell("Total", { header: true, rowSpan: 2, align: AlignmentType.CENTER }),
    cell(labels.severe, { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
    cell(labels.moderate, { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
    cell(labels.normal, { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
  ];
  if (showOedema) head1Children.push(cell("Oedema", { header: true, columnSpan: 2, align: AlignmentType.CENTER }));
  const head1 = new TableRow({ children: head1Children });
  const head2Children = [];
  for (let i = 0; i < nCols; i++) {
    head2Children.push(cell("n", { header: true, align: AlignmentType.CENTER }));
    head2Children.push(cell("%", { header: true, align: AlignmentType.CENTER }));
  }
  const head2 = new TableRow({ children: head2Children });
  const tableRows = rows.map((r) => {
    const ch = [
      cell(r.ageBand),
      cell(String(r.total), { align: AlignmentType.RIGHT }),
      cell(String(r.severe.n), { align: AlignmentType.RIGHT }),
      cell(fmt(r.severe.pct), { align: AlignmentType.RIGHT }),
      cell(String(r.moderate.n), { align: AlignmentType.RIGHT }),
      cell(fmt(r.moderate.pct), { align: AlignmentType.RIGHT }),
      cell(String(r.normal.n), { align: AlignmentType.RIGHT }),
      cell(fmt(r.normal.pct), { align: AlignmentType.RIGHT }),
    ];
    if (showOedema) {
      ch.push(cell(String(r.oedema.n), { align: AlignmentType.RIGHT }));
      ch.push(cell(fmt(r.oedema.pct), { align: AlignmentType.RIGHT }));
    }
    return new TableRow({ children: ch });
  });
  const tCh = [
    cell(totals.ageBand, { bold: true, total: true }),
    cell(String(totals.total), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(String(totals.severe.n), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(fmt(totals.severe.pct), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(String(totals.moderate.n), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(fmt(totals.moderate.pct), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(String(totals.normal.n), { bold: true, total: true, align: AlignmentType.RIGHT }),
    cell(fmt(totals.normal.pct), { bold: true, total: true, align: AlignmentType.RIGHT }),
  ];
  if (showOedema) {
    tCh.push(cell(String(totals.oedema.n), { bold: true, total: true, align: AlignmentType.RIGHT }));
    tCh.push(cell(fmt(totals.oedema.pct), { bold: true, total: true, align: AlignmentType.RIGHT }));
  }
  const totalRow = new TableRow({ children: tCh });
  return new Table({ rows: [head1, head2, ...tableRows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE } });
}

/* ---------- Specific table builders ---------- */

function table31(r: AnthroReport): Table {
  const head1 = new TableRow({
    children: [
      cell("Age (mo)", { header: true, rowSpan: 2, align: AlignmentType.CENTER }),
      cell("Boys", { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
      cell("Girls", { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
      cell("Total", { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
      cell("Ratio b:g", { header: true, rowSpan: 2, align: AlignmentType.CENTER }),
    ],
  });
  const head2 = new TableRow({
    children: ["n", "%", "n", "%", "n", "%"].map((s) =>
      cell(s, { header: true, align: AlignmentType.CENTER })
    ),
  });
  const rows = r.sample.rows.map(
    (row) =>
      new TableRow({
        children: [
          cell(row.ageBand),
          cell(String(row.boys), { align: AlignmentType.RIGHT }),
          cell(fmt(row.boysPct), { align: AlignmentType.RIGHT }),
          cell(String(row.girls), { align: AlignmentType.RIGHT }),
          cell(fmt(row.girlsPct), { align: AlignmentType.RIGHT }),
          cell(String(row.total), { align: AlignmentType.RIGHT }),
          cell(fmt(row.totalPct), { align: AlignmentType.RIGHT }),
          cell(row.ratioBoyGirl !== null ? fmt(row.ratioBoyGirl, 1) : "—", { align: AlignmentType.RIGHT }),
        ],
      })
  );
  const t = r.sample.totals;
  const totalRow = new TableRow({
    children: [
      cell(t.ageBand, { bold: true, total: true }),
      cell(String(t.boys), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(fmt(t.boysPct), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(String(t.girls), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(fmt(t.girlsPct), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(String(t.total), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(fmt(t.totalPct), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(t.ratioBoyGirl !== null ? fmt(t.ratioBoyGirl, 1) : "—", { bold: true, total: true, align: AlignmentType.RIGHT }),
    ],
  });
  return new Table({ rows: [head1, head2, ...rows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function table34(r: AnthroReport): Table {
  const head = new TableRow({
    children: [
      cell("", { header: true }),
      cell("WHZ < -3", { header: true, align: AlignmentType.CENTER }),
      cell("WHZ ≥ -3", { header: true, align: AlignmentType.CENTER }),
    ],
  });
  const rows = r.whzOedemaMatrix.map((row) => {
    const label = row.bilateralOedemaPresent ? "Bilateral oedema present" : "Bilateral oedema absent";
    const sevLabel = row.bilateralOedemaPresent ? "Marasmic kwashiorkor" : "Marasmic";
    const norLabel = row.bilateralOedemaPresent ? "Kwashiorkor" : "Not severely malnourished";
    return new TableRow({
      children: [
        cell(label, { bold: true }),
        cell(`${sevLabel} — ${row.belowMinus3} (${fmt(row.belowMinus3Pct)}%)`),
        cell(`${norLabel} — ${row.atOrAboveMinus3} (${fmt(row.atOrAboveMinus3Pct)}%)`),
      ],
    });
  });
  return new Table({ rows: [head, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function table38(r: AnthroReport): Table {
  const head1 = new TableRow({
    children: [
      cell("Source", { header: true, rowSpan: 2, align: AlignmentType.CENTER }),
      cell("GAM", { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
      cell("SAM", { header: true, columnSpan: 2, align: AlignmentType.CENTER }),
    ],
  });
  const head2 = new TableRow({
    children: ["n", "%", "n", "%"].map((s) => cell(s, { header: true, align: AlignmentType.CENTER })),
  });
  const rows = r.combinedDetail.rows.map(
    (row) =>
      new TableRow({
        children: [
          cell(row.source, { bold: true }),
          cell(String(row.gam.n), { align: AlignmentType.RIGHT }),
          cell(fmt(row.gam.pct), { align: AlignmentType.RIGHT }),
          cell(String(row.sam.n), { align: AlignmentType.RIGHT }),
          cell(fmt(row.sam.pct), { align: AlignmentType.RIGHT }),
        ],
      })
  );
  const t = r.combinedDetail.total;
  const totalRow = new TableRow({
    children: [
      cell(t.source, { bold: true, total: true }),
      cell(String(t.gam.n), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(fmt(t.gam.pct), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(String(t.sam.n), { bold: true, total: true, align: AlignmentType.RIGHT }),
      cell(fmt(t.sam.pct), { bold: true, total: true, align: AlignmentType.RIGHT }),
    ],
  });
  return new Table({ rows: [head1, head2, ...rows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE } });
}

function table315(r: AnthroReport): Table {
  const head = new TableRow({
    children: [
      "Indicator", "n", "Mean ± SD", "Skewness", "Kurtosis", "Excluded",
    ].map((s) => cell(s, { header: true, align: s === "Indicator" ? AlignmentType.LEFT : AlignmentType.CENTER })),
  });
  const make = (label: string, v: AnthroReport["meanZScores"]["WHZ"]) => {
    const cellNum = (n: number | null, d = 2) => (n === null ? "—" : n.toFixed(d));
    return new TableRow({
      children: [
        cell(label, { bold: true }),
        cell(String(v.n), { align: AlignmentType.RIGHT }),
        cell(`${cellNum(v.mean)} ± ${cellNum(v.sd)}`, { align: AlignmentType.CENTER }),
        cell(cellNum(v.skewness), { align: AlignmentType.RIGHT }),
        cell(cellNum(v.kurtosis), { align: AlignmentType.RIGHT }),
        cell(String(v.excluded), { align: AlignmentType.RIGHT }),
      ],
    });
  };
  const dataRows = (["WHZ", "WAZ", "HAZ"] as const)
    .filter((k) => r.meanZScores[k].n > 0)
    .map((k) => make(k, r.meanZScores[k]));
  return new Table({
    rows: [head, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/* ---------- assemble document ---------- */

export async function renderAnthroDocx(report: AnthroReport): Promise<Buffer> {
  const dateRange =
    report.meta.fromDate === report.meta.toDate
      ? report.meta.fromDate
      : `${report.meta.fromDate} to ${report.meta.toDate}`;

  const hasMuac = report.meta.n_muac > 0;
  const hasWhz = report.meta.n_whz > 0;
  const hasWaz = report.meta.n_waz > 0;
  const hasHaz = report.meta.n_haz > 0;
  const coverageParts = [
    hasMuac ? `n with MUAC: ${report.meta.n_muac}` : null,
    hasWhz ? `n with WHZ: ${report.meta.n_whz}` : null,
    hasWaz ? `n with WAZ: ${report.meta.n_waz}` : null,
    hasHaz ? `n with HAZ: ${report.meta.n_haz}` : null,
  ].filter(Boolean) as string[];

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Anthropometry Report", bold: true })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Survey period: `, bold: true }),
              new TextRun({ text: dateRange }),
              new TextRun({ text: `   ·   Reference: `, bold: true }),
              new TextRun({ text: report.meta.referenceStandard }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: coverageParts.flatMap((part, i) => {
              const sep = i > 0 ? [new TextRun({ text: "   ·   " })] : [];
              return [...sep, new TextRun({ text: part })];
            }),
            spacing: { after: 60 },
          }),
          note(`Confidence intervals: ${report.meta.ciMethod}. ENA SMART uses cluster-adjusted CIs that may be wider when intra-cluster correlation is high.`),
          note(`WHO biological-plausibility flags applied (WHZ |z|>5, HAZ |z|>6, WAZ z<-6 or >5).`),

          heading("3.1 Sample distribution by age and sex", HeadingLevel.HEADING_2),
          tableTitle("Table 3.1 — Distribution of age and sex of sample"),
          table31(report),

          ...(hasWhz ? [
            heading("3.2 Acute malnutrition by weight-for-height z-score", HeadingLevel.HEADING_2),
            tableTitle("Table 3.2 — Prevalence based on WHZ and/or oedema, by sex"),
            prevSexTable(report.prevalenceByWhzSex, {
              global: "Global (WHZ < -2 and/or oedema)",
              moderate: "Moderate (WHZ < -2 and ≥ -3, no oedema)",
              severe: "Severe (WHZ < -3 and/or oedema)",
            }),

            tableTitle("Table 3.3 — Prevalence by age, based on WHZ"),
            byAgeTable(report.prevalenceByWhzAge.rows, report.prevalenceByWhzAge.totals, {
              severe: "Severe (<-3)", moderate: "Moderate (-3 ≤ z < -2)", normal: "Normal (≥ -2)",
            }),

            tableTitle("Table 3.4 — WHZ × bilateral oedema"),
            table34(report),
          ] : []),

          ...(hasMuac ? [
            heading("3.5 Acute malnutrition by MUAC", HeadingLevel.HEADING_2),
            tableTitle("Table 3.5 — Prevalence based on MUAC cutoffs and/or oedema, by sex"),
            prevSexTable(report.prevalenceByMuacSex, {
              global: "Global (<125 mm and/or oedema)",
              moderate: "Moderate (115–<125 mm, no oedema)",
              severe: "Severe (<115 mm and/or oedema)",
            }),

            tableTitle("Table 3.6 — Prevalence by age, based on MUAC cutoffs and/or oedema"),
            byAgeTable(report.prevalenceByMuacAge.rows, report.prevalenceByMuacAge.totals, {
              severe: "Severe (<115)", moderate: "Moderate (115–<125)", normal: "Normal (≥125)",
            }),
          ] : []),

          ...(hasMuac || hasWhz ? [
            heading("3.7 Combined GAM and SAM", HeadingLevel.HEADING_2),
            tableTitle("Table 3.7 — Combined (WHZ ∪ MUAC ∪ oedema) prevalence by sex"),
            prevSexTable(report.combinedGamSamBySex, {
              global: "Combined GAM",
              moderate: "(moderate, not reported)",
              severe: "Combined SAM",
            }, true),

            tableTitle("Table 3.8 — Detailed numbers for combined GAM and SAM"),
            table38(report),
          ] : []),

          ...(hasWaz ? [
            heading("3.9 Underweight (WAZ)", HeadingLevel.HEADING_2),
            tableTitle("Table 3.9 — Prevalence of underweight by WAZ and sex"),
            prevSexTable(report.prevalenceByWazSex, {
              global: "Underweight (WAZ < -2)",
              moderate: "Moderate (-3 ≤ WAZ < -2)",
              severe: "Severe (WAZ < -3)",
            }),

            tableTitle("Table 3.10 — Underweight by age (WAZ)"),
            byAgeTable(report.prevalenceByWazAge.rows, report.prevalenceByWazAge.totals, {
              severe: "Severe (<-3)", moderate: "Moderate (-3 ≤ z < -2)", normal: "Normal (≥ -2)",
            }),
          ] : []),

          ...(hasHaz ? [
            heading("3.11 Stunting (HAZ)", HeadingLevel.HEADING_2),
            tableTitle("Table 3.11 — Prevalence of stunting by HAZ and sex"),
            prevSexTable(report.prevalenceByHazSex, {
              global: "Stunting (HAZ < -2)",
              moderate: "Moderate (-3 ≤ HAZ < -2)",
              severe: "Severe (HAZ < -3)",
            }),

            tableTitle("Table 3.12 — Stunting by age (HAZ)"),
            byAgeTable(report.prevalenceByHazAge.rows, report.prevalenceByHazAge.totals, {
              severe: "Severe (<-3)", moderate: "Moderate (-3 ≤ z < -2)", normal: "Normal (≥ -2)",
            }, false),
          ] : []),

          ...(hasWhz ? [
            heading("3.13 Overweight", HeadingLevel.HEADING_2),
            tableTitle("Table 3.13 — Overweight by WHZ and sex (no oedema)"),
            prevSexTable(report.overweightBySex, {
              global: "Overweight (WHZ > 2)",
              moderate: "Moderate (2 < WHZ ≤ 3)",
              severe: "Severe (WHZ > 3)",
            }),

            tableTitle("Table 3.14 — Overweight by age (WHZ, no oedema)"),
            byAgeTable(report.overweightByAge.rows, report.overweightByAge.totals, {
              severe: "Severe (>3)", moderate: "Moderate (>2, ≤3)", normal: "Normal (≤2)",
            }, false),
          ] : []),

          ...(hasWhz || hasWaz || hasHaz ? [
            heading("3.15 Mean z-scores", HeadingLevel.HEADING_2),
            tableTitle("Table 3.15 — Mean z-scores (SMART exclusion: observed mean ± 3 SD)"),
            table315(report),
          ] : []),

          new Paragraph({
            spacing: { before: 240 },
            children: [
              new TextRun({
                text: `Generated by the Taimaka plausibility webapp. Total population: ${report.meta.n_muac}.`,
                italics: true,
                color: "777777",
                size: 16,
              }),
            ],
          }),
        ],
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return buf;
}
