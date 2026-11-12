import Button from '../../../../ui/Button';
import { Field, Input } from '../../../../ui/FormField';
import KnowledgeBaseModalShell from './KnowledgeBaseModalShell';

export type KnowledgeBaseTextInputDialogState = {
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel: string;
  allowEmpty?: boolean;
  onSubmit: (_value: string) => void;
};

type Props = {
  state: KnowledgeBaseTextInputDialogState | null;
  onClose: () => void;
};

export default function KnowledgeBaseTextInputDialog({ state, onClose }: Props) {
  if (!state) return null;

  return (
    <KnowledgeBaseModalShell title={state.title} onClose={onClose}>
      <form
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          state.onSubmit(String(formData.get('value') ?? ''));
          onClose();
        }}
      >
        <Field label={state.label}>
          <Input
            name='value'
            defaultValue={state.defaultValue ?? ''}
            placeholder={state.placeholder}
            autoFocus
            required={!state.allowEmpty}
          />
        </Field>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button type='button' variant='secondary' onClick={onClose}>
            Отмена
          </Button>
          <Button type='submit'>{state.submitLabel}</Button>
        </div>
      </form>
    </KnowledgeBaseModalShell>
  );
}
