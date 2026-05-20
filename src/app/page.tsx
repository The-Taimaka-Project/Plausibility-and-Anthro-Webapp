import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function HomePage() {
  const c = await cookies();
  if (c.get("odk_session")) redirect("/dashboard");
  redirect("/sign-in");
}
