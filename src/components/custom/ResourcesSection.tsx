"use client";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  Github,
  History,
  Link2,
  MessagesSquare,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import quickLinks from "../../data/quickLinks.json";
import Links from "./header/Links";
import { ListRowText, ListShell, SectionHeader } from "./shared/primitives";
import { LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";

type Subpage = "main" | "hallOfFame" | "changelog" | "team";

/**
 * One row, three shapes.
 *
 * The list used to be eight hand-typed blocks that differed only in four
 * variables (icon, title, subtitle, where it goes), which is why two of them
 * had drifted — the privacy and terms rows were `<div onClick={window.open}>`
 * rather than real links, so they had no middle-click, no open-in-new-tab and
 * no link status. The row is now built once and every entry is either a real
 * anchor or a real button.
 */
function ResourceRow({
  icon,
  iconClass,
  title,
  desc,
  href,
  onClick,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  desc: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${iconClass}`}
      >
        {icon}
      </span>
      <ListRowText title={title} subtitle={desc} />
      {href ? (
        <ExternalLink className="w-4 h-4 text-zinc-400 shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
      )}
    </>
  );

  const className = `${LIST_ROW} ${href ? "" : "cursor-pointer"}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export default function ResourcesSection({
  setActiveSubpage,
}: {
  setActiveSubpage: (page: Subpage) => void;
}) {
  const community = quickLinks.communityLinks;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          icon={Link2}
          title="Important links"
          count={quickLinks.importantLinks.length}
        />
        <ListShell>
          {quickLinks.importantLinks.map((link) => (
            <ResourceRow
              key={link.id}
              href={link.link}
              icon={<Link2 className="w-4.5 h-4.5" />}
              iconClass={TONE_ICON_TILE.sky}
              title={link.title}
              desc={link.desc}
            />
          ))}
        </ListShell>
      </div>

      <div className="space-y-3">
        <SectionHeader icon={MessagesSquare} title="Community" count={community.length} />
        <ListShell>
          {community.map((link) => (
            <ResourceRow
              key={link.title}
              href={link.link}
              icon={<ExternalLink className="w-4.5 h-4.5" />}
              iconClass={TONE_ICON_TILE.violet}
              title={link.title}
              desc="VIT community discussion forums and updates"
            />
          ))}
        </ListShell>
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Link2} title="Links" />
        <Links />
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Users} title="Project" />
        <ListShell>
          <ResourceRow
            onClick={() => setActiveSubpage("changelog")}
            icon={<History className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.emerald}
            title="Changelog"
            desc="View latest updates, features and releases in AmazeCC"
          />
          <ResourceRow
            onClick={() => setActiveSubpage("team")}
            icon={<Users className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.indigo}
            title="The Team"
            desc="Meet the Amaze Continuity Projects team"
          />
          <ResourceRow
            onClick={() => setActiveSubpage("hallOfFame")}
            icon={<Trophy className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.amber}
            title="Hall of Fame"
            desc="Meet the contributors, developers, and testers of the app"
          />
          <ResourceRow
            href="https://github.com/AmazeContinuityProjects/AmazeCC/"
            icon={<Github className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.zinc}
            title="GitHub Repository"
            desc="Check out code, contribute fixes or report system bugs"
          />
        </ListShell>
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Shield} title="Legal" />
        <ListShell>
          <ResourceRow
            href="/privacy"
            icon={<FileText className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.sky}
            title="Privacy Policy"
            desc="Read about local credentials and encryption safety"
          />
          <ResourceRow
            href="/terms"
            icon={<FileText className="w-4.5 h-4.5" />}
            iconClass={TONE_ICON_TILE.sky}
            title="Terms of Service"
            desc="Understand guidelines and rules of utilizing AmazeCC services"
          />
        </ListShell>
      </div>
    </div>
  );
}
