import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  ChangeEvent,
  CSSProperties,
  KeyboardEvent,
  RefObject,
  TextareaHTMLAttributes,
} from 'react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  extractPhoneDigits,
  formatPhoneNumber,
  isValidPhone,
} from '../../utils/formatters';

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function useDropdownStyle(
  anchorRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  offset = 6,
) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;
      const width = Math.min(rect.width, Math.max(0, viewportWidth - margin * 2));
      const left = Math.max(margin, Math.min(rect.left, viewportWidth - width - margin));
      const spaceBelow = viewportHeight - rect.bottom - offset - margin;
      const spaceAbove = rect.top - offset - margin;
      const openAbove = spaceBelow < 224 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(0, openAbove ? spaceAbove : spaceBelow);

      setStyle({
        position: 'fixed',
        top: openAbove ? undefined : rect.bottom + offset,
        bottom: openAbove ? viewportHeight - rect.top + offset : undefined,
        left,
        width,
        maxHeight: Math.min(224, availableHeight),
      });
    };

    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, isOpen, offset]);

  return style;
}

function renderDropdown(dropdown: ReactNode) {
  if (typeof document === 'undefined') return dropdown;

  return createPortal(dropdown, document.body);
}

export const inputBaseClasses =
  'h-11 min-w-0 max-w-full w-full rounded-lg border border-slate-300 bg-white px-3 text-sm leading-5 text-slate-800 transition-colors duration-150 hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-200';

export const clientInputClasses =
  'h-11 w-full rounded-xl border border-[#e3e9f3] bg-white px-3 py-2 text-[14px] text-[#1f3565] outline-none transition-colors placeholder:text-[#7e8fb4]';

export const clientInputStateClasses =
  'hover:border-[#c9d8f8] focus:border-[#2d6ff7] focus:ring-2 focus:ring-[#edf3ff]';

const phoneInputBaseClasses = `${clientInputClasses} ${clientInputStateClasses} disabled:cursor-not-allowed disabled:border-[#e3e9f3] disabled:bg-[#f3f7ff] disabled:text-[#7e8fb4] disabled:hover:border-[#e3e9f3]`;

export const labelBaseClasses = 'grid gap-1.5 text-sm text-slate-800';

const selectClasses = 'appearance-none pr-9';

const selectArrowStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M5 7.5L10 12.5L15 7.5' stroke='%23657387' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundSize: '14px',
  backgroundPosition: 'right 14px center',
};

