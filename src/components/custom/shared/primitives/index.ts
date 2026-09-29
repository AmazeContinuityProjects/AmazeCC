/**
 * Page primitives.
 *
 * The app's page structure used to be copy-pasted per screen — nine copies of
 * the shell string, four section-header dialects, two local IconButtons, three
 * hand-rolled subpage state machines. These components are that structure,
 * written once.
 *
 * They deliberately do *not* live in `@amazecontinuityprojects/amazeui`: that
 * package's `PageHeader` / `SectionHeader` / `SubpageLayout` are still the older
 * gray + blue-band dialect, which is why every page rolled its own. These
 * speak the current zinc dialect and consume the surface tokens in
 * `@/lib/uiTokens`, so the whole app has one page rhythm.
 *
 * Migrating a page is a mechanical swap; nothing here is required.
 */
export { default as PageShell, type PageShellProps, type PageHeaderLayout } from "./PageShell";
export { default as TitleBlock, type TitleBlockProps, type TitleTag } from "./TitleBlock";
export { useSubpageStack, SubpageScreen, type SubpageStack, type SubpageStackOptions } from "./Subpage";
export { ListSkeleton } from "./ListSkeleton";
export { useCarousel, type CarouselState } from "./useCarousel";
export { useHorizontalSwipe, type HorizontalSwipe } from "./useHorizontalSwipe";
export { InsightCarousel, type InsightSlide } from "./InsightCarousel";
export { SectionHeader, StatTile, ListShell, ListRowText, KeyValue } from "./Surfaces";
export { IconButton, GhostButton, SegmentedControl, ChipTabs } from "./Controls";
export { ToneBadge, ToneDot, DotPill, ToneLegend, EmptyPanel, AvatarDot } from "./Feedback";
export { default as Switch, type SwitchProps } from "./Switch";
export { default as SettingRow, type SettingRowProps } from "./SettingRow";
export { default as ToggleRow } from "./ToggleRow";
export { default as SelectField, type SelectOption } from "./SelectField";
