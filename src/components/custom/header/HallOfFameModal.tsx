"use client";
import { ExternalLink, Github, Star, Trophy } from "lucide-react";
import {
  IconLink,
  ListRowText,
  ListShell,
  PageShell,
  SectionHeader,
  StatTile,
} from "../shared/primitives";
import { LIST_ROW, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

const credits = [
    {
        name: "UniCC Core",
        author: "Arya4930",
        description: "The original foundational vision, architecture, and core of UniCC.",
        repo: "https://github.com/Arya4930/UniCC"
    },
    {
        name: "MarksApp",
        author: "Miihir79",
        description: "Innovative marks calculation logic and grades fetching architecture.",
        repo: "https://github.com/Miihir79/MarksApp"
    },
    {
        name: "FFCSonTheGo",
        author: "vatz88",
        description: "Pioneering algorithms for FFCS timetable aggregation and social schedules.",
        repo: "https://github.com/vatz88/FFCSonTheGo"
    },
    {
        name: "VIT-Verse",
        author: "Divyanshu Patel",
        description: "Robust data scraping architecture and attendance mechanics. (Clone only exists)",
        repo: "https://codeberg.org/fkvit/fkvit/"
    },
    {
        name: "JeeHub",
        author: "dhruv-programmes",
        description: "Authentication and UI/UX inspiration for seamless student experiences.",
        repo: "https://github.com/dhruv-programmes/JeeHub"
    },
    {
        name: "Project-PAS",
        author: "SugeethJSA",
        description: "Advanced GPA predictor systems and grade estimation logic.",
        repo: "https://github.com/SugeethJSA/project-pas"
    }
];

/**
 * The projects AmazeCC is built on top of.
 *
 * Each credit is a row in one list rather than a card of its own. A card grid
 * gave every project a title, an author, a sentence and an arrow across two
 * hundred pixels, for six sentences of content; as rows the whole page is one
 * readable list, and the description no longer has to be squeezed into whatever
 * height the grid decided on.
 */
export default function HallOfFameModal({ handleClose }: { handleClose: () => void }) {
    const authors = new Set(credits.map((c) => c.author));

    return (
        <PageShell
            eyebrow="About"
            title="Hall of Fame"
            subtitle="The giants whose shoulders we stand on"
            onBack={handleClose}
        >
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <StatTile
                        label="Projects credited"
                        value={credits.length}
                        badge="Open source"
                        tone="amber"
                        sub="this app is built on"
                    />
                    <StatTile
                        label="Authors"
                        value={authors.size}
                        badge="Thanked"
                        tone="neutral"
                        sub="across those projects"
                    />
                </div>

                <div className="space-y-3">
                    <SectionHeader icon={Trophy} title="Projects" count={credits.length} />
                    <ListShell>
                        {credits.map((credit) => (
                            <div key={credit.repo} className={LIST_ROW}>
                                <span
                                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE.zinc}`}
                                >
                                    <Github className="w-4.5 h-4.5" />
                                </span>
                                <ListRowText
                                    title={credit.name}
                                    subtitle={`by ${credit.author} · ${credit.description}`}
                                    titleTooltip={credit.description}
                                />
                                <IconLink
                                    href={credit.repo}
                                    title={`${credit.name} repository`}
                                    ariaLabel={`Open the ${credit.name} repository`}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </IconLink>
                            </div>
                        ))}
                    </ListShell>
                </div>

                <div className={`${TILE_CARD} flex items-center justify-center gap-2 text-xs font-semibold text-text-secondary dark:text-text-muted`}>
                    Curated with <Star className="w-3.5 h-3.5 text-amber-500 shrink-0" /> by{" "}
                    <span className="font-black text-text-heading">SugeethJSA</span>
                </div>
            </div>
        </PageShell>
    );
}
