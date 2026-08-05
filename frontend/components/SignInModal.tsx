"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getGoogleIdToken, oauthConfigured } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

const DUMMY_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

type SignInModalProps = {
  open: boolean;
  onClose: () => void;
  onSignedIn: (user: AuthUser) => void;
};

export function SignInModal({ open, onClose, onSignedIn }: SignInModalProps) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (!open) return null;

  async function handleGoogle() {
    setPending(true);
    setError("");
    try {
      const idToken = await getGoogleIdToken();
      const user = await api.signInWithGoogle(idToken);
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setPending(false);
    }
  }

  async function handleDummy(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      onSignedIn(await api.signInDummy(username, password));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid credentials"
          : "Dummy login failed",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-modal-backdrop"
      />
      <div className="fixed top-1/2 left-1/2 z-[201] w-[min(400px,90vw)] -translate-x-1/2 -translate-y-1/2 max-h-[90vh] overflow-y-auto rounded-3xl bg-card p-[clamp(28px,4vw,36px)] shadow-[0_24px_60px_oklch(21%_0.03_155_/_0.25)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="m-0 font-display text-[22px] font-extrabold">
            Sign In
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-1 text-[22px] leading-none text-muted-2"
          >
            ×
          </button>
        </div>
        <p className="m-0 mb-5 text-sm leading-[1.6] text-muted-2">
          Quick sign-in confirms who&apos;s submitting proof — no separate
          password or email form to fill out.
        </p>

        {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={pending}
            className="cursor-pointer rounded-full border-none bg-ink py-3.5 text-[15px] font-bold text-ink-fg disabled:opacity-60"
          >
            Continue with Google
          </button>
        </div>

        {!oauthConfigured.google && (
          <p className="mt-4 mb-0 text-xs leading-[1.5] text-muted-3 italic">
            OAuth isn&apos;t fully configured in this environment yet — set
            NEXT_PUBLIC_GOOGLE_CLIENT_ID (see
            specs/features/001-oauth-login/requirements.md).
          </p>
        )}

        {DUMMY_LOGIN_ENABLED && (
          <form
            onSubmit={handleDummy}
            className="mt-6 flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong p-5"
          >
            <p className="m-0 text-xs font-bold text-muted-2 uppercase">
              Local dev only
            </p>
            <p className="m-0 text-xs leading-[1.5] text-muted-2">
              Sign in as admin (username <code>dummy_user</code>) or as an
              approved donor/volunteer using the username shown on their
              dashboard — same password either way.
            </p>
            <label className={labelClass}>
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="dummy_user"
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="dummy_password"
                className={fieldClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-full border-none bg-[var(--accent-amber)] py-3 text-sm font-bold text-ink disabled:opacity-60"
            >
              Dummy Login
            </button>
          </form>
        )}
      </div>
    </>
  );
}
