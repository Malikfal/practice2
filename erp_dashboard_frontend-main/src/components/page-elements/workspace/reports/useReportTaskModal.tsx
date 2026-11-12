import { useCallback, useMemo, useState } from 'react';

import ProjectTaskEditorModal from '../projects/ProjectTasks/ProjectTaskEditorModal';
import { projectTasksStore } from '../projects/ProjectTasks/projectTasksStore';
import { useAppControllerContext } from '../../../../context/AppControllerContext';
import type { Project } from '../../../../types/app';

type ReportTaskRow = {
  project_id: string;
  project_name: string | null;
  task_id: string;
};

type Options = {
  projects: Project[];
  isWorker: boolean;
  onError: (_err: unknown) => void;
};

/** Открывает карточку задачи из строки отчёта поверх отчёта. */
export function useReportTaskModal({ projects, isWorker, onError }: Options) {
  const { user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [requestedTaskId, setRequestedTaskId] = useState('');

  const projectIndex = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );

  const openTask = useCallback(
    async (row: ReportTaskRow) => {
      const project: Project = projectIndex.get(row.project_id) ?? {
        id: row.project_id,
        default_entrance_finance_article_id: null,
        name: row.project_name || 'Проект',
        latest_activity_period: null,
        created_by_id: '',
        members: [],
        exclude_from_payroll: false,
        payroll_exclusion_scope: 'ALL',
        payroll_excluded_employee_ids: [],
      };

      try {
        await projectTasksStore.loadBoard(row.project_id, {
          worker: isWorker,
          force: true,
        });
        setActiveProject(project);
        setRequestedTaskId(row.task_id);
      } catch (err) {
        onError(err);
      }
    },
    [isWorker, onError, projectIndex],
  );

  const taskModal = activeProject ? (
    <ProjectTaskEditorModal
      selectedProject={activeProject}
      requestedTaskId={requestedTaskId}
      onSelectedTaskIdChange={(taskId) => {
        setRequestedTaskId(taskId);
        if (!taskId) {
          setActiveProject(null);
        }
      }}
      canCreateUpdateTasks={userPermissions.includes('tasks.create_update')}
      canMoveTasks={userPermissions.includes('tasks.move')}
      currentUserId={user?.id ?? ''}
      canDeleteAnyComment={userPermissions.includes(
        'projects.tabs.tasks.comments.delete_all',
      )}
      canDeleteOwnComment={userPermissions.includes(
        'projects.tabs.tasks.comments.delete_self',
      )}
      canDeleteAnyAttachments={userPermissions.includes(
        'projects.tabs.tasks.attachments.delete_all',
      )}
      canDeleteOwnAttachments={userPermissions.includes(
        'projects.tabs.tasks.attachments.delete_self',
      )}
      syncTaskIdInUrl={false}
    />
  ) : null;

  return { openTask, taskModal };
}
