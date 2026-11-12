import type { FastifyInstance } from 'fastify';
import { Prisma } from '@/db/generated/prisma/client.js';

export class TaskRepository {
  constructor(private readonly prisma: FastifyInstance['prisma'] | Prisma.TransactionClient) {}

  async getProjectTaskDefault(
    projectId: string,
  ): Promise<{ status?: string; taskStatusColumnId?: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { company: { select: { trackerDefaultTaskStatusName: true } } },
    });
    const status = project?.company?.trackerDefaultTaskStatusName ?? undefined;
    if (!status) return {};

    const column = await this.prisma.taskStatusColumns.findFirst({
      where: { projectId, name: status },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    return {
      status,
      ...(column ? { taskStatusColumnId: column.id } : {}),
    };
  }

  async getProjectTaskDefaultMap(
    projectIds: string[],
  ): Promise<Map<string, { status?: string; taskStatusColumnId?: string }>> {
    if (!projectIds.length) return new Map();

    const projects = await this.prisma.project.findMany({
      where: { id: { in: projectIds } },
      select: {
        id: true,
        company: { select: { trackerDefaultTaskStatusName: true } },
      },
    });

    const statusFilters = projects.flatMap((project) => {
      const status = project.company?.trackerDefaultTaskStatusName;
      return status ? [{ projectId: project.id, name: status }] : [];
    });

    const columns = statusFilters.length
      ? await this.prisma.taskStatusColumns.findMany({
          where: { OR: statusFilters },
          orderBy: [{ projectId: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          select: { id: true, projectId: true },
        })
      : [];

    const columnIdsByProject = new Map<string, string>();
    for (const column of columns) {
      if (!columnIdsByProject.has(column.projectId)) {
        columnIdsByProject.set(column.projectId, column.id);
      }
    }

    return new Map(
      projects.map((project) => {
        const status = project.company?.trackerDefaultTaskStatusName ?? undefined;
        const columnId = columnIdsByProject.get(project.id);

        return [
          project.id,
          {
            ...(status ? { status } : {}),
            ...(columnId ? { taskStatusColumnId: columnId } : {}),
          },
        ];
      }),
    );
  }
}
