import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { listForms } from "@/lib/odk-client";

export async function GET(_req: Request, ctx: { params: Promise<{ pid: string }> }) {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { pid } = await ctx.params;
  try {
    const forms = await listForms(s, Number(pid));
    return NextResponse.json({ forms });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ODK error" },
      { status: 502 }
    );
  }
}
