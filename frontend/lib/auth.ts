// Client-side loader for Google Identity Services. Loaded lazily (only when
// the Sign In modal actually opens) so the third-party script doesn't load
// on every page view. See specs/features/001-oauth-login/design.md.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export const oauthConfigured = {
  google: GOOGLE_CLIENT_ID.length > 0,
};

function loadScript(src: string, id: string): Promise<void> {
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

export async function getGoogleIdToken(): Promise<string> {
  if (!oauthConfigured.google) {
    throw new Error(
      "Google sign-in isn't configured yet. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (see specs/features/001-oauth-login/requirements.md).",
    );
  }
  await loadScript("https://accounts.google.com/gsi/client", "google-gsi");
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error("Google Identity Services failed to load"));
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => resolve(response.credential),
    });
    window.google.accounts.id.prompt();
    // If the One Tap prompt is dismissed/skipped without a credential, the
    // callback above never fires. A caller-visible timeout keeps the UI from
    // hanging forever in that case.
    setTimeout(() => reject(new Error("Google sign-in timed out")), 30000);
  });
}
