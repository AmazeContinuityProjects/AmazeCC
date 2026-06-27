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
