"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/odk/logout", { method: "POST" });
    router.push("/sign-in");
  }
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background no-print">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Activity className="h-4 w-4" />
            </span>
            Plausibility Report
          </Link>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
