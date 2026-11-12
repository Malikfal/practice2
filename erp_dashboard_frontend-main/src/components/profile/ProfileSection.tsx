import type { ChangeEvent } from 'react';

import Button from '../ui/Button';
import { Field, Input } from '../ui/FormField';
import type { ProfileForm } from '../../types/app';

export default function ProfileSection({
  form,
  isUpdatingProfile,
  onChange,
  onSubmit,
}: {
  form: ProfileForm;
  isUpdatingProfile: boolean;
  onChange: (_next: ProfileForm) => void;
  onSubmit: () => void;
}) {
  return (
    <section className='grid gap-3 rounded-2xl border border-slate-200 bg-white p-4'>
      <h2 className='text-base font-semibold text-slate-800'>Профиль</h2>
      <Field label='Имя'>
        <Input
          value={form.first_name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, first_name: e.target.value })
          }
          required
        />
      </Field>
      <Field label='Фамилия'>
        <Input
          value={form.last_name}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange({ ...form, last_name: e.target.value })
          }
          required
        />
      </Field>
      <Button
        onClick={onSubmit}
        type='button'
        size='md'
        className='justify-self-start h-9 px-4 text-sm'
        disabled={isUpdatingProfile}
        variant={isUpdatingProfile ? 'secondary' : 'primary'}
      >
        {isUpdatingProfile ? 'Сохранение профиля...' : 'Сохранить профиль'}
      </Button>
    </section>
  );
}
