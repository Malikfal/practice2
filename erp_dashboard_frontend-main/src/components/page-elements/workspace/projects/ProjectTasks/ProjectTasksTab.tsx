import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import ConfirmDialog from '../../../../modals/ConfirmDialog';
import TaskStatusColumnModal from '../../../../modals/TaskStatusColumnModal';
import type {
  Project,
  TaskStatusColumn,
  TaskStatusColumnForm,
} from '../../../../../types/app';
import ProjectTaskBoard from './ProjectTaskBoard';
import ProjectTaskEditorModal from './ProjectTaskEditorModal';
import { projectTasksStore, useProjectTasksStore } from './projectTasksStore';
import { pickDefaultColumnId } from './taskUtils';

type Props = {
  selectedProject: Project;
  requestedTaskId?: string;
  onSelectedTaskIdChange?: (_taskId: string) => void;
  canCreateUpdateTasks: boolean;
  canMoveTasks: boolean;
  canCreateUpdateTaskStatuses: boolean;
  canDeleteTaskStatuses: boolean;
  currentUserId: string;
  canDeleteAnyComment: boolean;
  canDeleteOwnComment: boolean;
  canDeleteAnyAttachments: boolean;
  canDeleteOwnAttachments: boolean;
  canViewClientTab?: boolean;
  canViewClientComments?: boolean;
  canReplyToClient?: boolean;
  canUpdateClientStatus?: boolean;
  canManageClientLink?: boolean;
};

