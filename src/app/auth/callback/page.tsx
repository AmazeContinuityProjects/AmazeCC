"use client";

import { useEffect, useRef, useState } from "react";
import { handleCallback, signInInteractive } from "@/lib/oauth2";

/**
 * OIDC redirect target (registered as amazecc-web's redirect_uri).
 * Completes the PKCE exchange, then hands control back to the app.
 * ?error=login_required (silent prompt=none miss) lands here too - the page
 * then just sends the user back to the sign-in screen.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    handleCallback().then((result) => {
      if (result.ok) {
        window.location.replace("/");
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const isSilentMiss = params.get("error") === "login_required";
      setError(isSilentMiss ? null : (result.error ?? "Sign-in failed."));
      if (isSilentMiss) {
        window.location.replace("/");
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-5 text-center">
        <img src="/logo.png" alt="AmazeCC Logo" className="w-16 h-16 mx-auto object-contain drop-shadow-md" />
        {error ? (
          <>
            <h1 className="text-xl font-bold text-zinc-100">Sign-in didn&apos;t finish</h1>
            <p className="text-sm text-zinc-400">{error}</p>
            <button
              type="button"
              onClick={() => signInInteractive()}
              className="w-full h-11 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              Try again with Amaze ID
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-t-transparent border-indigo-500 mx-auto" />
            <p className="text-sm text-zinc-400">Finishing sign-in with Amaze ID…</p>
          </>
        )}
      </div>
    </div>
  );
}
