import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plausibility Report",
  description: "Generate ENA plausibility reports from ODK Central data",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
