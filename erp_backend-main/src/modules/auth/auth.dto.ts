import { userModelSchema } from '@/domain/user.model.js';
import { makeApiResponseSchema } from '@/lib/api-response-schema.js';
import { z } from 'zod';

export namespace AuthDto {
  export const registerBodySchema = z.object({
    email: z.email().max(255),
    name: z.string().trim().min(1).max(255),
    password: z.string().min(6).max(255),
  });

  export const registerResponseSchema = makeApiResponseSchema(
    z.object({
      accessToken: z.string(),
      refreshToken: z.string(),
      user: userModelSchema,
    }),
  );

  export const loginBodySchema = z.object({
    email: z.email().max(255),
    password: z.string().min(1).max(255),
  });

  export const loginResponseSchema = makeApiResponseSchema(
    z.object({
      accessToken: z.string(),
      refreshToken: z.string(),
      user: userModelSchema,
    }),
  );

  export const refreshTokenBodySchema = z.object({
    refreshToken: z.string(),
  });

  export const refreshTokenResponseSchema = makeApiResponseSchema(
    z.object({
      accessToken: z.string(),
      refreshToken: z.string(),
    }),
  );
}
