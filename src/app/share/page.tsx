import { Suspense } from "react";
import ShareTargetView from "./ShareTargetView";

/**
 * Landing page for the Web Share Target.
 *
 * The manifest's `share_target` (GET) delivers whatever another app shared —
 * text, a link, a title — as query params here. The app is a static export,
 * so there is no runtime server to read them: the shell prerenders and the
 * params are read client-side (`useSearchParams` inside a Suspense boundary
 * — the only pattern that prerenders cleanly under `output: "export"`).
 */
export default function SharePage() {
  return (
    <Suspense>
      <ShareTargetView />
    </Suspense>
  );
}
