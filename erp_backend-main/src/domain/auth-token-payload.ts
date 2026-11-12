import { z } from 'zod';
import { roleSchema } from './enums.js';

export const authTokenPayloadSchema = z.object({
  id: z.string(),
  role: roleSchema.nullable(),
  device: z.enum(['web', 'mobile', 'desktop']),
});

export type AuthTokenPayloadType = z.infer<typeof authTokenPayloadSchema>;
