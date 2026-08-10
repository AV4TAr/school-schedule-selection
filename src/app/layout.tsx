import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import { getUndoLabels } from "@/lib/db/undo";
import { LocaleProvider } from "@/lib/i18n/context";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "School Supervision Schedule",
  description:
    "Build and balance the weekly supervision rota from each person's availability.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME}>
      <head>
        {/* Applies the stored theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <LocaleProvider>
          <Nav undoLabels={getUndoLabels()} />
          <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
        </LocaleProvider>
      </body>
    </html>
  );
}
