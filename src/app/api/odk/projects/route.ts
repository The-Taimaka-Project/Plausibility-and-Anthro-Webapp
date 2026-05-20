import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { listProjects } from "@/lib/odk-client";

export async function GET() {
  const s = await readSession();
  if (!s) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  try {
    const projects = await listProjects(s);
    return NextResponse.json({ projects });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ODK error" },
      { status: 502 }
    );
  }
}
