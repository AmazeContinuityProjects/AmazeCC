"use client";
import { useEffect, useMemo, useState } from "react";
import { Skeleton, cn } from "@amazecontinuityprojects/amazeui";
import { Button } from "@amazecontinuityprojects/amazeui";
import {
  Calendar,
  MapPin,
  IndianRupee,
  Users,
  Tag,
  FileText,
  Clock,
  User,
  Award,
  ExternalLink,
  Ticket,
} from "lucide-react";
import { EventHubEvent, EventHubPreview } from "@/types/data/eventhub";
import { api, clearEventHubSession, eventHubRequest, EventHubError } from "@/lib/sync-engine";
import { eventDateLabel, eventhubImageUrl, eventHubLoginHtml, EVENTHUB_BASE, isRegistrationPaid } from "@/lib/eventhub";
import BottomSheet from "../shared/BottomSheet";
import { AnimatePresence } from "framer-motion";
import ClubDetailsModal from "../clubs/ClubDetailsModal";
import { KeyValue, PageShell, ToneBadge } from "../shared/primitives";
import { TILE_CARD } from "@/lib/uiTokens";
import { getSimilarity } from "@/lib/string-similarity";

interface EventHubSubpageProps {
  selectedEvent: EventHubEvent;
  previewData: EventHubPreview | null;
  previewLoading: boolean;
  previewError: string;
  onClose: () => void;
  setIsSubpageOpen?: (isOpen: boolean) => void;
  IDs?: any;
  registeredEvents?: any[];
}

/** Primary / secondary action surfaces, in the app's zinc + indigo dialect. */
const ACTION_PRIMARY =
  "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs active:scale-[0.98] transition-all cursor-pointer disabled:bg-indigo-400 disabled:cursor-not-allowed whitespace-nowrap";
const ACTION_TONE: Record<string, string> = {
  amber:
    "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-bold text-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap",
  emerald:
    "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 font-bold text-sm whitespace-nowrap cursor-not-allowed",
  violet:
    "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/25 font-bold text-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap",
  zinc: "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap",
};
/** Event Hub publishes a timing field under one of these names. */
const TIME_KEYS = ["time", "timing", "slot", "schedule", "duration"];

/** Which icon a preview field's name asks for. */
function metaIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("date")) return Calendar;
  if (k.includes("venue") || k.includes("location")) return MapPin;
  if (k.includes("fee") || k.includes("price")) return IndianRupee;
  if (k.includes("time") || TIME_KEYS.includes(k)) return Clock;
  if (k.includes("participant") || k.includes("eligib")) return Users;
  if (k.includes("conducted") || k.includes("organis") || k.includes("organiz") || k.includes(" by")) return User;
  if (k.includes("type") || k.includes("category")) return Tag;
  return FileText;
}

/** Whether a preview field names the organiser, who is then worth matching. */
function isOrganiserKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes("conducted") || k.includes("organis") || k.includes("organiz");
}

/**
 * The "Conducted By" value is free text, so it is matched against the club
 * directory rather than trusted. The organiser then opens a real card instead
 * of a string of unverified initials.
 */
function findMatchingClub(clubs: any[], value?: string) {
  if (!value || clubs.length === 0) return null;
  for (const club of clubs) {
    if (getSimilarity(value, club.club_name) > 0.8 || (club.club_id && getSimilarity(value, club.club_id) > 0.8)) {
      return club;
    }
  }
  return null;
}

