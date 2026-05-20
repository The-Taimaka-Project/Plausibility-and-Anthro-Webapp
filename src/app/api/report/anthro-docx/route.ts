import { NextResponse } from "next/server";
import { renderAnthroDocx } from "@/lib/anthro-docx";
import type { AnthroReport } from "@/lib/anthro-report";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const report = (await req.json()) as AnthroReport;
  const buf = await renderAnthroDocx(report);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=anthropometry_report.docx`,
    },
  });
}
