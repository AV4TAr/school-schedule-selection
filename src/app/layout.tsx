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
    // suppressHydrationWarning is required, not cosmetic: the script below
    // deliberately rewrites `data-theme` before React hydrates, so the server's
    // "light" and the live DOM's "dark" will legitimately disagree for anyone
    // who picked a theme. Without this, React reports that as a mismatch.
    // It suppresses only this element's own attributes, not the whole tree.
    <html lang="en" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head suppressHydrationWarning>
        {/* Applies the stored theme before first paint, so there is no flash.
            The extra suppression here is for browser extensions, which commonly
            inject or rewrite scripts in <head> before React loads. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
