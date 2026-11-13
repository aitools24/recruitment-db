import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentBase",
  description: "Candidate database for recruitment teams",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