export default function EventHubSubpage({
  selectedEvent,
  previewData,
  previewLoading,
  previewError,
  onClose,
  setIsSubpageOpen,
  IDs,
  registeredEvents,
}: EventHubSubpageProps) {

  const [isRegistering, setIsRegistering] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Status + PWA sheets register themselves for system back via BottomSheet.
  const [modalContent, setModalContent] = useState<{title: string, message: string}>({title: "", message: ""});
  const [pwaUrl, setPwaUrl] = useState<string | null>(null);
  const [pwaMode, setPwaMode] = useState<"pay" | "view" | "download" | null>(null);
  const [clubsList, setClubsList] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any | null>(null);

  useEffect(() => {
    api("clubs/details")
      .then(data => {
        if ((data as any).success && (data as any).clubs) {
          setClubsList((data as any).clubs);
        }
      })
      .catch(console.error);
  }, []);

  const isMobilePWA = () => {
    if (typeof window === 'undefined') return false;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    return isMobile && isPWA;
  };

  useEffect(() => {
    if (setIsSubpageOpen) setIsSubpageOpen(true);
    return () => {
      if (setIsSubpageOpen) setIsSubpageOpen(false);
    };
  }, [selectedEvent, IDs]);

  const handleSecureDownload = async (url: string, isCert: boolean) => {
    if (!IDs?.VtopUsername || !IDs?.VtopPassword) {
      setModalContent({ title: "Authentication Required", message: "Please save your VTOP credentials in the settings first." });
      setModalOpen(true);
      return;
    }

    // Normalize to an absolute Event Hub URL (mirrors the old backend route).
    const fileUrl = url.startsWith("http")
      ? url
      : `${EVENTHUB_BASE}${url.startsWith("/") ? url : "/" + url}`;

    if (IDs?.VtopUsername === "demo") {
      const element = document.createElement("a");
      const file = new Blob(["This is a mock AmazeCC Event Hub document for " + selectedEvent.title], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = isCert ? "Certificate.txt" : "Receipt.txt";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      return;
    }

    // Log into Event Hub inside a window/frame to set the JSESSIONID cookie on
    // the eventhubcc origin, then navigate that window to the file so the PDF
    // downloads directly from Event Hub — no byte streaming through our backend.
    if (isMobilePWA()) {
      setPwaUrl(fileUrl);
      setPwaMode("download");
      return;
    }

    const htmlPayload = eventHubLoginHtml(IDs.VtopUsername, IDs.VtopPassword);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlPayload);
      setTimeout(() => {
        try {
          win.location.href = fileUrl;
        } catch (e) {
          console.error("Failed to redirect popup", e);
        }
      }, 3500);
    } else {
      setModalContent({ title: "Popup Blocked", message: "Please allow popups to download the document." });
      setModalOpen(true);
    }
  };

  const handleOpenInEventHub = () => {
    if (!IDs?.VtopUsername || !IDs?.VtopPassword) {
      setModalContent({ title: "Authentication Required", message: "Please save your VTOP credentials in the settings first." });
      setModalOpen(true);
      return;
    }

    const tcUrl = `https://eventhubcc.vit.ac.in/EventHub/eventPreview?eid=${selectedEvent.eid}`;

    if (isMobilePWA()) {
      setPwaUrl(tcUrl);
      setPwaMode("view");
      return;
    }

    const htmlPayload = eventHubLoginHtml(IDs.VtopUsername, IDs.VtopPassword);

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlPayload);
      setTimeout(() => {
        try {
          win.location.href = tcUrl;
        } catch (e) {
          console.error("Failed to redirect popup", e);
        }
      }, 3500);
    } else {
      setModalContent({ title: "Popup Blocked", message: "Please allow popups to proceed." });
      setModalOpen(true);
    }
  };

  const handleOneClickRegister = async () => {
    if (!IDs?.VtopUsername || !IDs?.VtopPassword) {
      setModalContent({ title: "Authentication Required", message: "Please save your VTOP credentials in the settings first." });
      setModalOpen(true);
      return;
    }

    setIsRegistering(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 500));
      setModalContent({ title: "Registration Successful", message: "Mock registration successful! DevSprint '26 Hackathon is added to your registered events list." });
      setModalOpen(true);
      setIsRegistering(false);
      return;
    }

    try {
      const data = (await eventHubRequest(IDs, "events/register", {
        eid: selectedEvent.eid,
        username: IDs.VtopUsername,
        password: IDs.VtopPassword,
      })) as any;

      if (data.status === "success") {
        setModalContent({ title: "Registration Successful", message: data.message });
        setModalOpen(true);
      } else if (data.status === "already_registered") {
        setModalContent({ title: "Registration Status", message: data.message });
        setModalOpen(true);
      } else if (data.status === "payment_required" || data.status === "redirect") {
        setModalContent({ title: "Payment Required", message: "This event requires payment. Opening the official payment gateway in a new tab..." });
        setModalOpen(true);
        window.open(data.url, "_blank");
      } else if (data.status === "payment_form") {
        // If it returned an auto-submitting form, we can open a new window and document.write it
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(data.html);
        } else {
          setModalContent({ title: "Popup Blocked", message: "Please allow popups to proceed to the payment gateway." });
          setModalOpen(true);
        }
      } else {
        // Every known outcome above is a `status` the route chose deliberately.
        // Reaching here means it answered 200 with something we do not
        // recognise, and staying silent would leave the button looking inert —
        // which is exactly how a rejected registration presented itself before.
        setModalContent({
          title: "Registration Failed",
          message:
            data?.message ||
            data?.error ||
            "Event Hub accepted the request but did not confirm a registration. Open the event in Event Hub to check its status.",
        });
        setModalOpen(true);
      }
    } catch (err: any) {
      setModalContent({ title: "Registration Failed", message: err.message });
      // `eventHubRequest` already retried once on a dead session, so a failure
      // here that names credentials is worth discarding the session over; one
      // that does not (a 500 from Event Hub) is not, and clearing would only
      // throw away a working one.
      if (err instanceof EventHubError && (err.reason === "invalid_credentials" || err.reason === "session_expired")) {
        clearEventHubSession();
      }
      setModalOpen(true);
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePayNow = async () => {
    const registrationDetails = registeredEvents?.find(e => e.name === selectedEvent.title) || selectedEvent.registeredDetails;
    const linkToPay = registrationDetails.payNowLink || `/EventHub/showPaymentTC/${registrationDetails.orderId}/`;
    setIsRegistering(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 650));
      setModalContent({ title: "Payment Successful", message: "Mock transaction of ₹150 processed successfully through offline sandbox!" });
      setModalOpen(true);
      setIsRegistering(false);
      return;
    }
    try {
      const data = (await eventHubRequest(IDs, "events/paynow", {
        username: IDs.VtopUsername,
        password: IDs.VtopPassword,
        url: linkToPay
      })) as any;
      if (data.status === "payment_required" || data.status === "redirect") {
        window.open(data.url, "_blank");
      } else if (data.status === "payment_form") {
        if (isMobilePWA() && data.tcUrl) {
          setPwaUrl(data.tcUrl);
          setPwaMode("pay");
          return;
        }
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(data.html);
          if (data.tcUrl) {
            // Wait 3.5 seconds for the Event Hub login to finish in the new tab,
            // then redirect that same tab to the TC page.
            setTimeout(() => {
              try {
                win.location.href = data.tcUrl;
              } catch (e) {
                console.error("Failed to redirect popup cross-origin", e);
              }
            }, 3500);
          }
        } else {
          setModalContent({ title: "Popup Blocked", message: "Please allow popups to proceed to the payment gateway." });
          setModalOpen(true);
        }
      } else {
        // `eventHubRequest` already throws on an `error` body, so arriving here
        // is an unrecognised 200. Say so rather than closing the spinner and
        // leaving the user to wonder whether they were charged.
        setModalContent({
          title: "Payment Failed",
          message:
            data?.message ||
            "Event Hub did not return a payment page. Check your pending dues before trying again.",
        });
        setModalOpen(true);
      }
    } catch (err: any) {
      setModalContent({ title: "Payment Failed", message: err.message });
      if (err instanceof EventHubError && (err.reason === "invalid_credentials" || err.reason === "session_expired")) {
        clearEventHubSession();
      }
      setModalOpen(true);
    } finally {
      setIsRegistering(false);
    }
  };

  /**
   * Event Hub's preview fields, minus the two it renders elsewhere, resolved to
   * an icon and (where the field names an organiser) a matched club.
   */
  const metaCells = useMemo(() => {
    if (!previewData?.metaDetails) return [];
    return Object.entries(previewData.metaDetails)
      .filter(([key]) => !key.includes("Name") && !key.includes("Description"))
      .map(([key, value]) => ({
        key,
        value,
        Icon: metaIcon(key),
        club: isOrganiserKey(key) ? findMatchingClub(clubsList, value) : null,
      }));
  }, [previewData, clubsList]);

  const registrationDetails =
    registeredEvents?.find(e => e.name === selectedEvent.title) || selectedEvent.registeredDetails;
  const isUnpaid = !!registrationDetails && !isRegistrationPaid(registrationDetails);

  const renderActionButtons = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit">Ready to join?</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            Registration and payments are handled securely on the official portal.
          </p>
        </div>

        {registrationDetails ? (
          isUnpaid ? (
            <button type="button" onClick={handlePayNow} disabled={isRegistering} className={ACTION_TONE.amber}>
              {isRegistering ? "Processing..." : "Pay Now"}
            </button>
          ) : (
            <span className={cn(ACTION_TONE.emerald, "cursor-not-allowed")}>
              <Ticket className="w-4 h-4" />
              Registered
            </span>
          )
        ) : (
          <button type="button" onClick={handleOneClickRegister} disabled={isRegistering} className={ACTION_PRIMARY}>
            {isRegistering ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                1-Click Register
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>

      {(registrationDetails?.certificateLink || registrationDetails?.receiptLink) && (
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
          {registrationDetails.certificateLink && (
            <button
              type="button"
              onClick={() => handleSecureDownload(registrationDetails.certificateLink, true)}
              disabled={isRegistering}
              className={ACTION_TONE.violet}
            >
              <Award className="w-4 h-4" />
              Certificate
            </button>
          )}
          {registrationDetails.receiptLink && (
            <button
              type="button"
              onClick={() => handleSecureDownload(registrationDetails.receiptLink, false)}
              disabled={isRegistering}
              className={ACTION_TONE.zinc}
            >
              <FileText className="w-4 h-4" />
              Receipt
            </button>
          )}
        </div>
      )}

      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        <button type="button" onClick={handleOpenInEventHub} disabled={isRegistering} className={cn(ACTION_TONE.zinc, "w-full sm:w-auto")}>
          Open in Event Hub
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const subtitle = [
    selectedEvent.date ? eventDateLabel(selectedEvent.date) : "",
    selectedEvent.time || selectedEvent.location,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <PageShell
      onBack={onClose}
      eyebrow={
        <span className="flex items-center gap-2">
          <span>
            Event Hub
            {selectedEvent.type && selectedEvent.type !== "Registered" ? ` · ${selectedEvent.type}` : ""}
          </span>
          {selectedEvent.isPastEvent ? <ToneBadge tone="zinc">Past</ToneBadge> : null}
        </span>
      }
      title={selectedEvent.title}
      subtitle={subtitle || undefined}
      wrap
    >
      {/* ── POSTER ── */}
      {selectedEvent.eid && (
        <div className={cn(TILE_CARD, "p-0 overflow-hidden")}>
          {/* The poster is shown at its own aspect ratio — cropped fest art
              loses the date and the fee, which are the two things on it. */}
          <div className="w-full bg-zinc-100 dark:bg-zinc-800">
            <img
              src={eventhubImageUrl(selectedEvent.eid)}
              alt={selectedEvent.title}
              loading="lazy"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}

      {previewLoading ? (
        <div className={cn(TILE_CARD, "space-y-3")}>
          <Skeleton className="w-full h-3 rounded" />
          <Skeleton className="w-5/6 h-3 rounded" />
          <Skeleton className="w-2/3 h-3 rounded" />
        </div>
      ) : previewError ? (
        <div className="space-y-6">
          <div className={cn(TILE_CARD, "p-5 text-sm font-semibold text-red-600 dark:text-red-400 border-red-500/25")}>
            <p>{previewError}</p>
            {!selectedEvent.isPastEvent && (
              <p className="text-[11px] mt-2 font-medium opacity-80">
                Make sure your VTOP credentials are correct, as Event Hub requires them for authentication.
              </p>
            )}
          </div>
          {renderActionButtons()}
        </div>
      ) : previewData ? (
        <div className="space-y-6">
          {/* ── META GRID ── */}
          {metaCells.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
              {metaCells.map(({ key, value, Icon, club }) =>
                club ? (
                  <div
                    key={key}
                    className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1 mb-1.5">
                      <Icon className="w-3 h-3" />
                      Organized by
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedClub(club)}
                      className="inline-flex items-center gap-1.5 max-w-full text-left text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 px-2.5 py-1.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{club.club_name}</span>
                    </button>
                  </div>
                ) : (
                  <KeyValue
                    key={key}
                    label={
                      <span className="flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {key}
                      </span>
                    }
                    value={value}
                  />
                )
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <KeyValue
                label={
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Date
                  </span>
                }
                value={eventDateLabel(selectedEvent.date)}
              />
              <KeyValue
                label={
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Location
                  </span>
                }
                value={selectedEvent.location || "TBA"}
              />
              <KeyValue
                label={
                  <span className="flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" />
                    Price
                  </span>
                }
                value={selectedEvent.price || "Free"}
              />
              <KeyValue
                label={
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Type
                  </span>
                }
                value={selectedEvent.type || "Event"}
              />
            </div>
          )}

          {/* ── ABOUT ── */}
          <div className={cn(TILE_CARD, "space-y-2.5")}>
            <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              About this event
            </h2>
            <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {previewData.description || "No description provided."}
            </p>
          </div>

          {renderActionButtons()}
        </div>
      ) : null}

      {/* Status Sheet */}
      <AnimatePresence>
        {modalOpen && (
          <BottomSheet onClose={() => setModalOpen(false)} overlayId="eventhub-status" maxWidth="max-w-md">
            <div className="space-y-4 pt-1">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                  {modalContent.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                  {modalContent.message}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} className="w-full py-3">
                Close
              </Button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* PWA Mobile Fallback Sheet */}
      <AnimatePresence>
        {!!pwaUrl && (
          <BottomSheet onClose={() => setPwaUrl(null)} overlayId="eventhub-pwa" maxWidth="max-w-md">
            <div className="space-y-4 pt-1">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white font-outfit">Secure Access Required</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                  Because of Mobile App security policies, accessing Event Hub securely requires two steps.
                </p>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-1 text-sm">Step 1: Authenticate</h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-3">Log in to the portal. <strong>Click 'Done' or 'X' in the top bar immediately when the dashboard appears.</strong></p>

                <form action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST" target="_blank">
                  <input type="hidden" name="username" value={IDs?.VtopUsername} />
                  <input type="hidden" name="password" value={IDs?.VtopPassword} />
                  <input type="hidden" name="validateVitian" value="1" />
                  <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm py-3">
                    Login to Event Hub
                  </Button>
                </form>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70">
                <h4 className="font-bold text-zinc-900 dark:text-white mb-1 text-sm">Step 2: Open Details</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">After completing Step 1, click here to proceed.</p>
                <Button
                  onClick={() => window.open(pwaUrl || "", "_blank")}
                  variant="outline"
                  className="w-full whitespace-normal h-auto py-3 text-center"
                >
                  {pwaMode === "download" ? "Download Certificate / Receipt" : pwaMode === "pay" ? "Proceed to Event Hub page for event, with payment options." : "View Event Details"}
                </Button>
              </div>

              <Button variant="ghost" onClick={() => setPwaUrl(null)} className="w-full py-3">Cancel</Button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      <ClubDetailsModal
        isOpen={!!selectedClub}
        onClose={() => setSelectedClub(null)}
        club={selectedClub}
      />
    </PageShell>
  );
}
