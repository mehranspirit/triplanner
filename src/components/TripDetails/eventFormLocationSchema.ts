import { z } from 'zod';

export const eventLocationPointSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
  quality: z.enum(['exact', 'inferred', 'unresolved', 'missing']).optional(),
  source: z.enum(['manual', 'geocoded', 'imported', 'unknown', 'google_places']).optional(),
  confidence: z.number().optional(),
  placeId: z.string().optional(),
  query: z.string().optional(),
}).optional();

export const transportEndpointLocationSchema = eventLocationPointSchema;
