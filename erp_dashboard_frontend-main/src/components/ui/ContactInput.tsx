import { useEffect, useRef } from 'react';

const TELEGRAM_RE = /^@[A-Za-z0-9_]{5,32}$/;
const PHONE_RE = /^\+?\d{10,15}$/;

interface ContactInputProps {
  value: string;
  onChange: (_value: string) => void;
  required?: boolean;
}

function sanitize(raw: string): string {
  const trimmed = raw.replace(/\s+/g, '');
  if (trimmed.startsWith('@')) {
    return (
      '@' +
      trimmed
        .slice(1)
        .replace(/[^A-Za-z0-9_]/g, '')
        .slice(0, 32)
    );
  }
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '').slice(0, 15);
  return (hasPlus ? '+' : '') + digits;
}

export default function ContactInput({
  value,
  onChange,
  required = false,
}: ContactInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (value.length === 0) {
      el.setCustomValidity('');
    } else if (value.startsWith('@')) {
      el.setCustomValidity(
        TELEGRAM_RE.test(value)
          ? ''
          : 'Введите корректный Telegram-ник, например @username',
      );
    } else {
      el.setCustomValidity(
        PHONE_RE.test(value) ? '' : 'Введите телефон (10–15 цифр) или Telegram через @',
      );
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type='text'
      name='phone'
      autoComplete='tel'
      autoCapitalize='none'
      spellCheck={false}
      value={value}
      onChange={(e) => onChange(sanitize(e.target.value))}
      placeholder='+7 999 123-45-67 или @username'
      required={required}
      className='h-11 w-full rounded-lg border border-gray-300 px-3 text-base text-slate-800 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:px-4 sm:text-sm'
    />
  );
}
