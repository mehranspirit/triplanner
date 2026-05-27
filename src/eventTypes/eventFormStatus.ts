import { z } from 'zod';

export const eventFormStatusSchema = z.enum(['confirmed', 'exploring', 'alternative']).default('exploring');

export type EventFormStatus = z.infer<typeof eventFormStatusSchema>;
