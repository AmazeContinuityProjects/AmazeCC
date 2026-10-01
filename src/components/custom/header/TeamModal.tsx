"use client";
import { Github, Linkedin, Users } from "lucide-react";
import teamData from "../../../data/team.json";
import {
  IconLink,
  ListRowText,
  ListShell,
  PageShell,
  SectionHeader,
  StatTile,
} from "../shared/primitives";
import { LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";

/**
 * The team behind AmazeCC.
 *
 * A page, not a modal: it is reached from About as a subpage and owns its own
 * chrome through `PageShell`, so back goes where the reader came from instead of
 * into a dismiss handler that has to guess. Each committee is a `ListShell` of
 * member rows, which is the same shape CurriculumPage uses for its section
 * lists, so a person reads the same object on every screen in the app.
 */
export default function TeamModal({ handleClose }: { handleClose: () => void }) {
  const sortedCommittees = [...teamData.committees]
    .filter((c) => c.members && c.members.length > 0)
    .sort((a, b) => a.order - b.order);

  const totalMembers = sortedCommittees.reduce(
    (n, c) => n + (c.members?.length || 0),
    0
  );

  return (
    <PageShell
      eyebrow="About"
      title="Amaze Continuity Projects"
      subtitle="The team building AmazeCC"
      onBack={handleClose}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile
            label="Committees"
            value={sortedCommittees.length}
            badge="Active"
            tone="indigo"
            sub="with published members"
          />
          <StatTile
            label="Contributors"
            value={totalMembers}
            badge="Credited"
            tone="neutral"
            sub="across the project"
          />
        </div>

        {sortedCommittees.map((committee) => {
          const sortedMembers = [...(committee.members || [])].sort(
            (a, b) => a.order - b.order
          );

          return (
            <div key={committee.id} className="space-y-3">
              <div className="px-1">
                <SectionHeader
                  icon={Users}
                  title={committee.name}
                  count={sortedMembers.length}
                />
                {/* Committee descriptions are one line of prose, not a heading, so
                    they sit under the header rather than in it. */}
                {committee.description && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-text-secondary dark:text-text-muted font-medium">
                    {committee.description}
                  </p>
                )}
              </div>

              <ListShell>
                {sortedMembers.map((member, idx) => (
                  <div key={`${committee.id}-${member.name}-${idx}`} className={LIST_ROW}>
                    {member.avatar ? (
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-border-muted"
                      />
                    ) : (
                      <span
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border text-sm font-black font-outfit ${TONE_ICON_TILE.indigo}`}
                        aria-hidden
                      >
                        {member.name.charAt(0).toUpperCase()}
                      </span>
                    )}

                    <ListRowText title={member.name} subtitle={member.role} />

                    {member.github && (
                      <IconLink
                        href={`https://github/${member.github}`}
                        title={`${member.name} on GitHub`}
                        ariaLabel={`Open ${member.name}'s GitHub profile`}
                      >
                        <Github className="w-4 h-4" />
                      </IconLink>
                    )}
                    {member.linkedin && (
                      <IconLink
                        href={member.linkedin}
                        title={`${member.name} on LinkedIn`}
                        ariaLabel={`Open ${member.name}'s LinkedIn profile`}
                      >
                        <Linkedin className="w-4 h-4" />
                      </IconLink>
                    )}
                  </div>
                ))}
              </ListShell>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
