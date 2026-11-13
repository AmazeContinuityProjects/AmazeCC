# Settings & Profile — Known Issues (full)

1. **Forget credentials doesn't forget data** (by design) — users expecting a nuke are surprised; the sheet says so.
2. **Theme switch cost** — full remount of styled tree; animation disables by `useThemeTransition`; on low-end phones flicker ~200 ms.
3. **Palette on midnight theme** — accent contrast check runs at selection time; some accents rejected on-device but allowed on OLED black panels — honest visual warning, not a bug.
4. **API host pokes prod** — swapping to backup/restore mid-sync unwinds all in-flight requests; banner warns "reliability may drop".
5. **Credit visibility** — the 20+ open-source licenses in About — many people hit it by accident from the 3-line button; intended discovery.
