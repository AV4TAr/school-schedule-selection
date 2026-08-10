import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import { LocaleProvider } from "@/lib/i18n/context";

import "./globals.css";

export const metadata: Metadata = {
  title: "School Supervision Schedule",
  description:
    "Build and balance the weekly supervision rota from each person's availability.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <LocaleProvider>
          <Nav />
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
