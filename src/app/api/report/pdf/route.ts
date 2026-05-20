import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ReportPdf } from "@/components/report-pdf";
import type { PlausibilityReport } from "@/lib/report-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const report = (await req.json()) as PlausibilityReport;
  // react-pdf's renderToBuffer expects a Document element; the type signature is narrow,
  // so we cast through unknown.
  const element = React.createElement(ReportPdf, { report });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(element as any);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=plausibility_report.pdf`,
    },
  });
}
