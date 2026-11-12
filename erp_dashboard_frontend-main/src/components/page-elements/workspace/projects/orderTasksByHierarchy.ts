type HierarchyTask = { id: string; parent_task_id?: string | null };

/**
 * Подзадачи идут сразу за родителем; порядок внутри уровня сохраняется.
 * Задача, чей родитель не попал в список, остаётся на верхнем уровне.
 */
export function orderTasksByHierarchy<TTask extends HierarchyTask>(
  tasks: readonly TTask[],
): TTask[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const childrenByParent = new Map<string, TTask[]>();
  const roots: TTask[] = [];

  for (const task of tasks) {
    const parentId = task.parent_task_id ?? null;
    if (!parentId || !taskIds.has(parentId)) {
      roots.push(task);
      continue;
    }
    const list = childrenByParent.get(parentId) ?? [];
    list.push(task);
    childrenByParent.set(parentId, list);
  }

  const result: TTask[] = [];
  const visit = (task: TTask) => {
    result.push(task);
    const children = childrenByParent.get(task.id) ?? [];
    children.forEach(visit);
  };

  roots.forEach(visit);
  return result;
}
