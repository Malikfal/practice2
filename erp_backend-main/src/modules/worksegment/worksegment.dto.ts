import { workSegmentModelSchema } from '@/domain/work-segment.model.js';
import { makeApiResponseSchema } from '@/lib/api-response-schema.js';
import z from 'zod';

export namespace WorkSegmentDto {
  export const addWorkSegmentBodySchema = z.array(
    z.object({
      localSegmentId: z.uuid(), // локальный id сегмента, нужен для сопоставления с серверным id в ответе
      taskId: z.uuid(),
      startedAt: z.coerce.number(),
      endedAt: z.coerce.number(),
    }),
  );
  export const addWorkSegmentResponseSchema = makeApiResponseSchema(
    z.object({
      segments: z.record(z.string(), workSegmentModelSchema),
      ids: z.record(
        z.string(),
        z.object({
          serverSegmentId: z.string().nullable(), // null, если сегмент не был добавлен по какой-то причине
          error: z.string().nullable(),
        }),
      ), // сопоставление localSegmentId с серверным id
    }),
  );

  export const getUserWorkSegmentsQuerySchema = z.object({
    from: z.coerce.number(),
    to: z.coerce.number(),
  });
  export const getUserWorkSegmentsResponseSchema = makeApiResponseSchema(
    z.array(workSegmentModelSchema),
  );
}
