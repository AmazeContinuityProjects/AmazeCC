import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import InfoRow from "../shared/InfoRow";
import { Calendar, MapPin, IndianRupee, Users, Tag, FileText, Clock, User, Award } from "lucide-react";
import { EventHubEvent, EventHubPreview } from "@/types/data/eventhub";
import { useEffect, useState } from "react";
import { API_BASE } from "../Main";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SubpageLayout from "../shared/SubpageLayout";

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
  const [modalContent, setModalContent] = useState<{title: string, message: string}>({title: "", message: ""});
  const [pwaUrl, setPwaUrl] = useState<string | null>(null);
  const [pwaMode, setPwaMode] = useState<"pay" | "view" | null>(null);

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

    setIsRegistering(true); // Re-use loading state to show "Processing..."
    try {
      const res = await fetch(`${API_BASE}/api/events/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: IDs.VtopUsername,
          password: IDs.VtopPassword,
          url: url
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to download document.");
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = isCert ? `${selectedEvent.title.replace(/[^a-z0-9]/gi, '_')}_Certificate.pdf` : `${selectedEvent.title.replace(/[^a-z0-9]/gi, '_')}_Receipt.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setModalContent({ title: "Download Error", message: err.message });
      setModalOpen(true);
    } finally {
      setIsRegistering(false);
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

    const htmlPayload = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Redirecting to Event Hub...</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #334155; }
              .loader { border: 3px solid #e2e8f0; border-top: 3px solid #3b82f6; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-right: 12px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .container { display: flex; align-items: center; background: white; padding: 20px 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="loader"></div>
              <p>Opening Event Hub Details...</p>
          </div>
          <form id="loginForm" action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST">
              <input type="hidden" name="username" value="${IDs.VtopUsername.replace(/"/g, '&quot;')}" />
              <input type="hidden" name="password" value="${IDs.VtopPassword.replace(/"/g, '&quot;')}" />
              <input type="hidden" name="validateVitian" value="1" />
          </form>
          <script>
              document.getElementById("loginForm").submit();
          </script>
      </body>
      </html>
    `;

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
    try {
      const res = await fetch(`${API_BASE}/api/events/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: IDs.VtopUsername,
          password: IDs.VtopPassword,
          eid: selectedEvent.eid
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        setModalContent({ title: "Registration Failed", message: data.error || "Failed to register for event." });
        setModalOpen(true);
        return;
      }

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
      }
    } catch (err: any) {
      setModalContent({ title: "Error", message: "An error occurred: " + err.message });
      setModalOpen(true);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <SubpageLayout title={selectedEvent.title} onBack={onClose} className="max-w-6xl xl:max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-800 midnight:bg-black rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 midnight:border-gray-800">
        {selectedEvent.eligibility && (
          <div className="flex justify-end mb-6">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 midnight:bg-blue-900/20 midnight:text-blue-300">
              <Users className="w-4 h-4" /> {selectedEvent.eligibility}
            </span>
          </div>
        )}

        {/* Action Buttons extracted to a function to render in multiple places */}
        {(() => {
          const renderActionButtons = () => {
            return (
              <div className="pt-8 border-t border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50 flex flex-col xl:flex-row gap-4 items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white midnight:text-white">Ready to join?</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400">Registration and payments are handled securely on the official portal.</p>
                </div>
                  {/* Conditional Registration/Payment Button */}
                  {(() => {
                    const registrationDetails = registeredEvents?.find(e => e.name === selectedEvent.title) || selectedEvent.registeredDetails;
                    if (registrationDetails) {
                      const isUnpaid = !registrationDetails.paymentStatus.toLowerCase().includes('paid') && !registrationDetails.paymentStatus.toLowerCase().includes('free') && !registrationDetails.paymentStatus.toLowerCase().includes('success');
                      
                      return (
                        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                          {isUnpaid ? (
                            <button 
                              onClick={async () => {
                                const linkToPay = registrationDetails.payNowLink || `/EventHub/showPaymentTC/${registrationDetails.orderId}/`;
                                setIsRegistering(true);
                                try {
                                  const res = await fetch(`${API_BASE}/api/events/paynow`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      username: IDs?.VtopUsername,
                                      password: IDs?.VtopPassword,
                                      url: linkToPay
                                    })
                                  });
                                  const data = await res.json();
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
                                  } else if (data.error) {
                                    setModalContent({ title: "Error", message: data.error });
                                    setModalOpen(true);
                                  }
                                } catch (err: any) {
                                  setModalContent({ title: "Error", message: err.message });
                                  setModalOpen(true);
                                } finally {
                                  setIsRegistering(false);
                                }
                              }}
                              disabled={isRegistering}
                              className="w-full xl:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm text-center flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                              {isRegistering ? "Processing..." : "Pay Now"}
                            </button>
                          ) : (
                            <button 
                              disabled
                              className="w-full xl:w-auto px-8 py-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 midnight:bg-green-900/30 midnight:text-green-400 font-medium rounded-xl text-center flex items-center justify-center gap-2 whitespace-nowrap cursor-not-allowed"
                            >
                              Registered
                            </button>
                          )}
                          
                          {registrationDetails.certificateLink && (
                            <button onClick={() => handleSecureDownload(registrationDetails.certificateLink, true)} disabled={isRegistering} className="w-full xl:w-auto px-6 py-3 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 midnight:bg-purple-900/30 midnight:text-purple-300 font-medium rounded-xl hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors text-center flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
                              {isRegistering ? "Wait..." : <><Award className="w-4 h-4" /> Certificate</>}
                            </button>
                          )}
                          {registrationDetails.receiptLink && (
                            <button onClick={() => handleSecureDownload(registrationDetails.receiptLink, false)} disabled={isRegistering} className="w-full xl:w-auto px-6 py-3 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 midnight:bg-gray-800 midnight:text-gray-300 font-medium rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors text-center flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
                              {isRegistering ? "Wait..." : <><FileText className="w-4 h-4" /> Receipt</>}
                            </button>
                          )}
                        </div>
                      );
                    }

                    // Not registered, show 1-Click Register
                    return (
                      <button 
                        onClick={handleOneClickRegister}
                        disabled={isRegistering}
                        className="w-full xl:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm text-center flex items-center justify-center gap-2 whitespace-nowrap"
                      >
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
                    );
                  })()}

                  {/* Fallback Auto-Login Button */}
                  <div className="w-full xl:w-auto shrink-0">
                    <button 
                      onClick={handleOpenInEventHub}
                      disabled={isRegistering}
                      className="w-full xl:w-auto px-8 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 midnight:bg-gray-800 midnight:hover:bg-gray-700 text-gray-700 dark:text-gray-200 midnight:text-gray-200 font-medium rounded-xl transition-colors text-center flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      Open in Event Hub
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
              </div>
            );
          };

          return (
            <>

        {previewLoading ? (
          <div className="space-y-4">
            <Skeleton className="w-full aspect-video rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : previewError ? (
          <div className="space-y-6">
            <div className="text-center p-8 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/10 text-red-600 rounded-2xl">
              <p>{previewError}</p>
              {!selectedEvent.isPastEvent && (
                <p className="text-sm mt-2 opacity-80">Make sure your VTOP credentials are correct, as Event Hub requires them for authentication.</p>
              )}
            </div>
            {renderActionButtons()}
          </div>
        ) : previewData ? (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Left Column: Image */}
            {previewData.imageSrc && (
              <div className="md:w-5/12 lg:w-1/3 shrink-0">
                <div className="rounded-2xl overflow-hidden bg-gray-50 dark:bg-slate-900 midnight:bg-gray-900 flex justify-center border border-gray-100 dark:border-slate-700 midnight:border-gray-800 md:sticky md:top-8">
                  <img 
                    src={previewData.imageSrc} 
                    alt={selectedEvent.title}
                    className="w-full h-auto object-contain"
                  />
                </div>
              </div>
            )}
            
            {/* Right Column: Details */}
            <div className={`space-y-8 ${previewData.imageSrc ? 'md:w-7/12 lg:w-2/3' : 'w-full'}`}>
              {previewData.metaDetails && Object.keys(previewData.metaDetails).length > 0 ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(previewData.metaDetails).map(([key, value]) => {
                    // Skip Event Name and Event Description as they are displayed elsewhere
                    if (key.includes('Name') || key.includes('Description')) return null;
                    
                    let Icon = FileText;
                    if (key.includes('Date')) Icon = Calendar;
                    else if (key.includes('Venue') || key.includes('Location')) Icon = MapPin;
                    else if (key.includes('Fee') || key.includes('Price')) Icon = IndianRupee;
                    else if (key.includes('Time')) Icon = Clock;
                    else if (key.includes('Participant')) Icon = Users;
                    else if (key.includes('Conducted') || key.includes('By')) Icon = User;

                    return (
                      <div key={key} className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/30 midnight:bg-gray-900/50 border border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50 flex flex-col justify-center">
                        <InfoRow icon={<Icon className="w-4 h-4" />}>{key}: {value}</InfoRow>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/30 midnight:bg-gray-900/50 border border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50">
                    <InfoRow icon={<Calendar className="w-4 h-4" />}>Date: {selectedEvent.date}</InfoRow>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/30 midnight:bg-gray-900/50 border border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50">
                    <InfoRow icon={<MapPin className="w-4 h-4" />}>Location: {selectedEvent.location}</InfoRow>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/30 midnight:bg-gray-900/50 border border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50">
                    <InfoRow icon={<IndianRupee className="w-4 h-4" />}>Price: {selectedEvent.price || "Free"}</InfoRow>
                  </div>
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-700/30 midnight:bg-gray-900/50 border border-gray-100 dark:border-slate-700/50 midnight:border-gray-800/50">
                    <InfoRow icon={<Tag className="w-4 h-4" />}>Type: {selectedEvent.type}</InfoRow>
                  </div>
                </div>
              )}

              <div className="prose dark:prose-invert max-w-none">
                <h3 className="font-bold text-xl mb-4 text-gray-900 dark:text-white midnight:text-white">About this Event</h3>
                <p className="text-gray-700 dark:text-gray-300 midnight:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {previewData.description || "No description provided."}
                </p>
              </div>

              {renderActionButtons()}
            </div>
          </div>
        ) : null}
        
        {/* End IIFE for renderActionButtons scope */}
        </>
        );
        })()}
      </div>

      {/* Status Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white midnight:text-white">
              {modalContent.title}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300 midnight:text-gray-300 mt-2">
              {modalContent.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PWA Mobile Fallback Modal */}
      <Dialog open={!!pwaUrl} onOpenChange={(open) => !open && setPwaUrl(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 midnight:bg-black border-gray-200 dark:border-slate-800 midnight:border-gray-800 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white midnight:text-white">Secure Access Required</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 midnight:text-gray-400 mt-2">
              Because of Mobile App security policies, accessing Event Hub securely requires two steps. 
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 midnight:border-blue-900/30">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 midnight:text-blue-400 mb-1">Step 1: Authenticate</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 midnight:text-blue-500 mb-3">Log in to the portal. <strong>Click 'Done' or 'X' in the top bar immediately when the dashboard appears.</strong></p>
              
              <form action="https://eventhubcc.vit.ac.in/EventHub/mainDashboard" method="POST" target="_blank">
                <input type="hidden" name="username" value={IDs?.VtopUsername} />
                <input type="hidden" name="password" value={IDs?.VtopPassword} />
                <input type="hidden" name="validateVitian" value="1" />
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  Login to Event Hub
                </Button>
              </form>
            </div>
            
            <div className="bg-gray-50 dark:bg-slate-800/50 midnight:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 midnight:border-gray-800">
              <h4 className="font-semibold text-gray-900 dark:text-white midnight:text-white mb-1">Step 2: Open Details</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-3">After completing Step 1, click here to proceed.</p>
              <Button 
                onClick={() => window.open(pwaUrl || "", "_blank")}
                variant="outline" 
                className="w-full border-gray-200 dark:border-slate-600 midnight:border-gray-700 text-gray-700 dark:text-gray-200 midnight:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 midnight:hover:bg-gray-800 whitespace-normal h-auto py-3 text-center"
              >
                {pwaMode === "pay" ? "Proceed to Event Hub page for event, with payment options." : "View Event Details"}
              </Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwaUrl(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white midnight:hover:text-white">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SubpageLayout>
  );
}
