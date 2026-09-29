"use client";

import { AnimatePresence } from "framer-motion";
import {
  Globe,
  Instagram,
  MessageCircle,
  Link as LinkIcon,
  User,
  Calendar,
  Star,
  Phone,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { cn } from "@amazecontinuityprojects/amazeui";
import { TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import BottomSheet from "../shared/BottomSheet";
import { SectionHeader } from "../shared/primitives";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A club's full profile, in a sheet.
 *
 * Two notes on what changed and what deliberately did not:
 *
 *  - The club's own brand colour survives in exactly two places — the rule
 *    beside its mission, and the year chip on its past events. Those are the
 *    spots where the colour *is* the information. It no longer drives headings,
 *    links or pills, which is what made the sheet fight the app's zinc dialect.
 *  - The sheet provides its own close button, so the duplicate `X` that used to
 *    sit on top of the header is gone.
 *
 * The prose is still prose: this copy is written by club representatives in
 * Markdown, so it needs real list/heading/table rendering. `prose-zinc` keeps
 * that rendering in the house palette rather than the default gray one.
 */
const MARKDOWN =
  "prose prose-sm prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 prose-headings:font-outfit prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-500 dark:prose-a:text-indigo-400 prose-img:rounded-xl";

interface ClubDetailsModalProps {
  club: any;
  isOpen: boolean;
  onClose: () => void;
}

const LINKS = [
  { key: "website", label: "Website", icon: Globe, tone: "sky" },
  { key: "instagram", label: "Instagram", icon: Instagram, tone: "violet" },
  { key: "whatsapp", label: "WhatsApp Group", icon: MessageCircle, tone: "emerald" },
  { key: "recruitment_link", label: "Recruitment Link", icon: LinkIcon, tone: "amber" },
] as const;

/** Instagram is stored bare (`@handle`) as often as it is a full URL. */
const instagramUrl = (value: string) =>
  value.startsWith("http") ? value : `https://instagram.com/${value.replace("@", "")}`;

/** Indian mobile numbers are dialled with the country code, not as bare digits. */
const whatsappUrl = (value: string) => {
  const digits = String(value).replace(/\D/g, "");
  return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
};

export default function ClubDetailsModal({ club, isOpen, onClose }: ClubDetailsModalProps) {
  const [landingPage, setLandingPage] = useState<any>(null);
  const [loadingLp, setLoadingLp] = useState(false);

  // Sheet registers itself for system back via BottomSheet.

  useEffect(() => {
    if (isOpen && club?.club_id) {
      setLoadingLp(true);
      api(`club-admin/landing-page?club_id=${club.club_id}`)
        .then((data: any) => {
          if (data.success && data.landingPage) {
            setLandingPage(data.landingPage);
          } else {
            setLandingPage(null);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingLp(false));
    }
  }, [isOpen, club]);

  if (!club) return null;

  // The club's own colour, used only as an accent. See the note above.
  const accent = landingPage?.theme?.primary_color;
  const links = LINKS.filter((l) => club[l.key]);
  const pocName = club.poc_name || club.poc || "Club Representative";

  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet onClose={onClose} overlayId="club-details" maxWidth="max-w-2xl">
          <div className="space-y-6 text-left">
            {/* Header */}
            <div className={cn(TILE_CARD, "flex items-center gap-4")}>
              {club.logo_url ? (
                <img
                  src={club.logo_url}
                  alt={`${club.club_name} logo`}
                  className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-zinc-200/70 dark:border-zinc-800/80"
                />
              ) : (
                <span className="w-14 h-14 rounded-2xl shrink-0 border bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-zinc-900 dark:text-white font-outfit tracking-tight leading-tight">
                  {club.club_name}
                </h2>
                {club.club_id && (
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 font-outfit mt-0.5 break-words">
                    {club.club_id}
                  </p>
                )}
              </div>
            </div>

            {loadingLp && (
              <div className="flex items-center justify-center py-6">
                <div
                  className="animate-spin rounded-full h-7 w-7 border-b-2 border-zinc-300 dark:border-zinc-700"
                  style={accent ? { borderColor: accent } : undefined}
                />
              </div>
            )}

            {/* Mission */}
            {club.mission && (
              <div className="space-y-2">
                <SectionHeader icon={Star} title="Our Mission" />
                <blockquote
                  className="border-l-2 pl-4 py-1 text-[13px] italic text-zinc-700 dark:text-zinc-200 leading-relaxed"
                  style={accent ? { borderColor: accent } : undefined}
                >
                  "{club.mission}"
                </blockquote>
              </div>
            )}

            {/* About */}
            {(club.description || (!club.mission && !club.description && !club.hiring_process)) && (
              <div className="space-y-2">
                <SectionHeader icon={User} title="About Us" />
                <div className={cn(TILE_CARD, MARKDOWN)}>
                  {club.description ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{club.description}</ReactMarkdown>
                  ) : (
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      No detailed description provided.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Showcase projects */}
            {landingPage?.showcase_projects?.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={Star} title="Showcase Projects" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {landingPage.showcase_projects.map((proj: any, i: number) => (
                    <div key={i} className={cn(TILE_CARD, "group")}>
                      {proj.image_url && (
                        <div className="-mx-4 -mt-4 sm:-mx-5 sm:-mt-5 mb-4 h-32 overflow-hidden rounded-t-[20px] bg-zinc-100 dark:bg-zinc-800">
                          <img
                            src={proj.image_url}
                            alt={proj.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white font-outfit leading-tight">
                        {proj.title}
                      </h4>
                      {proj.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1 leading-snug">
                          {proj.description}
                        </p>
                      )}
                      {proj.link && (
                        <a
                          href={proj.link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View Project
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular events */}
            {landingPage?.popular_events?.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={Calendar} title="Popular Events" />
                <div className="space-y-2">
                  {landingPage.popular_events.map((ev: any, i: number) => (
                    <div key={i} className={cn(TILE_CARD, "flex items-center gap-3.5")}>
                      <div
                        className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-white font-black text-sm font-outfit"
                        style={{ backgroundColor: accent || undefined }}
                      >
                        {ev.year?.slice(-2) || "—"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-white font-outfit leading-tight">
                          {ev.name}
                        </h4>
                        {ev.description && (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 leading-snug line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hiring */}
            {club.hiring_process && (
              <div className="space-y-2">
                <SectionHeader icon={User} title="Hiring Process" />
                <div className={cn(TILE_CARD, MARKDOWN)}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{club.hiring_process}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Connect & join */}
            {links.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={Globe} title="Connect & Join" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {links.map(({ key, label, icon: Icon, tone }) => (
                    <a
                      key={key}
                      href={key === "instagram" ? instagramUrl(club[key]) : club[key]}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border bg-white/80 dark:bg-zinc-900/70 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer",
                        "border-zinc-200/70 dark:border-zinc-800/80"
                      )}
                    >
                      <span
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                          TONE_ICON_TILE[tone] ?? TONE_ICON_TILE.sky
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                        {label}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Point of contact */}
            {(club.poc || club.poc_name || club.poc_contact || club.poc_email) && (
              <div className={cn(TILE_CARD, "flex flex-col sm:flex-row sm:items-center justify-between gap-3")}>
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                      TONE_ICON_TILE.indigo
                    )}
                  >
                    <User className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      Point of Contact
                    </p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-outfit truncate">
                      {pocName}
                      {club.poc_designation && (
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 font-normal">
                          {" "}
                          ({club.poc_designation})
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {club.poc_contact && (
                    <>
                      <a
                        href={`tel:${club.poc_contact}`}
                        title="Call"
                        aria-label={`Call ${pocName}`}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
                          TONE_ICON_TILE.sky
                        )}
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <a
                        href={whatsappUrl(club.poc_contact)}
                        target="_blank"
                        rel="noreferrer"
                        title="Message on WhatsApp"
                        aria-label={`Message ${pocName} on WhatsApp`}
                        className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
                          TONE_ICON_TILE.emerald
                        )}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  {club.poc_email && (
                    <a
                      href={`mailto:${club.poc_email}`}
                      title="Email"
                      aria-label={`Email ${pocName}`}
                      className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center border transition-colors",
                        TONE_ICON_TILE.violet
                      )}
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
