import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { exportSubmissions } from "@/lib/odk-client";

export async function GET(_req: Request, ctx: { params: Promise<{ pid: string; fid: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { pid, fid } = await ctx.params;
  try {
    const tables = await exportSubmissions(s, Number(pid), fid);
    return NextResponse.json(tables);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ODK error" },
      { status: 502 }
    );
  }
}
