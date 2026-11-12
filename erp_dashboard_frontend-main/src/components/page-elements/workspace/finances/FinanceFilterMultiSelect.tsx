import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { inputBaseClasses } from '../../../ui/FormField';
import useFinanceFilterDropdownStyle from './useFinanceFilterDropdownStyle';

export default function FinanceFilterMultiSelect({
  values,
  onValuesChange,
  options,
  placeholder,
  isLoading = false,
  searchable = false,
  onOpen,
}: {
  values: string[];
  onValuesChange: (_values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  isLoading?: boolean;
  searchable?: boolean;
  onOpen?: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const preferredWidth = Math.min(
    440,
    Math.max(
      searchable ? 220 : 180,
      ...options.map((option) => option.label.length * 7.5 + 52),
    ),
  );
  const dropdownStyle = useFinanceFilterDropdownStyle(anchorRef, isOpen, preferredWidth);
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !anchorRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setIsOpen(false);
        setSearchValue('');
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);
  const selectedSet = useMemo(() => new Set(values), [values]);
  const selectedLabels = options.filter((option) => selectedSet.has(option.value));
  const displayValue =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0].label
        : `Выбрано: ${selectedLabels.length}`;
  const filteredOptions = options.filter(
    (option) =>
      !searchable ||
      option.label.toLowerCase().includes(searchValue.trim().toLowerCase()),
  );

  const close = () => {
    setIsOpen(false);
    setSearchValue('');
  };
  const toggleOpen = () => {
    if (isOpen) close();
    else {
      onOpen?.();
      setIsOpen(true);
    }
  };

  return (
    <div ref={anchorRef} className='relative min-w-0'>
      <button
        type='button'
        aria-expanded={isOpen}
        className={`${inputBaseClasses} flex h-9! min-w-0 items-center justify-between gap-2 px-2.5 text-left text-xs`}
        onClick={toggleOpen}
        onBlur={() =>
          window.setTimeout(() => {
            const activeElement = document.activeElement;
            if (
              !anchorRef.current?.contains(activeElement) &&
              !dropdownRef.current?.contains(activeElement)
            )
              close();
          }, 0)
        }
      >
        <span className='min-w-0 truncate'>{displayValue}</span>
        <svg
          viewBox='0 0 20 20'
          className={`size-4 shrink-0 fill-none stroke-current stroke-2 text-[#7e8fb4] ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden='true'
        >
          <path d='M5 7.5L10 12.5L15 7.5' />
        </svg>
      </button>
      {isOpen &&
        dropdownStyle &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className='z-[2000] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10'
            onKeyDown={(event) => {
              if (event.key === 'Escape') close();
            }}
          >
            {searchable ? (
              <div className='sticky top-0 z-10 bg-white p-1'>
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder='Поиск...'
                  className='h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                />
              </div>
            ) : null}
            {isLoading ? (
              <div className='flex justify-center py-8'>
                <div className='size-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500' />
              </div>
            ) : filteredOptions.length ? (
              filteredOptions.map((option) => {
                const selected = selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type='button'
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm ${selected ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-100'}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() =>
                      onValuesChange(
                        selected
                          ? values.filter((value) => value !== option.value)
                          : [...values, option.value],
                      )
                    }
                  >
                    <span
                      className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] font-bold ${selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}
                      aria-hidden='true'
                    >
                      ✓
                    </span>
                    <span className='min-w-0 whitespace-normal break-words leading-5'>
                      {option.label}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className='px-3 py-2 text-sm text-slate-500'>Ничего не найдено</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