export function Field({
  label,
  className = '',
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={joinClassNames(labelBaseClasses, className)}>
      <span className='text-[13px] leading-tight font-medium text-slate-700'>
        {label}
      </span>
      {children}
    </label>
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input className={joinClassNames(inputBaseClasses, className)} {...props} />;
}

export function PhoneInput({
  value,
  onValueChange,
  className = '',
  readOnly = false,
  errorMessage = 'Введите номер в формате +7 (XXX) XXX-XX-XX',
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (_next: string) => void;
  className?: string;
  errorMessage?: string;
}) {
  const [touched, setTouched] = useState(false);
  const displayValue = formatPhoneNumber(value);
  const isInvalid = !readOnly && touched && !!value && !isValidPhone(value);

  return (
    <>
      <input
        {...inputProps}
        type='tel'
        inputMode='numeric'
        autoComplete='tel'
        value={displayValue}
        readOnly={readOnly}
        onChange={(event) => {
          const nextInput = event.target.value;
          let digits = extractPhoneDigits(nextInput);
          let nextFormatted = formatPhoneNumber(digits);
          if (nextInput.length < displayValue.length && nextFormatted === displayValue) {
            digits = digits.slice(0, -1);
            nextFormatted = formatPhoneNumber(digits);
          }
          onValueChange(nextFormatted);
        }}
        onKeyDown={(event) => {
          inputProps.onKeyDown?.(event);
        }}
        onBlur={(event) => {
          setTouched(true);
          inputProps.onBlur?.(event);
        }}
        className={joinClassNames(
          phoneInputBaseClasses,
          isInvalid ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : '',
          className,
        )}
      />
      {isInvalid ? (
        <span className='text-[12px] leading-tight text-rose-600'>{errorMessage}</span>
      ) : null}
    </>
  );
}

export function SuggestInput({
  value,
  onValueChange,
  suggestions = [],
  className = '',
  readOnly = false,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (_next: string) => void;
  suggestions?: string[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const normalizedValue = value.trim().toLowerCase();
  const hasExactMatch = useMemo(
    () =>
      !!normalizedValue &&
      suggestions.some((option) => option.trim().toLowerCase() === normalizedValue),
    [normalizedValue, suggestions],
  );
  const filteredSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    const skipFilter = showAll || hasExactMatch;
    for (const option of suggestions) {
      const normalizedOption = option.trim();
      if (!normalizedOption) continue;
      const key = normalizedOption.toLowerCase();
      if (seen.has(key)) continue;
      if (!skipFilter && normalizedValue && !key.includes(normalizedValue)) continue;
      seen.add(key);
      result.push(normalizedOption);
    }
    return result;
  }, [normalizedValue, suggestions, showAll, hasExactMatch]);

  const showDropdown = !readOnly && isOpen && filteredSuggestions.length > 0;
  const dropdownStyle = useDropdownStyle(containerRef, showDropdown, 4);

  return (
    <div ref={containerRef} className='relative'>
      <input
        {...inputProps}
        ref={inputRef}
        value={value}
        readOnly={readOnly}
        onFocus={(event) => {
          setIsOpen(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          window.setTimeout(() => {
            if (
              !containerRef.current?.contains(document.activeElement) &&
              !dropdownRef.current?.contains(document.activeElement)
            ) {
              setIsOpen(false);
              setShowAll(false);
            }
          }, 0);
          inputProps.onBlur?.(event);
        }}
        onChange={(event) => {
          onValueChange(event.target.value);
          setShowAll(false);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (isOpen) event.preventDefault();
            setIsOpen(false);
            setShowAll(false);
          }
          inputProps.onKeyDown?.(event);
        }}
        className={joinClassNames(inputBaseClasses, 'pr-9', className)}
      />
      {!readOnly && suggestions.length > 0 ? (
        <button
          type='button'
          className='absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center text-slate-400'
          tabIndex={-1}
          aria-hidden='true'
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setIsOpen((prev) => {
              const next = !prev;
              setShowAll(next);
              if (next) inputRef.current?.focus();
              return next;
            });
          }}
        >
          <svg
            viewBox='0 0 20 20'
            className={`size-4 fill-none stroke-current stroke-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d='M5 7.5L10 12.5L15 7.5' />
          </svg>
        </button>
      ) : null}
      {showDropdown && dropdownStyle
        ? renderDropdown(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className='z-2000 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            >
              {filteredSuggestions.map((option) => (
                <button
                  key={option}
                  type='button'
                  className='flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100'
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onValueChange(option);
                    setIsOpen(false);
                    setShowAll(false);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>,
          )
        : null}
    </div>
  );
}

export function Select({
  className = '',
  tone = 'default',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  className?: string;
  tone?: 'default' | 'client';
}) {
  return (
    <select
      className={joinClassNames(
        tone === 'client'
          ? joinClassNames(clientInputClasses, clientInputStateClasses)
          : inputBaseClasses,
        selectClasses,
        className,
      )}
      style={selectArrowStyle}
      {...props}
    />
  );
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) {
  return (
    <textarea
      className={joinClassNames(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-800 transition-colors duration-150 hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-200 min-h-21 resize-y',
        className,
      )}
      {...props}
    />
  );
}

export function SearchableSelect({
  value,
  onValueChange,
  onInputValueChange,
  options,
  placeholder = '',
  required = false,
  className = '',
  isLoading = false,
  searchable = true,
  disabled = false,
}: {
  value: string;
  onValueChange: (_nextValue: string) => void;
  onInputValueChange?: (_nextValue: string) => void;
  options: Array<{ value: string; label: string; searchText?: string }>;
  placeholder?: string;
  required?: boolean;
  className?: string;
  isLoading?: boolean;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState(selectedOption?.label ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownStyle = useDropdownStyle(containerRef, isOpen);
  const displayedValue = isOpen ? inputValue : (selectedOption?.label ?? '');

  const filteredOptions = useMemo(() => {
    const normalizedInput = inputValue.trim().toLowerCase();

    if (selectedOption && normalizedInput === selectedOption.label.toLowerCase()) {
      return options;
    }

    if (!normalizedInput) return options;

    return options.filter((option) => {
      const normalizedLabel = option.label.trim().toLowerCase();
      const normalizedSearchText = option.searchText?.trim().toLowerCase() ?? '';

      return (
        normalizedLabel.includes(normalizedInput) ||
        normalizedSearchText.includes(normalizedInput)
      );
    });
  }, [inputValue, options, selectedOption]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextInput = event.target.value;
    setInputValue(nextInput);
    onValueChange('');
    onInputValueChange?.(nextInput);
    setIsOpen(true);
  };

  const applyOption = (option: { value: string; label: string; searchText?: string }) => {
    onValueChange(option.value);
    setInputValue(option.label);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className='relative'>
      <input
        value={displayedValue}
        readOnly={!searchable}
        disabled={disabled}
        onChange={handleChange}
        onFocus={() => {
          setInputValue(selectedOption?.label ?? '');
          if (searchable) {
            setIsOpen(true);
          }
        }}
        onClick={() => {
          if (!searchable) {
            setInputValue(selectedOption?.label ?? '');
            setIsOpen((prev) => !prev);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              containerRef.current?.contains(activeElement) ||
              dropdownRef.current?.contains(activeElement)
            ) {
              return;
            }

            if (selectedOption) {
              setInputValue(selectedOption.label);
            } else {
              setInputValue('');
            }

            setIsOpen(false);
          }, 0);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === 'Escape') {
            // Открытый список закрывается первым, окно вокруг остаётся открытым.
            if (isOpen) event.preventDefault();
            setIsOpen(false);
            if (selectedOption) {
              setInputValue(selectedOption.label);
            }
          }
        }}
        placeholder={placeholder}
        required={required}
        className={joinClassNames(
          inputBaseClasses,
          !searchable && 'cursor-pointer',
          className,
        )}
      />
      <button
        type='button'
        disabled={disabled}
        className='absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center text-slate-400'
        tabIndex={-1}
        aria-hidden='true'
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg
          viewBox='0 0 20 20'
          className={`size-4 fill-none stroke-current stroke-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d='M5 7.5L10 12.5L15 7.5' />
        </svg>
      </button>

      {isOpen && dropdownStyle
        ? renderDropdown(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className='z-2000 max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            >
              {isLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
                </div>
              ) : filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      value === option.value
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyOption(option)}
                  >
                    {option.label}
                  </button>
                ))
              ) : (
                <div className='px-3 py-2 text-sm text-slate-500'>Ничего не найдено</div>
              )}
            </div>,
          )
        : null}
    </div>
  );
}

