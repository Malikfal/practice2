import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { inputBaseClasses } from './FormField';

export default function PasswordInput({
  className = '',
  trailingActions,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  trailingActions?: ReactNode;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className='relative w-full'>
      <input
        {...props}
        type={isVisible ? 'text' : 'password'}
        className={`${inputBaseClasses} pr-10 ${trailingActions ? 'pr-36' : ''} ${className}`}
      />
      {trailingActions ? (
        <div className='absolute top-1/2 right-10 flex -translate-y-1/2 items-center gap-1'>
          {trailingActions}
        </div>
      ) : null}
      <button
        type='button'
        className='absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded text-slate-500 transition-colors duration-150 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400'
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
        onClick={() => setIsVisible((prev) => !prev)}
      >
        {isVisible ? (
          <svg
            viewBox='0 0 24 24'
            aria-hidden='true'
            className='size-4.5 fill-none stroke-current stroke-2'
          >
            <path d='M3 3l18 18' />
            <path d='M10.6 10.6a2 2 0 0 0 2.8 2.8' />
            <path d='M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 9.4 4.1 10 7-.2 1.2-1.2 2.8-2.8 4.2' />
            <path d='M6.3 6.3C4.5 7.6 3.3 9.4 2 12c.7 2.9 4.9 7 10 7 1.1 0 2.2-.2 3.2-.5' />
          </svg>
        ) : (
          <svg
            viewBox='0 0 24 24'
            aria-hidden='true'
            className='size-4.5 fill-none stroke-current stroke-2'
          >
            <path d='M2 12c.7-2.9 4.9-7 10-7s9.3 4.1 10 7c-.7 2.9-4.9 7-10 7S2.7 14.9 2 12z' />
            <circle cx='12' cy='12' r='3' />
          </svg>
        )}
      </button>
    </div>
  );
}
