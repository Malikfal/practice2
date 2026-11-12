import { z } from 'zod';
import { ProjectStatus, UserStatus } from '../db/generated/prisma/enums.js';

export const roleSchema = z.string();
export type RoleType = z.infer<typeof roleSchema>;

z.globalRegistry.add(roleSchema, { id: 'Role' });

export const userStatusSchema = z.enum(UserStatus);
export type UserStatusType = z.infer<typeof userStatusSchema>;

z.globalRegistry.add(userStatusSchema, { id: 'UserStatus' });

export const taskStatusSchema = z.enum(['TODO', 'DONE']);
export type TaskStatusType = z.infer<typeof taskStatusSchema>;

z.globalRegistry.add(taskStatusSchema, { id: 'TaskStatus' });

export const projectStatusSchema = z.enum(ProjectStatus);
export type ProjectStatusType = z.infer<typeof projectStatusSchema>;

z.globalRegistry.add(projectStatusSchema, { id: 'ProjectStatus' });

export const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type PriorityType = z.infer<typeof prioritySchema>;

z.globalRegistry.add(prioritySchema, { id: 'Priority' });
