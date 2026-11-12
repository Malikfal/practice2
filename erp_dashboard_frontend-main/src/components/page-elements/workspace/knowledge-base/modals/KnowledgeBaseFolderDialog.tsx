import Button from '../../../../ui/Button';
import { Field, Input } from '../../../../ui/FormField';
import type { KnowledgeBaseFolder } from '../../../../../types/app';
import KnowledgeBaseModalShell from './KnowledgeBaseModalShell';

export type KnowledgeBaseFolderDialogState =
  | { mode: 'create'; folder: null }
  | { mode: 'rename'; folder: KnowledgeBaseFolder };

type Props = {
  state: KnowledgeBaseFolderDialogState | null;
  onClose: () => void;
  onSubmit: (_name: string) => void;
};

export default function KnowledgeBaseFolderDialog({ state, onClose, onSubmit }: Props) {
  if (!state) return null;

  const title = state.mode === 'create' ? 'Новая папка' : 'Переименование папки';

  return (
    <KnowledgeBaseModalShell title={title} onClose={onClose}>
      <form
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          onSubmit(String(formData.get('name') ?? ''));
        }}
      >
        <Field label='Название'>
          <Input name='name' defaultValue={state.folder?.name ?? ''} autoFocus required />
        </Field>
        <Button type='submit'>{state.mode === 'create' ? 'Создать' : 'Сохранить'}</Button>
      </form>
    </KnowledgeBaseModalShell>
  );
}
