// Client-side loader for Google Identity Services. Loaded lazily (only when
// a sign-in surface actually mounts) so the third-party script doesn't load
// on every page view. See specs/features/001-oauth-login/design.md.
//
// Renders Google's own "Sign in with Google" button (accounts.id.renderButton)
// rather than relying solely on the silent One Tap prompt
// (accounts.id.prompt()) — One Tap depends on the browser being able to
// silently detect an existing Google session (via FedCM / third-party
// cookies), which a growing number of real-world browser configurations
// block, leaving prompt() showing nothing and the caller waiting on a
// credential that never arrives. The rendered button is a direct user
// gesture instead, so it isn't subject to that silent-detection failure
// mode. Both paths funnel into the exact same `initialize()` callback and
// produce the exact same ID token, so the backend verification code
// (app/services/oauth.py) needed no changes.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const oauthConfigured = {
  google: GOOGLE_CLIENT_ID.length > 0,
};

export function loadGoogleScript(): Promise<void> {
  const src = "https://accounts.google.com/gsi/client";
  const id = "google-gsi";
  if (typeof document === "undefined") return Promise.resolve();
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}
