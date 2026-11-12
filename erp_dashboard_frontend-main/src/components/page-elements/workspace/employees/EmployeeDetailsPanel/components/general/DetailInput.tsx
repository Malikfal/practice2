import type { InputHTMLAttributes } from 'react';

import { Field, Input, SuggestInput } from '../../../../../../ui/FormField';

export default function DetailInput({
  label,
  value,
  placeholder = 'Не указано',
  type = 'text',
  inputMode,
  readOnly = true,
  suggestions,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  readOnly?: boolean;
  suggestions?: string[];
  onChange?: (_value: string) => void;
}) {
  // Поля только для чтения на светлом фоне, чтобы отличались от редактируемых.
  const inputClassName =
    'h-11 rounded-xl border-[#c9d8f8] bg-white text-base text-[#1f3565] placeholder:text-[#9aa8c7] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] read-only:border-[#e3e9f3] read-only:bg-[#f3f7ff] read-only:hover:border-[#e3e9f3] read-only:focus:border-[#e3e9f3] read-only:focus:ring-0 sm:h-10 sm:text-[14px]';
  const hasSuggestions =
    !readOnly && Array.isArray(suggestions) && suggestions.length > 0;

  return (
    <Field label={label} className='text-[#1f3565]'>
      {hasSuggestions ? (
        <SuggestInput
          type={type}
          value={value}
          placeholder={placeholder}
          suggestions={suggestions}
          onValueChange={(next) => onChange?.(next)}
          className={inputClassName}
        />
      ) : (
        <Input
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(event) => onChange?.(event.target.value)}
          className={inputClassName}
        />
      )}
    </Field>
  );
}