export function MultiSelect({
  values,
  onValuesChange,
  options,
  disabledValues = [],
  placeholder = 'Выберите значения',
  emptyText = 'Нет доступных значений',
  searchPlaceholder = 'Поиск...',
  disabled = false,
  isLoading = false,
  searchable = false,
  className = '',
  onOpen,
}: {
  values: string[];
  onValuesChange: (_nextValues: string[]) => void;
  /** Опции с одинаковым `group` идут подряд под общим заголовком. */
  options: Array<{ value: string; label: string; group?: string }>;
  disabledValues?: string[];
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  searchable?: boolean;
  className?: string;
  onOpen?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const dropdownStyle = useDropdownStyle(containerRef, isOpen);
  const selectedSet = useMemo(() => new Set(values), [values]);

  const close = () => {
    setSearchValue('');
    setIsOpen(false);
  };
  const handleEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    event.stopPropagation();
    close();
    triggerRef.current?.focus();
  };
  const disabledSet = useMemo(() => new Set(disabledValues), [disabledValues]);

  const selectedLabels = useMemo(
    () =>
      options
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label),
    [options, selectedSet],
  );

  const displayValue =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 1
        ? selectedLabels.join(', ')
        : `Выбрано: ${selectedLabels.length}`;
  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!searchable || !normalizedSearch) return options;

    return options.filter((option) =>
      option.label.trim().toLowerCase().includes(normalizedSearch),
    );
  }, [options, searchable, searchValue]);

  const toggleOption = (value: string) => {
    if (disabledSet.has(value)) return;

    if (selectedSet.has(value)) {
      onValuesChange(values.filter((current) => current !== value));
      return;
    }

    onValuesChange([...values, value]);
  };

  return (
    <div ref={containerRef} className='relative min-w-0'>
      <button
        ref={triggerRef}
        type='button'
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={isOpen}
        className={joinClassNames(
          inputBaseClasses,
          selectClasses,
          'flex items-center justify-start truncate text-left',
          values.length === 0 ? 'text-slate-400' : '',
          className,
        )}
        style={selectArrowStyle}
        onKeyDown={handleEscape}
        onClick={() => {
          if (!isOpen) {
            onOpen?.();
          }
          setIsOpen((prev) => {
            const next = !prev;
            if (!next) setSearchValue('');

            return next;
          });
        }}
        onBlur={() => {
          window.setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              containerRef.current?.contains(activeElement) ||
              dropdownRef.current?.contains(activeElement)
            ) {
              return;
            }

            close();
          }, 0);
        }}
      >
        <span className='truncate'>{displayValue}</span>
      </button>

      {isOpen && dropdownStyle
        ? renderDropdown(
            <div
              ref={dropdownRef}
              style={dropdownStyle}
              className='z-2000 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            >
              {isLoading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
                </div>
              ) : options.length > 0 ? (
                <>
                  {searchable ? (
                    <div className='sticky top-0 z-10 bg-white p-1'>
                      <input
                        value={searchValue}
                        onChange={(event) => setSearchValue(event.target.value)}
                        placeholder={searchPlaceholder}
                        className='h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        onMouseDown={(event) => event.stopPropagation()}
                        onKeyDown={handleEscape}
                      />
                    </div>
                  ) : null}

                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option, index) => {
                      const isSelected = selectedSet.has(option.value);
                      const isDisabled = disabledSet.has(option.value);
                      const previousGroup = filteredOptions[index - 1]?.group;
                      const groupHeading =
                        option.group && option.group !== previousGroup ? (
                          <div
                            className={joinClassNames(
                              'px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase',
                              index > 0 && 'mt-1 border-t border-slate-100',
                            )}
                          >
                            {option.group}
                          </div>
                        ) : null;

                      return (
                        <Fragment key={option.value}>
                          {groupHeading}
                          <button
                            type='button'
                            disabled={isDisabled}
                            // Вариант — переключатель: скринридер читает «нажато / не нажато».
                            aria-pressed={isSelected}
                            className={joinClassNames(
                              'flex w-full items-start gap-1.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                              isDisabled && 'cursor-not-allowed opacity-60',
                              isSelected
                                ? 'bg-blue-50 text-blue-900'
                                : 'text-slate-700 hover:bg-slate-100',
                            )}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => toggleOption(option.value)}
                          >
                            <span
                              className={joinClassNames(
                                'mt-0.5 grid h-4 w-4 flex-none place-items-center rounded border text-[10px] font-bold',
                                isSelected
                                  ? 'border-blue-500 bg-blue-500 text-white'
                                  : 'border-slate-300 bg-white text-transparent',
                              )}
                              aria-hidden='true'
                            >
                              ✓
                            </span>
                            <span className='min-w-0 flex-1 whitespace-normal leading-5'>
                              {option.label}
                            </span>
                          </button>
                        </Fragment>
                      );
                    })
                  ) : (
                    <div className='px-3 py-2 text-sm text-slate-500'>
                      Ничего не найдено
                    </div>
                  )}
                </>
              ) : (
                <div className='px-3 py-2 text-sm text-slate-500'>{emptyText}</div>
              )}
            </div>,
          )
        : null}
    </div>
  );
}
