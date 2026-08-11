"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { signIn } from "@/app/auth-actions";
import { useI18n } from "@/lib/i18n/context";

export function LoginForm({
  code,
  scheduleName,
  needsFirstPassword,
}: {
  code: string;
  scheduleName: string;
  needsFirstPassword: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!password) return;
    setFailed(false);
    startTransition(async () => {
      const result = await signIn(code, password);
      if (result.ok) {
        setPassword("");
        // Refresh so the layout re-runs and picks up the new admin cookie.
        router.replace(`/s/${code}`);
        router.refresh();
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="page-title">{scheduleName}</h1>
      <p className="mt-1.5 text-base text-muted">
        {needsFirstPassword ? t.auth.setFirstPassword : t.auth.passwordPrompt}
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <label className="label" htmlFor="password">
            {t.auth.password}
          </label>
          <input
            id="password"
            type="password"
            autoFocus
            autoComplete="current-password"
            className="field"
            value={password}
            disabled={pending}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        {failed && (
          <p className="pill pill-danger">
            {needsFirstPassword ? t.auth.passwordTooShort : t.auth.wrongPassword}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || !password}
            onClick={submit}
          >
            {t.auth.signIn}
          </button>
          <Link href={`/s/${code}`} className="text-base text-muted underline underline-offset-2">
            {t.auth.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
