import type { ChangeEvent } from 'react';

import { Input } from '../../../ui/FormField';

export default function PasswordGeneratorField({
  value,
  onChange,
  onGeneratePassword,
}: {
  value: string;
  onChange: (_value: string) => void;
  onGeneratePassword?: () => void;
}) {
  return (
    <div className='rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3'>
      <div className='mb-2 text-[13px] leading-none font-medium text-[#1f3565]'>
        Генерация пароля
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)_48px] gap-2'>
        <Input
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChange(event.target.value)
          }
          autoComplete='new-password'
          required
          placeholder='Сгенерируйте пароль'
          className='rounded-xl border-[#e3e9f3] text-[#1f3565] placeholder:text-[#7e8fb4] hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-[#edf3ff]'
        />
        <button
          type='button'
          className='grid h-11 place-items-center rounded-xl border border-[#bad0ff] bg-[#edf3ff] text-[#2d6ff7] transition-colors hover:bg-[#e5eeff]'
          onClick={onGeneratePassword}
          aria-label='Сгенерировать пароль'
          title='Сгенерировать пароль'
        >
          <svg
            viewBox='0 0 24 24'
            className='size-5 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]'
            aria-hidden='true'
          >
            <path d='M21 12a9 9 0 1 1-2.64-6.36' />
            <path d='M21 3v6h-6' />
          </svg>
        </button>
      </div>
    </div>
  );
}
