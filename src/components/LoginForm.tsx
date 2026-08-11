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
    <div className="mx-auto max-w-sm py-4 md:py-10">
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
            // Setting the very first password is a new one, not the saved one:
            // asking for `current-password` there makes a phone offer the wrong
            // suggestion instead of generating a strong password.
            autoComplete={needsFirstPassword ? "new-password" : "current-password"}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto"
            disabled={pending || !password}
            onClick={submit}
          >
            {t.auth.signIn}
          </button>
          <Link
            href={`/s/${code}`}
            className="py-1 text-center text-base text-muted underline underline-offset-2 sm:py-0 sm:text-left"
          >
            {t.auth.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
