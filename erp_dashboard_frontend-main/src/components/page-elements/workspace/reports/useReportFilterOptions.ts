import { useEffect, useState } from 'react';

import { api } from '../../../../api/api';
import type { Project, Task, User } from '../../../../types/app';

type Options = {
  enabled: boolean;
  isWorker: boolean;
  projectIds: string[];
  onError: (_err: unknown) => void;
};

/** Проекты, сотрудники и задачи выбранных проектов для фильтров отчётов по времени. */
export function useReportFilterOptions({
  enabled,
  isWorker,
  projectIds,
  onError,
}: Options) {
  const [employees, setEmployees] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingProjectsAndEmployees, setIsLoadingProjectsAndEmployees] =
    useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const loadLists = async () => {
      try {
        setIsLoadingProjectsAndEmployees(true);
        if (isWorker) {
          const projectData = await api.worker.projects.getMany({
            status: 'all',
            per_page: 1000,
          });
          setEmployees([]);
          setProjects(Array.isArray(projectData.data) ? projectData.data : []);
          return;
        }

        const [employeeData, projectData] = await api.workspace.lists.getAll();
        setEmployees(Array.isArray(employeeData) ? employeeData : []);
        setProjects(Array.isArray(projectData) ? projectData : []);
      } catch (err) {
        onError(err);
      } finally {
        setIsLoadingProjectsAndEmployees(false);
      }
    };

    void loadLists();
  }, [enabled, isWorker, onError]);

  useEffect(() => {
    if (!enabled) return;

    if (projectIds.length === 0) {
      setTasks([]);
      setIsLoadingTasks(false);
      return;
    }

    // Ответ по прежнему набору проектов не должен затереть задачи нового.
    let isCancelled = false;
    const loadTasks = async () => {
      try {
        setIsLoadingTasks(true);
        const requestTasks = isWorker
          ? api.worker.projects.getTasks
          : api.workspace.projects.getTasks;
        const tasksByProject = await Promise.all(
          projectIds.map((projectId) => requestTasks(projectId)),
        );
        const mergedTasks = tasksByProject.flatMap((taskData) =>
          Array.isArray(taskData) ? taskData : [],
        );
        const uniqueTasks = Array.from(
          mergedTasks.reduce<Map<string, Task>>((acc, task) => {
            acc.set(task.id, task);
            return acc;
          }, new Map()),
        ).map(([, task]) => task);

        if (!isCancelled) setTasks(uniqueTasks.filter((task) => !task.is_draft));
      } catch (err) {
        if (isCancelled) return;
        setTasks([]);
        onError(err);
      } finally {
        if (!isCancelled) setIsLoadingTasks(false);
      }
    };

    void loadTasks();
    return () => {
      isCancelled = true;
    };
  }, [enabled, isWorker, onError, projectIds]);

  return { employees, projects, tasks, isLoadingProjectsAndEmployees, isLoadingTasks };
}
