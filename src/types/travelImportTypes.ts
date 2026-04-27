import { Event } from './eventTypes';

export type TravelImportSourceType = 'email_text' | 'pdf_text' | 'manual_text' | 'image_text';
export type TravelImportStatus = 'parsed' | 'failed' | 'accepted' | 'partially_accepted';

export interface TravelImport {
  _id: string;
  tripId: string;
  userId: string;
  sourceType: TravelImportSourceType;
  sourceHash?: string;
  status: TravelImportStatus;
  model?: string;
  parsedEvents: Event[];
  validationErrors: string[];
  createdEventIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTravelImportRequest {
  sourceType?: TravelImportSourceType;
  sourceHash?: string;
  status?: TravelImportStatus;
  model?: string;
  parsedEvents?: Event[];
  validationErrors?: string[];
  createdEventIds?: string[];
}

export interface UpdateTravelImportRequest {
  status?: TravelImportStatus;
  validationErrors?: string[];
  createdEventIds?: string[];
}
