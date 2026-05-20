import { cookies } from "next/headers";
import type { Session } from "./odk-client";

const COOKIE = "odk_session";

export async function readSession(): Promise<Session | null> {
  const c = await cookies();
  const raw = c.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

export async function writeSession(session: Session) {
  const c = await cookies();
  c.set(COOKIE, Buffer.from(JSON.stringify(session)).toString("base64"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}
