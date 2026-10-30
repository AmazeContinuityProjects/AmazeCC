"use client";

/**
 * Friends — a full-page subpage of the planner, shaped like the app's other
 * hub → section pages (Profile → Settings) rather than the two-tab sheet this
 * replaces.
 *
 * ## Why a page and not a sheet
 *
 * The old "Friends Manager" bottom sheet crammed two tabs — an import button,
 * the friend list, a group-creation form, the group list — into one scrolling
 * panel, so the list you came to check was below the fold of the form you did
 * not. As a page it is the app's standard hub: three rows (add, friends,
 * groups), each drilling into its own screen with the same back affordance
 * the rest of the planner uses.
 *
 * ## Adding a friend accepts a link *or* a code
 *
 * The share feature hands out full URLs, but a chat app reliably delivers the
 * short TT-shape code after `?q=` intact while it mangles long links — so the
 * add field takes either. `loadShareInput` (@/lib/ffcsShareInput) is the same
 * resolver the standalone share page uses, meaning a plan opened from a pasted
 * link here shows exactly the courses the recipient's share page would.
 *
 * The semester's report, when the planner already has it loaded, is handed to
 * the resolver so the common case (friend shares this term's plan) costs no
 * fetch; a link written against the other term still downloads its own report.
 */

import { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  Link2,
  Loader2,
  Trash2,
  Upload,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { useOverlayBack } from "@/lib/overlayStack";
import { loadShareInput, ShareInputError } from "@/lib/ffcsShareInput";
import BottomSheet from "../../shared/BottomSheet";
import { EmptyPanel, ListRowText, ListShell, PageShell } from "../../shared/primitives";
import { LIST_ROW } from "@/lib/uiTokens";
import {
  FriendTimetableViewModal,
  type SelectedFriendTimetableData,
} from "./components/modals/FriendTimetableViewModal";
import type { FFCSSemesterId } from "./reports";
import type { Friend, FriendGroup, ParsedCourse, TimetablePeriod, TimetableState } from "./types";

type FriendsSection = "hub" | "add" | "friends" | "groups";

const SECTION_META: Record<Exclude<FriendsSection, "hub">, { title: string; subtitle: string }> = {
  add: {
    title: "Add a friend",
    subtitle: "Paste their share link or TT-shape code, or import an exported JSON",
  },
  friends: {
    title: "Your friends",
    subtitle: "View their timetables and plan around their classes",
  },
  groups: {
    title: "Groups",
    subtitle: "Sets of friends for social scoring in the generator",
  },
};

const HUB_ROWS = [
  {
    id: "add" as const,
    label: "Add a friend",
    subtitle: "Share link, TT-shape code, or exported JSON",
    Icon: UserPlus,
    iconBg: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  },
  {
    id: "friends" as const,
    label: "Your friends",
    subtitle: "Compare timetables and find common free slots",
    Icon: Users,
    iconBg: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  {
    id: "groups" as const,
    label: "Groups",
    subtitle: "Bands of friends the generator can score together",
    Icon: UsersRound,
    iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
] as const;

const ROW_TAPPABLE =
  "cursor-pointer active:bg-zinc-100/70 dark:active:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";

export interface FFCSFriendsSubpageProps {
  onClose: () => void;
  friends: Friend[];
  setFriends: React.Dispatch<React.SetStateAction<Friend[]>>;
  friendGroups: FriendGroup[];
  setFriendGroups: React.Dispatch<React.SetStateAction<FriendGroup[]>>;
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  /**
   * The planner's already-loaded report for `semesterId`, or `[]` when it is
   * still loading / the other term is selected. Passed through to the resolver
   * so adding a this-term link skips the download.
   */
  reportCourses: ParsedCourse[];
  semesterId: FFCSSemesterId;
  /** Reported to the tab so the planner shows its usual success toast on return. */
  onFriendAdded: (name: string) => void;
}

export default function FFCSFriendsSubpage({
  onClose,
  friends,
  setFriends,
  friendGroups,
  setFriendGroups,
  theoryPeriods,
  labPeriods,
  reportCourses,
  semesterId,
  onFriendAdded,
}: FFCSFriendsSubpageProps) {
  const [section, setSection] = useState<FriendsSection>("hub");

  // Add-section state. The link field and the JSON importer both funnel into
  // `pendingFriendTimetables`, which opens the naming sheet — one naming step
  // no matter how the timetable arrived.
  const [linkInput, setLinkInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingFriendTimetables, setPendingFriendTimetables] = useState<TimetableState[] | null>(null);
  const [pendingFriendName, setPendingFriendName] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFriends, setNewGroupFriends] = useState<string[]>([]);

  const [selectedFriendTimetablesData, setSelectedFriendTimetablesData] = useState<SelectedFriendTimetableData | null>(
    null,
  );

  /**
   * System back and the header's back button walk the same path: the naming
   * sheet dismisses itself via its own overlay entry, a section returns to the
   * hub, and the hub leaves the subpage. Returning true from a section step
   * keeps this screen's overlay entry alive so the next gesture continues
   * through it instead of leaving the planner.
   */
  const handleBack = () => {
    if (pendingFriendTimetables) {
      setPendingFriendTimetables(null);
      setPendingFriendName("");
      return true;
    }
    if (section !== "hub") {
      setSection("hub");
      return true;
    }
    onClose();
    return false;
  };

  useOverlayBack("ffcs-friends", true, handleBack);

  const handleAddFromLink = async () => {
    const raw = linkInput.trim();
    if (!raw || isResolving) return;
    setIsResolving(true);
    setAddError(null);
    try {
      const { timetable } = await loadShareInput(raw, {
        reportCourses,
        reportSemesterId: semesterId,
      });
      setPendingFriendTimetables([timetable]);
      setPendingFriendName("");
      setLinkInput("");
    } catch (err) {
      setAddError(
        err instanceof ShareInputError
          ? err.message
          : "Something went wrong reading that. Check the link and try again.",
      );
    } finally {
      setIsResolving(false);
    }
  };

  const importFriendTimetable = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id && Array.isArray(parsed[0].courses)) {
          setAddError(null);
          setPendingFriendTimetables(parsed);
          setPendingFriendName("");
        } else {
          setAddError("That file isn't an exported timetable config.");
        }
      } catch {
        setAddError("That file could not be read as JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleSaveFriend = () => {
    if (!pendingFriendTimetables) return;
    const friendName = pendingFriendName.trim() || "Friend";
    const newFriend: Friend = {
      id: Date.now().toString(),
      name: friendName,
      timetables: pendingFriendTimetables,
    };
    setFriends((prev) => [...prev, newFriend]);
    setPendingFriendTimetables(null);
    setPendingFriendName("");
    onFriendAdded(friendName);
    // Land on the list, where the friend that was just named is now visible —
    // naming is only satisfying if you then see the result.
    setSection("friends");
  };

  const removeFriend = (friendId: string) => {
    setFriends((prev) => prev.filter((fr) => fr.id !== friendId));
    setFriendGroups((prev) => prev.map((g) => ({ ...g, friendIds: g.friendIds.filter((fid) => fid !== friendId) })));
  };

  const createGroup = () => {
    if (!newGroupName.trim() || newGroupFriends.length === 0) return;
    const newGroup: FriendGroup = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      friendIds: newGroupFriends,
    };
    setFriendGroups((prev) => [...prev, newGroup]);
    setNewGroupName("");
    setNewGroupFriends([]);
  };

  const meta = section === "hub" ? null : SECTION_META[section];

  return (
    <div className="w-full">
      <PageShell
        selectable
        wrap
        eyebrow="FFCS Planner"
        title={meta?.title ?? "Friends"}
        subtitle={meta?.subtitle ?? "Add classmates and plan around their timetables"}
        onBack={handleBack}
        className="!max-w-none px-4 sm:px-6"
      >
        {section === "hub" && (
          <ListShell>
            {HUB_ROWS.map((row) => {
              const count = row.id === "friends" ? friends.length : row.id === "groups" ? friendGroups.length : null;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSection(row.id)}
                  className={`${LIST_ROW} ${ROW_TAPPABLE}`}
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${row.iconBg}`}
                  >
                    <row.Icon className="w-5 h-5" />
                  </div>
                  <ListRowText title={row.label} subtitle={row.subtitle} titleTag="h3" />
                  <div className="flex items-center gap-2 shrink-0">
                    {count !== null ? (
                      <span className="text-sm font-black font-outfit tracking-tight leading-none text-zinc-700 dark:text-zinc-200">
                        {count}
                      </span>
                    ) : null}
                    <ChevronRight className="w-4 h-4 text-zinc-400" />
                  </div>
                </button>
              );
            })}
          </ListShell>
        )}

        {section === "add" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="ffcs-friend-share-input"
                className="text-sm font-bold text-text-heading flex items-center gap-2"
              >
                <Link2 className="w-4 h-4 text-pink-500" /> Share link or code
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="ffcs-friend-share-input"
                  type="text"
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    setAddError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddFromLink();
                  }}
                  placeholder="Paste the full link, or just the code after ?q="
                  className="flex-1 min-w-0 bg-surface border border-border-strong rounded-xl px-4 py-3 text-base sm:text-sm text-text-heading placeholder:text-muted-foreground focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all"
                />
                <button
                  type="button"
                  disabled={!linkInput.trim() || isResolving}
                  onClick={() => void handleAddFromLink()}
                  className="shrink-0 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2"
                >
                  {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {isResolving ? "Adding…" : "Add friend"}
                </button>
              </div>
              {addError ? (
                <p role="alert" className="text-xs font-medium text-red-500 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                  {addError}
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border-muted dark:bg-border/70" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border-muted dark:bg-border/70" />
            </div>

            <label className="flex items-center justify-center gap-2 w-full bg-surface-secondary/50 hover:bg-surface-secondary/80 text-text-heading font-bold py-3 rounded-xl border border-border-strong transition-colors cursor-pointer relative overflow-hidden">
              <input
                type="file"
                accept=".json"
                onChange={importFriendTimetable}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-5 h-5 text-pink-500" /> Import exported JSON
            </label>
            <p className="text-xs text-muted-foreground">
              Your friend can export theirs from the planner&rsquo;s share menu. Ask them for the link instead if you
              can — it stays current with their changes.
            </p>
          </div>
        )}

        {section === "friends" &&
          (friends.length === 0 ? (
            <EmptyPanel
              icon={<Users className="h-7 w-7" />}
              tone="violet"
              title="No friends yet"
              description="Paste a friend's share link or TT-shape code on the previous screen to plan around their classes."
              action={
                <button
                  type="button"
                  onClick={() => setSection("add")}
                  className="bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                >
                  Add a friend
                </button>
              }
            />
          ) : (
            <ListShell>
              {friends.map((f) => (
                <div key={f.id} className="w-full flex items-center gap-3 py-3 px-4">
                  <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500 font-bold shrink-0">
                    {f.name.charAt(0).toUpperCase()}
                  </div>
                  <ListRowText
                    title={f.name}
                    subtitle={`Considering ${f.timetables?.length || 0} timetable${(f.timetables?.length || 0) === 1 ? "" : "s"}`}
                    titleTag="h3"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (f.timetables && f.timetables.length > 0) {
                          setSelectedFriendTimetablesData({
                            name: f.name,
                            timetables: f.timetables,
                            currentIndex: 0,
                          });
                        }
                      }}
                      title="View Timetable"
                      className="p-2 hover:bg-blue-500/10 text-muted-foreground hover:text-blue-500 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFriend(f.id)}
                      title="Remove Friend"
                      className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </ListShell>
          ))}

        {section === "groups" && (
          <div className="space-y-6">
            <div className="card-surface border border-border-strong rounded-2xl p-4 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-text-heading flex items-center gap-2">
                <UsersRound className="w-4 h-4 text-emerald-500" /> Create a group
              </h3>
              <input
                type="text"
                placeholder="Group name (e.g., Gaming Squad)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full bg-surface border border-border-strong rounded-xl px-4 py-2.5 text-base sm:text-sm text-text-heading focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
              <div className="max-h-40 overflow-y-auto custom-scrollbar border border-border-strong rounded-xl bg-surface p-2">
                {friends.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2 text-center">Add friends first</div>
                ) : (
                  friends.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 p-1.5 hover:bg-surface-secondary/50 rounded-md cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newGroupFriends.includes(f.id)}
                        onChange={(e) => {
                          if (e.target.checked) setNewGroupFriends((prev) => [...prev, f.id]);
                          else setNewGroupFriends((prev) => prev.filter((id) => id !== f.id));
                        }}
                        className="rounded border-border-strong text-emerald-500 focus:ring-emerald-500/30"
                      />
                      <span className="text-sm text-text-heading">{f.name}</span>
                    </label>
                  ))
                )}
              </div>
              <button
                type="button"
                disabled={!newGroupName.trim() || newGroupFriends.length === 0}
                onClick={createGroup}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Create Group
              </button>
            </div>

            {friendGroups.length === 0 ? (
              <EmptyPanel
                icon={<UsersRound className="h-7 w-7" />}
                tone="emerald"
                title="No groups yet"
                description="Group friends who always want overlapping classes so the generator can score them together."
                variant="dashed"
              />
            ) : (
              <ListShell>
                {friendGroups.map((g) => (
                  <div key={g.id} className="w-full flex flex-col gap-2 py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <ListRowText
                        title={g.name}
                        subtitle={`${g.friendIds.length} friend${g.friendIds.length === 1 ? "" : "s"}`}
                        titleTag="h3"
                      />
                      <button
                        type="button"
                        onClick={() => setFriendGroups((prev) => prev.filter((gr) => gr.id !== g.id))}
                        title="Delete Group"
                        className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.friendIds.map((fid) => {
                        const f = friends.find((fr) => fr.id === fid);
                        if (!f) return null;
                        return (
                          <span
                            key={fid}
                            className="text-[10px] bg-surface-secondary/60 border border-border-muted dark:border-border/70 px-1.5 py-0.5 rounded-full text-muted-foreground"
                          >
                            {f.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </ListShell>
            )}
          </div>
        )}
      </PageShell>

      {/* Naming sheet — the single step both import paths funnel into, kept as
          a sheet because it is a one-field question over the screen that asked
          it. Carries its own z: nothing else on this page is layered, but the
          sheet reads correctly over any future backdrop. */}
      {pendingFriendTimetables && (
        <BottomSheet
          onClose={() => {
            setPendingFriendTimetables(null);
            setPendingFriendName("");
          }}
          overlayId="ffcs-name-friend"
          maxWidth="max-w-sm"
          panelZIndex={210}
          backdropZIndex={205}
          contentClassName="flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-500">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text-heading">Name Your Friend</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {pendingFriendTimetables.length === 1
              ? "They shared a timetable. Give them a name so you can identify them in the generator."
              : `They're considering ${pendingFriendTimetables.length} timetables. Give them a name so you can identify them in the generator.`}
          </p>
          <input
            type="text"
            value={pendingFriendName}
            onChange={(e) => setPendingFriendName(e.target.value)}
            placeholder="E.g., Rahul"
            className="w-full bg-surface-secondary/30 border border-border-strong rounded-xl px-4 py-3 text-base sm:text-sm text-text-heading focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/50 transition-all"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveFriend();
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setPendingFriendTimetables(null);
                setPendingFriendName("");
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveFriend}
              className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-pink-500/20"
            >
              Save Friend
            </button>
          </div>
        </BottomSheet>
      )}

      <FriendTimetableViewModal
        data={selectedFriendTimetablesData}
        setData={setSelectedFriendTimetablesData}
        theoryPeriods={theoryPeriods}
        labPeriods={labPeriods}
      />
    </div>
  );
}
