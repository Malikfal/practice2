import { z } from 'zod';
import { userModelSchema } from '../../domain/user.model.js';
import { roleSchema } from '@/domain/enums.js';
import { makeApiResponseSchema } from '@/lib/api-response-schema.js';

export namespace UserDto {
  export const meParamsSchema = z.object({ id: z.uuid() });
  export const meResponseSchema = makeApiResponseSchema(userModelSchema);

  export const usersListResponseSchema = makeApiResponseSchema(z.array(userModelSchema));

  export const updateRoleParamsSchema = z.object({ id: z.uuid() });
  export const updateRoleBodySchema = z.object({ role: roleSchema });
  export const updateRoleResponseSchema = makeApiResponseSchema(userModelSchema);

  export const updatePasswordBodySchema = z.object({
    currentPassword: z.string().min(1).max(255),
    newPassword: z.string().min(6).max(255),
  });
  export const updatePasswordResponseSchema = makeApiResponseSchema(userModelSchema);
}
