import type { ChangeEvent } from 'react';

import Button from '../../../../../../ui/Button';
import { Field } from '../../../../../../ui/FormField';
import PasswordInput from '../../../../../../ui/PasswordInput';
import type { PasswordForm, User } from '../../../../../../../types/app';

type Props = {
  employee: User;
  canResetPassword: boolean;
  onRequestPasswordReset: (_employee: User) => void;
  mode?: 'employee' | 'self';
  passwordForm?: PasswordForm;
  isUpdatingPassword?: boolean;
  onPasswordFormChange?: (_next: PasswordForm) => void;
  onChangePassword?: () => void;
};

export default function SettingsTab({
  employee,
  canResetPassword,
  onRequestPasswordReset,
  mode = 'employee',
  passwordForm,
  isUpdatingPassword = false,
  onPasswordFormChange,
  onChangePassword,
}: Props) {
  if (mode === 'self' && passwordForm && onPasswordFormChange && onChangePassword) {
    return (
      <div className='grid gap-4'>
        <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4'>
          <div>
            <h3 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[22px] sm:leading-none'>
              Настройки
            </h3>
            <p className='mt-2 text-[14px] text-[#7e8fb4]'>
              Управление доступом сотрудника к аккаунту.
            </p>
          </div>

          <div className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3'>
            <p className='text-[15px] font-semibold text-[#1f3565]'>Смена пароля</p>

            <Field label='Текущий пароль' className='text-[#1f3565]'>
              <PasswordInput
                className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] sm:h-10 sm:text-[14px]'
                value={passwordForm.current_password}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onPasswordFormChange({
                    ...passwordForm,
                    current_password: event.target.value,
                  })
                }
                autoComplete='current-password'
                required
              />
            </Field>

            <Field label='Новый пароль' className='text-[#1f3565]'>
              <PasswordInput
                className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] sm:h-10 sm:text-[14px]'
                value={passwordForm.password}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onPasswordFormChange({
                    ...passwordForm,
                    password: event.target.value,
                  })
                }
                autoComplete='new-password'
                required
              />
            </Field>

            <Field label='Повтор нового пароля' className='text-[#1f3565]'>
              <PasswordInput
                className='h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] sm:h-10 sm:text-[14px]'
                value={passwordForm.password_confirmation}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onPasswordFormChange({
                    ...passwordForm,
                    password_confirmation: event.target.value,
                  })
                }
                autoComplete='new-password'
                required
              />
            </Field>

            <Button
              type='button'
              disabled={isUpdatingPassword}
              className='min-h-11 w-full justify-self-start rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#edf1f7]! disabled:text-[#9aa8c7]! sm:h-10 sm:min-h-0 sm:w-auto'
              onClick={onChangePassword}
            >
              {isUpdatingPassword ? 'Обновление пароля...' : 'Обновить пароль'}
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className='grid gap-4'>
      <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-4'>
        <div>
          <h3 className='text-[22px] leading-none font-semibold text-[#10275a]'>
            Настройки
          </h3>
          <p className='mt-2 text-[14px] text-[#7e8fb4]'>
            Управление доступом сотрудника к аккаунту.
          </p>
        </div>

        <div className='hidden flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e3e9f3] bg-white p-3 lg:flex'>
          <div>
            <p className='text-[15px] font-semibold text-[#1f3565]'>Сброс пароля</p>
            <p className='mt-1 text-[13px] text-[#7e8fb4]'>
              Система сгенерирует новый пароль и покажет его один раз.
            </p>
          </div>
          <Button
            type='button'
            variant='secondary'
            disabled={!canResetPassword}
            className='h-10 rounded-xl border-transparent! bg-[#2d6ff7]! px-4 text-[13px] font-semibold text-white! shadow-sm shadow-[#2d6ff7]/25 hover:bg-[#245fd8]! disabled:bg-[#edf1f7]! disabled:text-[#9aa8c7]!'
            onClick={() => onRequestPasswordReset(employee)}
          >
            Сбросить пароль
          </Button>
        </div>
      </section>
    </div>
  );
}
