import type { Metadata } from "next";

import { LocaleProvider } from "@/lib/i18n/context";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "School Supervision Schedule",
  description:
    "Build and balance the weekly supervision rota from each person's availability.",
};

/**
 * Deliberately chrome-free: the landing page and each /s/[code] section bring
 * their own header, since a schedule's nav depends on a code this layout has
 * no access to.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME}>
      <head>
        {/* Applies the stored theme before first paint, so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
