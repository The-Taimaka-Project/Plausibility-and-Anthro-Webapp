import { NextResponse } from "next/server";
import { readSession, clearSession } from "@/lib/session";
import { odkLogout } from "@/lib/odk-client";

export async function POST() {
  const s = await readSession();
  if (s) await odkLogout(s);
  await clearSession();
  return NextResponse.json({ ok: true });
}