export default function ProjectTasksTab({
  selectedProject,
  requestedTaskId = '',
  onSelectedTaskIdChange,
  canCreateUpdateTasks,
  canMoveTasks,
  canCreateUpdateTaskStatuses,
  canDeleteTaskStatuses,
  currentUserId,
  canDeleteAnyComment,
  canDeleteOwnComment,
  canDeleteAnyAttachments,
  canDeleteOwnAttachments,
  canViewClientTab,
  canViewClientComments,
  canReplyToClient,
  canUpdateClientStatus,
  canManageClientLink,
}: Props) {
  const selectedProjectId = selectedProject.id;
  const board = useProjectTasksStore(selectedProjectId);
  const taskColumns = board.columns;
  const projectTasks = board.tasks;
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<TaskStatusColumn | null>(null);
  const [isSavingColumn, setIsSavingColumn] = useState(false);
  const [columnToDelete, setColumnToDelete] = useState<TaskStatusColumn | null>(null);
  const [isDeletingColumn, setIsDeletingColumn] = useState(false);

  const handleError = useCallback((error: unknown) => {
    toast.error(error instanceof Error ? error.message : 'Произошла ошибка.');
  }, []);

  useEffect(() => {
    void projectTasksStore
      .loadBoard(selectedProjectId, { force: true })
      .catch(handleError);
  }, [handleError, selectedProjectId]);

  const onMoveTask = useCallback(
    (
      taskId: string,
      statusColumnId: string,
      destinationIndex: number,
      beforeTaskId?: string,
      afterTaskId?: string,
    ) => {
      if (!canMoveTasks || !selectedProjectId) return;
      void projectTasksStore.moveTask(
        selectedProjectId,
        taskId,
        statusColumnId,
        destinationIndex,
        beforeTaskId,
        afterTaskId,
      );
    },
    [canMoveTasks, selectedProjectId],
  );

  const onMoveColumn = useCallback(
    async (columnId: string, destinationIndex: number) => {
      if (!canCreateUpdateTaskStatuses || !selectedProjectId) return;
      try {
        await projectTasksStore.reorderColumn(
          selectedProjectId,
          columnId,
          destinationIndex,
        );
      } catch (error) {
        handleError(error);
      }
    },
    [canCreateUpdateTaskStatuses, handleError, selectedProjectId],
  );

  const openCreateColumnModal = () => {
    if (!canCreateUpdateTaskStatuses) return;
    setEditingColumn(null);
    setIsColumnModalOpen(true);
  };

  const openEditColumnModal = (column: TaskStatusColumn) => {
    if (!canCreateUpdateTaskStatuses) return;
    setEditingColumn(column);
    setIsColumnModalOpen(true);
  };

  const saveColumn = async (form: TaskStatusColumnForm) => {
    if (!canCreateUpdateTaskStatuses) return;

    try {
      setIsSavingColumn(true);
      await projectTasksStore.saveColumn(selectedProjectId, form, editingColumn?.id);
      toast.success(editingColumn ? 'Колонка обновлена.' : 'Колонка создана.');
      setIsColumnModalOpen(false);
      setEditingColumn(null);
    } catch (error) {
      handleError(error);
    } finally {
      setIsSavingColumn(false);
    }
  };

  const requestDeleteColumn = (column: TaskStatusColumn) => {
    if (!canDeleteTaskStatuses) return;
    setColumnToDelete(column);
  };

  const confirmDeleteColumn = async () => {
    if (!columnToDelete) return;

    try {
      setIsDeletingColumn(true);
      await projectTasksStore.deleteColumn(selectedProjectId, columnToDelete.id);
      toast.success('Колонка удалена.');
      setColumnToDelete(null);
    } catch (error) {
      handleError(error);
    } finally {
      setIsDeletingColumn(false);
    }
  };

  return (
    <>
      <ProjectTaskEditorModal
        selectedProject={selectedProject}
        requestedTaskId={requestedTaskId}
        onSelectedTaskIdChange={onSelectedTaskIdChange}
        canCreateUpdateTasks={canCreateUpdateTasks}
        canMoveTasks={canMoveTasks}
        currentUserId={currentUserId}
        canDeleteAnyComment={canDeleteAnyComment}
        canDeleteOwnComment={canDeleteOwnComment}
        canDeleteAnyAttachments={canDeleteAnyAttachments}
        canDeleteOwnAttachments={canDeleteOwnAttachments}
        canViewClientTab={canViewClientTab}
        canViewClientComments={canViewClientComments}
        canReplyToClient={canReplyToClient}
        canUpdateClientStatus={canUpdateClientStatus}
        canManageClientLink={canManageClientLink}
      >
        {({ openEditTaskModal, openNewTaskModal }) => (
          <ProjectTaskBoard
            tasks={projectTasks}
            columns={taskColumns}
            members={selectedProject.members ?? []}
            isLoading={board.isLoading && !board.hasLoaded}
            isTaskDragBlocked={board.isChangingColumns}
            isColumnDragBlocked={board.pendingMoveCount > 0 || board.isChangingColumns}
            canCreateTasks={canCreateUpdateTasks}
            canMoveTasks={canMoveTasks}
            canCreateUpdateColumns={canCreateUpdateTaskStatuses}
            canDeleteColumns={canDeleteTaskStatuses}
            onMoveTask={onMoveTask}
            onMoveColumn={onMoveColumn}
            onOpenTask={openEditTaskModal}
            onCreateTaskInColumn={(column) => {
              if (!canCreateUpdateTasks) return;
              const columnId =
                column?.id ??
                pickDefaultColumnId(
                  taskColumns,
                  selectedProject.tracker_default_status_name,
                );
              openNewTaskModal({ status_column_id: columnId || null });
            }}
            onCreateColumn={openCreateColumnModal}
            onEditColumn={openEditColumnModal}
            onDeleteColumn={requestDeleteColumn}
          />
        )}
      </ProjectTaskEditorModal>

      {canCreateUpdateTaskStatuses && (
        <TaskStatusColumnModal
          isOpen={isColumnModalOpen}
          isSaving={isSavingColumn}
          initialColumn={editingColumn}
          onClose={() => {
            if (isSavingColumn) return;
            setIsColumnModalOpen(false);
            setEditingColumn(null);
          }}
          onSave={saveColumn}
        />
      )}

      {canDeleteTaskStatuses && (
        <ConfirmDialog
          isOpen={Boolean(columnToDelete)}
          isProcessing={isDeletingColumn}
          title='Удалить колонку'
          message={`Вы уверены, что хотите удалить колонку «${
            columnToDelete?.name ?? columnToDelete?.label ?? ''
          }»? Это действие нельзя отменить.`}
          confirmLabel='Удалить'
          onClose={() => {
            if (isDeletingColumn) return;
            setColumnToDelete(null);
          }}
          onConfirm={() => void confirmDeleteColumn()}
        />
      )}
    </>
  );
}
