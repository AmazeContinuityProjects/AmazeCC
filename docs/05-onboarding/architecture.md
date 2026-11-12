# Onboarding — Architecture

Gate: `showIntroAtom` (one-time) — the flow shows only on first authenticated visit; `introPhase` state machine ("login" → "synced" → "welcome") lives in AppIntroExperience + OnboardingIntro.
Interface picker flips `interfaceChosen` — drives mobile home rendering.
