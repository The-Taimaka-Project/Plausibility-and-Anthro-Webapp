import { NextResponse } from "next/server";
import { odkLogin } from "@/lib/odk-client";
import { writeSession } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    baseUrl?: string;
    email?: string;
    password?: string;
  };
  if (!body.baseUrl || !body.email || !body.password) {
    return NextResponse.json({ error: "Missing baseUrl, email, or password" }, { status: 400 });
  }
  try {
    const session = await odkLogin(body.baseUrl, body.email, body.password);
    await writeSession(session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
