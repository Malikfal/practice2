import { useState } from 'react';

import TaskActivityPanel from './TaskActivityPanel';
import TaskCommentsPanel from './TaskCommentsPanel';
import TaskAttachmentsPanel from './TaskAttachmentsPanel';
import TaskClientPanel from './TaskClientPanel';
import ProBadge from '../../../tariff/ProBadge';
import ProFeatureLock from '../../../tariff/ProFeatureLock';
import { useTariffAccess } from '../../../../hooks/useTariffAccess';
import { joinClassNames } from '../shared';
import type { User } from '../../../../types/app';

type SideTab = 'comments' | 'client' | 'history' | 'attachments';

export default function TaskSidePanel({
  taskId,
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
  mentionUsers,
}: {
  taskId: string;
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
  mentionUsers?: User[];
}) {
  const [activeTab, setActiveTab] = useState<SideTab>('comments');
  const tariffAccess = useTariffAccess();
  // На ФРИ клиентский доступ закрыт: вкладка остаётся с меткой «ПРО», переписку не грузим.
  const isClientTabProLocked =
    !canViewClientTab &&
    tariffAccess.isPermissionLocked('projects.tabs.tasks.client.view');
  const hasClientTab = Boolean(canViewClientTab) || isClientTabProLocked;

  const tabClassName = (tab: SideTab) =>
    joinClassNames(
      'min-w-0 w-full truncate rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors sm:px-3 text-center',
      activeTab === tab
        ? 'bg-white text-blue-600 shadow-sm'
        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50',
    );

  return (
    <div className='flex h-full flex-1 min-h-[320px] min-w-0 flex-col gap-2 lg:min-h-0'>
      <div
        className={joinClassNames(
          'grid gap-1 overflow-hidden rounded-lg bg-slate-100 p-1',
          hasClientTab ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        <button
          type='button'
          className={tabClassName('comments')}
          onClick={() => setActiveTab('comments')}
        >
          Комментарии
        </button>
        {hasClientTab ? (
          <button
            type='button'
            className={joinClassNames(
              tabClassName('client'),
              isClientTabProLocked && 'inline-flex items-center justify-center gap-1.5',
            )}
            onClick={() => setActiveTab('client')}
          >
            Клиент
            {isClientTabProLocked ? <ProBadge /> : null}
          </button>
        ) : null}
        <button
          type='button'
          className={tabClassName('history')}
          onClick={() => setActiveTab('history')}
        >
          История
        </button>
        <button
          type='button'
          className={tabClassName('attachments')}
          onClick={() => setActiveTab('attachments')}
        >
          Вложения
        </button>
      </div>

      <div
        className={joinClassNames(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          activeTab !== 'comments' && 'hidden',
        )}
      >
        <TaskCommentsPanel
          taskId={taskId}
          currentUserId={currentUserId}
          canDeleteAnyComment={canDeleteAnyComment}
          canDeleteOwnComment={canDeleteOwnComment}
          mentionUsers={mentionUsers}
        />
      </div>

      {canViewClientTab ? (
        <div
          className={joinClassNames(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            activeTab !== 'client' && 'hidden',
          )}
        >
          <TaskClientPanel
            taskId={taskId}
            canViewComments={!!canViewClientComments}
            canReply={!!canReplyToClient}
          />
        </div>
      ) : isClientTabProLocked && activeTab === 'client' ? (
        <div className='min-h-0 min-w-0 flex-1 overflow-auto'>
          <ProFeatureLock feature='client_access' screen='task_client' variant='inline' />
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden'>
          <TaskActivityPanel
            taskId={taskId}
            canViewClientTab={canViewClientTab}
            canViewClientComments={canViewClientComments}
            canUpdateClientStatus={canUpdateClientStatus}
            canManageClientLink={canManageClientLink}
          />
        </div>
      ) : null}

      {activeTab === 'attachments' ? (
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden'>
          <TaskAttachmentsPanel
            taskId={taskId}
            currentUserId={currentUserId}
            canDeleteAnyAttachment={canDeleteAnyAttachments}
            canDeleteOwnAttachment={canDeleteOwnAttachments}
          />
        </div>
      ) : null}
    </div>
  );
}
