import z from 'zod';

export const apiErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const makeApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    ok: z.union([z.literal(true), z.literal(false)]),
    data: dataSchema.nullable(),
    error: apiErrorSchema.nullable(),
  });

export type ApiResponse<T> = z.infer<
  T extends z.ZodType
    ? ReturnType<typeof makeApiResponseSchema<T>>
    : ReturnType<typeof makeApiResponseSchema<z.ZodUnknown>>
>;
