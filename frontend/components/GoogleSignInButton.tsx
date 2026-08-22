"use client";

import { useEffect, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import { GOOGLE_CLIENT_ID, loadGoogleScript } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";

type GoogleSignInButtonProps = {
  onSignedIn: (user: AuthUser) => void;
  onError: (message: string) => void;
  onPendingChange?: (pending: boolean) => void;
  width?: number;
};

// Renders Google's own branded button rather than the silent One Tap
// prompt — see lib/auth.ts for why. Shared by the header Sign In modal and
// the #admin sign-in gate so both get the same reliability fix.
export function GoogleSignInButton({
  onSignedIn,
  onError,
  onPendingChange,
  width = 320,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function handleCredential(credential: string) {
      onPendingChange?.(true);
      try {
        onSignedIn(await api.signInWithGoogle(credential));
      } catch (err) {
        onError(
          err instanceof ApiError ? err.message : "Google sign-in failed",
        );
      } finally {
        onPendingChange?.(false);
      }
    }

    async function render() {
      try {
        await loadGoogleScript();
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            void handleCredential(response.credential);
          },
        });
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          width,
        });
      } catch {
        if (!cancelled) onError("Failed to load Google sign-in.");
      }
    }

    render();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  return <div ref={containerRef} />;
}
