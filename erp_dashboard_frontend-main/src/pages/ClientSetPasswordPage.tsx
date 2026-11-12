import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api } from '../api/api';
import Button from '../components/ui/Button';
import { Field } from '../components/ui/FormField';
import PasswordInput from '../components/ui/PasswordInput';

export default function ClientSetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    try {
      setBusy(true);
      await api.client.setPassword(token, password, confirmation);
      window.location.replace('/projects');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить пароль.',
      );
      setBusy(false);
    }
  };

  return (
    <main className='flex min-h-screen w-full items-center justify-center bg-[#f7f9fc] p-5'>
      <form
        className='grid w-full min-w-0 max-w-xl gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)] sm:gap-4 sm:rounded-2xl sm:p-6'
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h1 className='text-lg leading-tight font-semibold text-slate-800 sm:text-base'>
          Установка пароля ФЛОУ
        </h1>
        {!token && (
          <p className='text-sm text-red-600'>
            Ссылка неполная. Попросите менеджера прислать новую ссылку для входа.
          </p>
        )}
        <Field label='Новый пароль'>
          <PasswordInput
            required
            minLength={8}
            autoComplete='new-password'
            className='text-base sm:text-sm'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field label='Повторите пароль'>
          <PasswordInput
            required
            minLength={8}
            autoComplete='new-password'
            className='text-base sm:text-sm'
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </Field>
        <Button type='submit' disabled={busy || !token}>
          {busy ? 'Сохраняем...' : 'Сохранить и войти'}
        </Button>
      </form>
    </main>
  );
}
