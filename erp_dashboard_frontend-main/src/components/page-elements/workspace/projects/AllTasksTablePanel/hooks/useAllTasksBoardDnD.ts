import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { api } from '../../../../../../api/api';
import type { User, UserBoardTask } from '../../../../../../types/app';
import { allTasksBoardStore } from '../allTasksBoardStore';
import type { Bucket, DraggedTask, DropTarget, GroupBy } from '../types';

type PendingAssigneeMove = {
  task: UserBoardTask;
  search: string;
  sourceAssigneeId: string;
  targetAssignee: User;
};

type UseAllTasksBoardDnDParams = {
  search: string;
  groupBy: GroupBy;
  kanbanColumns: Bucket[];
  tasks: UserBoardTask[];
};

export function useAllTasksBoardDnD({
  search,
  groupBy,
  kanbanColumns,
  tasks,
}: UseAllTasksBoardDnDParams) {
  const [draggedTask, setDraggedTask] = useState<DraggedTask | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [membershipPrompts, setMembershipPrompts] = useState<PendingAssigneeMove[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const membershipPrompt = membershipPrompts[0] ?? null;

  const handleMoveTask = useCallback(
    async (
      taskId: string,
      sourceColumnKey: string,
      targetColumnKey: string,
      dropIndex: number,
    ) => {
      setDraggedTask(null);
      setDropTarget(null);
      if (!taskId || !targetColumnKey) return;
      const task = tasks.find((candidate) => candidate.id === taskId);
      if (!task || !task.project?.id) return;

      if (groupBy === 'status') {
        if (targetColumnKey.startsWith('__')) return;
        const bucket = kanbanColumns.find((column) => column.key === targetColumnKey);
        const column = bucket?.statusColumn;
        if (!column?.slug) return;
        const visible = (bucket?.tasks ?? []).filter(
          (candidate) => candidate.id !== taskId,
        );
        const clamped = Math.max(0, Math.min(dropIndex, visible.length));
        const sameProject = (candidate: UserBoardTask) =>
          candidate.project?.id === task.project?.id;
        const destinationIndex = visible.slice(0, clamped).filter(sameProject).length;
        const beforeTaskId = visible.slice(clamped).find(sameProject)?.id;
        const afterTaskId = visible.slice(0, clamped).reverse().find(sameProject)?.id;
        const currentIndex = tasks
          .filter(
            (candidate) =>
              sameProject(candidate) && candidate.status_column?.slug === column.slug,
          )
          .findIndex((candidate) => candidate.id === taskId);
        if (
          task.status_column?.slug === column.slug &&
          currentIndex === destinationIndex
        ) {
          return;
        }
        void allTasksBoardStore.moveByStatus({
          task,
          search,
          column,
          destinationIndex,
          beforeTaskId,
          afterTaskId,
        });
        return;
      }

      if (groupBy === 'priority') {
        const priority =
          kanbanColumns.find((column) => column.key === targetColumnKey)?.priority ??
          null;
        if ((task.priority ?? null) === priority) return;
        void allTasksBoardStore.moveByPriority({ task, search, priority });
        return;
      }

      const sourceAssigneeId = sourceColumnKey.startsWith('__') ? '' : sourceColumnKey;
      const targetAssigneeId = targetColumnKey.startsWith('__') ? '' : targetColumnKey;
      const targetAssignee =
        kanbanColumns.find((column) => column.key === targetAssigneeId)?.assignee ?? null;
      if (targetAssigneeId && !targetAssignee) return;
      if (sourceAssigneeId === targetAssigneeId) return;

      if (targetAssignee && task.project?.id) {
        try {
          const details = await api.workspace.projects.getDetails(task.project.id);
          const isMember = (details.project?.members ?? []).some(
            (member) => member.user?.id === targetAssignee.id,
          );
          if (!isMember) {
            setMembershipPrompts((previous) => [
              ...previous,
              { task, search, sourceAssigneeId, targetAssignee },
            ]);
            return;
          }
        } catch {
          toast.error('Не удалось проверить участников проекта.');
          return;
        }
      }
      void allTasksBoardStore.moveByAssignee({
        task,
        search,
        sourceAssigneeId,
        targetAssignee,
        addMember: false,
      });
    },
    [groupBy, kanbanColumns, search, tasks],
  );

  const confirmAddMember = useCallback(async () => {
    if (!membershipPrompt || isAddingMember) return;
    setIsAddingMember(true);
    try {
      const succeeded = await allTasksBoardStore.moveByAssignee({
        ...membershipPrompt,
        addMember: true,
      });
      if (succeeded) {
        setMembershipPrompts((previous) =>
          previous.filter((prompt) => prompt !== membershipPrompt),
        );
      }
    } finally {
      setIsAddingMember(false);
    }
  }, [isAddingMember, membershipPrompt]);

  const dismissMembershipPrompt = useCallback(() => {
    if (isAddingMember) return;
    setMembershipPrompts((previous) => previous.slice(1));
  }, [isAddingMember]);

  return {
    canDragTasks: true,
    draggedTask,
    dropTarget,
    membershipPrompt,
    isAddingMember,
    confirmAddMember,
    dismissMembershipPrompt,
    setDraggedTask,
    setDropTarget,
    handleMoveTask,
  };
}
