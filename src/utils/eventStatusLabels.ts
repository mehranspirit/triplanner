/** UI copy for `event.status === 'exploring'` — data model keeps `exploring`. */
export const EXPLORING_EVENT_UI_LABEL = 'Draft';

export const EXPLORING_EVENT_UI_LABEL_PLURAL = 'Drafts';

export const EXPLORING_EVENT_UI_DESCRIPTION = 'Not booked or confirmed yet';

export const isExploringEventStatus = (status: string | undefined) => status === 'exploring';
