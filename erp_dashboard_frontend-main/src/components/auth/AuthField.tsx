import { Fragment, type ReactNode } from 'react';

import { Field } from '../ui/FormField';

// Базовые классы поля задают серую рамку, поэтому красную ставим с приоритетом.
export const authInputErrorClasses =
  'border-rose-400! hover:border-rose-500! focus:border-rose-500! focus:ring-rose-200!';

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className='text-[12px] leading-tight text-rose-600'>
      {message}
    </span>
  );
}

/**
 * Поле формы входа и регистрации: подпись, поле и под ним ошибка или подсказка.
 * Подсказка прячется, пока показана ошибка. content-start держит соседние поля
 * на одной линии, когда ошибка есть только у одного из них.
 */
export default function AuthField({
  label,
  error,
  errorId,
  hint,
  errorActions,
  children,
}: {
  label: string;
  error?: string;
  errorId?: string;
  hint?: ReactNode;
  /** Ссылки под ошибкой, например «Войти» для занятой почты. */
  errorActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='grid min-w-0 content-start gap-1.5'>
      <Field label={label}>{children}</Field>
      {error ? (
        <>
          <FieldError id={errorId} message={error} />
          {errorActions}
        </>
      ) : hint ? (
        <span className='text-[12px] leading-tight text-slate-500'>{hint}</span>
      ) : null}
    </div>
  );
}

/**
 * Почта, которая переносится перед «@» и точками, а не посреди слова.
 * break-words остаётся запасным вариантом для очень длинного имени ящика.
 */
export function EmailText({ email }: { email: string }) {
  const parts = email.split(/(?=[@.])/);
  return (
    <span className='break-words'>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
