export interface EventHubEvent {
    eid: string;
    title: string;
    eligibility: string;
    type: string;
    date: string;
    location: string;
    price: string;
    time?: string;
    registeredDetails?: any;
    isPastEvent?: boolean;
}

export interface EventHubPreview {
    eid: string;
    imageSrc?: string;
    description?: string;
    metaDetails?: Record<string, string>;
}

/**
 * One registration the user has made for an EventHub event.
 *
 * The `events/profile` payload has no shape of its own — it is stored as
 * `any[]` in `registeredEventsAtom` and every consumer reads whichever fields
 * it happens to need — so this writes down the subset the calendar relies on.
 * Two things to know about it:
 *
 *  - it names the event in `name`, while a *discovered* event calls the same
 *    thing `title`. That is why every join in the app is on the name string and
 *    not on an id.
 *  - `paymentStatus` is absent on a free event, so "no status" means "nothing
 *    to pay", not "unknown". See `isRegistrationConfirmed` in the calendar.
 */
export interface EventHubRegistration {
    name?: string;
    /** ISO `YYYY-MM-DD`; EventHub's own site renders it as a locale string. */
    date?: string;
    time?: string;
    /** The discovered-event spelling of `location`. */
    venue?: string;
    eid?: string;
    orderId?: string;
    paymentStatus?: string;
    registrationDate?: string;
    certificateEligible?: boolean;
}
