import Button from '../../../../ui/Button';
import KnowledgeBaseModalShell from './KnowledgeBaseModalShell';

export type KnowledgeBaseConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

type Props = {
  state: KnowledgeBaseConfirmDialogState | null;
  onClose: () => void;
};

export default function KnowledgeBaseConfirmDialog({ state, onClose }: Props) {
  if (!state) return null;

  return (
    <KnowledgeBaseModalShell title={state.title} onClose={onClose}>
      <div className='grid gap-4'>
        <p className='text-sm leading-6 text-[#1f3565]'>{state.message}</p>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Отмена
          </Button>
          <Button
            type='button'
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => {
              state.onConfirm();
              onClose();
            }}
          >
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </KnowledgeBaseModalShell>
  );
}
