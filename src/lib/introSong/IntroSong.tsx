"use client";

/**
 * Plays the intro song once, for the allowed authorizedIDs.
 *
 * Mounted once near the root. It renders nothing.
 *
 * ## Why it waits for a click
 *
 * Every current browser blocks audio autoplay until the page has received a user
 * gesture. A `.play()` fired on load rejects with `NotAllowedError` and, worse,
 * if the rejection were swallowed as "done" the song would never play at all. So
 * this attaches a one-shot listener for the first interaction of any kind —
 * click, touch, key, or scroll — and plays then. For anyone who has already
 * interacted with the app (a returning student tapping around) that feels
 * immediate; for a first-time visitor it waits for their first tap, which is the
 * only behaviour browsers permit.
 *
 * The `<audio>` element is kept mounted and visually hidden rather than created
 * on demand, so a 1.5 MB file has time to buffer while the user reads the page
 * and playback starts promptly when they finally touch something.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveRegNumber } from "@/lib/social/identity";
import {
  INTRO_SONG_SRC,
  INTRO_SONG_START_SECONDS,
  INTRO_SONG_ALLOWED_IDS,
  hasPlayedIntroSong,
  isAllowedIdentifier,
  markIntroSongPlayed,
} from "./gate";

/** Events that count as "the user has interacted with the page". */
const GESTURE_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Seek to the intro offset, clamped to something that can actually play.
 *
 * `duration` is only known once metadata has loaded, and seeking before then is
 * unreliable — so if the offset would land past the end (a shorter replacement
 * track, or metadata that has not arrived), start from 0 rather than seeking
 * into nothing and playing silence.
 */
function seekToOffset(audio: HTMLAudioElement): void {
  const offset = INTRO_SONG_START_SECONDS;
  const duration = audio.duration;
  if (Number.isFinite(duration) && duration > 0 && offset >= duration) {
    audio.currentTime = 0;
    return;
  }
  audio.currentTime = offset;
}

export default function IntroSong({ authorizedId }: { authorizedId?: string | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const doneRef = useRef(false);
  const [ready, setReady] = useState(false);
  /**
   * `localStorage` does not exist during SSR, so `getActiveRegNumber()` returns
   * "" on the server and the real reg number on the client. Rendering the
   * `<audio>` off that difference on the first client render mismatches the
   * server's output and React discards the whole tree. So nothing is rendered
   * until we know we are on the client.
   */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The reg number comes from the cached profile, so it is available before any
  // login — unlike `authorizedID`, which only exists once a session is up. Either
  // one being on the allowlist is enough.
  const regNumber = getActiveRegNumber();
  const allowed = isAllowedIdentifier(authorizedId, regNumber);

  // This feature is invisible by design: a non-allowlisted user gets no
  // <audio> element and no error. That is correct, but it also means a gate that
  // silently fails is indistinguishable from a browser blocking autoplay. One
  // line in the console separates the two.
  useEffect(() => {
    if (allowed || doneRef.current || ready) return;
    console.info(
      `[introSong] not playing — authorizedID=${JSON.stringify(authorizedId ?? "")} ` +
        `regNumber=${JSON.stringify(regNumber)} onAllowlist=${
          INTRO_SONG_ALLOWED_IDS.join("/")
        }`
    );
  }, [allowed, ready, authorizedId, regNumber]);

  // Decide once, as soon as we know who this is.
  useEffect(() => {
    if (!allowed) return;
    if (hasPlayedIntroSong(authorizedId, regNumber)) {
      doneRef.current = true;
      return;
    }
    setReady(true);
  }, [allowed, authorizedId, regNumber]);

  useEffect(() => {
    if (!ready || doneRef.current) return;

    let cancelled = false;

    const play = async () => {
      if (cancelled || doneRef.current) return;
      doneRef.current = true;
      detach();

      const audio = audioRef.current;
      if (!audio) return;
      seekToOffset(audio);
      try {
        await audio.play();
        // Flagged on SUCCESS, not on attempt. A refused play means the song was
        // never heard, and burning the flag would silently deny it forever.
        markIntroSongPlayed(authorizedId, regNumber);
      } catch {
        // Still blocked, or the file failed to decode. Leave the flag unset so
        // the next visit can try again rather than losing the song for good.
        doneRef.current = false;
      }
    };

    const onGesture = () => void play();
    function detach() {
      for (const ev of GESTURE_EVENTS) {
        window.removeEventListener(ev, onGesture);
      }
    }

    for (const ev of GESTURE_EVENTS) {
      // `once` per event is not enough on its own, because the flag is only
      // cleared on a rejected play, and the listener must then be re-armed.
      window.addEventListener(ev, onGesture, { passive: true });
    }

    return () => {
      cancelled = true;
      detach();
    };
  }, [ready, authorizedId, regNumber]);

  // A remote source can fail in ways a bundled file cannot - a dead link, a
  // network blip, a host that starts blocking programmatic media. Without this
  // the element just sits there silent, which is indistinguishable from "the
  // gate decided not to play".
  const handleError = useCallback(() => {
    const audio = audioRef.current;
    console.error("[introSong] the audio source failed to load", {
      src: INTRO_SONG_SRC.slice(0, 80) + "…",
      readyState: audio?.readyState,
      networkState: audio?.networkState,
      error: audio?.error?.message ?? null,
      code: audio?.error?.code ?? null,
    });
    // The flag is deliberately NOT set, so a transient failure does not burn the
    // one play the user is entitled to.
  }, []);

  // `mounted` is the first condition, not `allowed`: the server always reaches
  // the first client render with no audio, and only then can localStorage
  // decide anything.
  if (!mounted || !allowed) return null;

  return (
    <audio
      ref={audioRef}
      src={INTRO_SONG_SRC}
      preload="auto"
      onError={handleError}
      aria-hidden="true"
      className="hidden"
    />
  );
}
