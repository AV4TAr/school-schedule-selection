"use client";

import { useI18n } from "@/lib/i18n/context";

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className="py-4 text-center text-xs text-faint print:hidden">
      {t.footer.dedication}
    </footer>
  );
}
