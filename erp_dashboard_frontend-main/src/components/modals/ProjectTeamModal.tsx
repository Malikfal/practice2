import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import Button from '../ui/Button';
import { Field, Select } from '../ui/FormField';
import { formatName } from '../../utils/formatters';
import type { ProjectMember, User } from '../../types/app';

type Option = { value: string; label: string };
type PmPayrollSelection = Record<string, boolean>;

const PM_PAYROLL_HINT =
  'Если выключено, этот PM остается руководителем проекта, но не участвует в расчете PM-начислений по этому проекту.';

export function ChipsMultiSelect({
  values,
  onChange,
  options,
  placeholder = 'Выберите...',
  emptyText = 'Нет доступных вариантов',
  disabled = false,
}: {
  values: string[];
  onChange: (_next: string[]) => void;
  options: Option[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'bottom' | 'top';
  } | null>(null);

  const valueSet = useMemo(() => new Set(values), [values]);
  const selectedOptions = useMemo(
    () => options.filter((option) => valueSet.has(option.value)),
    [options, valueSet],
  );
  const availableOptions = useMemo(
    () => options.filter((option) => !valueSet.has(option.value)),
    [options, valueSet],
  );
  const filteredAvailableOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return availableOptions;
    return availableOptions.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [availableOptions, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const maxHeight = 256;
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placement: 'bottom' | 'top' =
        spaceBelow >= maxHeight + gap || spaceBelow >= spaceAbove ? 'bottom' : 'top';
      const top = placement === 'bottom' ? rect.bottom + gap : rect.top - gap;
      setDropdownStyle({ top, left: rect.left, width: rect.width, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setSearchQuery('');
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const removeValue = (value: string) => {
    onChange(values.filter((current) => current !== value));
  };

  const addValue = (value: string) => {
    if (valueSet.has(value)) return;
    onChange([...values, value]);
  };

  return (
    <div ref={containerRef} className='relative'>
      <div
        ref={triggerRef}
        role='button'
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => {
            if (prev) {
              setSearchQuery('');
            }
            return !prev;
          });
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsOpen((prev) => {
              if (prev) {
                setSearchQuery('');
              }
              return !prev;
            });
          } else if (event.key === 'Escape') {
            setSearchQuery('');
            setIsOpen(false);
          }
        }}
        className={`flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 pr-9 text-left text-sm leading-5 text-slate-800 transition-colors duration-150 ${
          disabled
            ? 'cursor-not-allowed bg-slate-100 opacity-70'
            : 'cursor-pointer bg-white hover:border-slate-400 focus:border-blue-500 focus:outline-none focus:ring-3 focus:ring-blue-200'
        }`}
      >
        {selectedOptions.length === 0 ? (
          <span className='text-slate-400'>{placeholder}</span>
        ) : (
          selectedOptions.map((option) => (
            <span
              key={option.value}
              className='inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700'
            >
              {option.label}
              <button
                type='button'
                title='Убрать'
                disabled={disabled}
                className='grid size-4 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700'
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeValue(option.value);
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <svg
                  viewBox='0 0 12 12'
                  className='size-2.5 fill-none stroke-current stroke-2'
                >
                  <path
                    d='M3 3l6 6M9 3l-6 6'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      <span className='pointer-events-none absolute top-3 right-3 text-slate-400'>
        <svg
          viewBox='0 0 20 20'
          className={`size-4 fill-none stroke-current stroke-2 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          <path d='M5 7.5L10 12.5L15 7.5' />
        </svg>
      </span>

      {isOpen && dropdownStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                top: dropdownStyle.placement === 'bottom' ? dropdownStyle.top : undefined,
                bottom:
                  dropdownStyle.placement === 'top'
                    ? window.innerHeight - dropdownStyle.top
                    : undefined,
                left: dropdownStyle.left,
                width: dropdownStyle.width,
              }}
              className='z-[1100] flex max-h-64 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10'
            >
              <div className='border-b border-slate-100 p-1.5'>
                <input
                  ref={searchInputRef}
                  type='text'
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.stopPropagation();
                      setSearchQuery('');
                      setIsOpen(false);
                    }
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  placeholder='Поиск...'
                  className='w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                />
              </div>
              <div className='flex-1 overflow-auto p-1'>
                {availableOptions.length === 0 ? (
                  <div className='px-3 py-2 text-sm text-slate-500'>{emptyText}</div>
                ) : filteredAvailableOptions.length === 0 ? (
                  <div className='px-3 py-2 text-sm text-slate-500'>
                    Ничего не найдено
                  </div>
                ) : (
                  filteredAvailableOptions.map((option) => (
                    <button
                      key={option.value}
                      type='button'
                      className='flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100'
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addValue(option.value)}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function ProjectTeamModal({
  isOpen,
  isSaving,
  members,
  managerIds,
  managerPaymentMethod,
  allActiveEmployees,
  canEditManagerPaymentMethod,
  onClose,
  onDetails,
  onSave,
}: {
  isOpen: boolean;
  isSaving: boolean;
  members: ProjectMember[];
  managerIds: string[];
  managerPaymentMethod: string;
  allActiveEmployees: User[];
  canEditManagerPaymentMethod: boolean;
  onClose: () => void;
  onDetails?: () => void;
  onSave: (
    _memberIds: string[],
    _managerIds: string[],
    _pmPayrollSelection: PmPayrollSelection,
    _managerPaymentMethod: string,
  ) => void;
}) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    members.map((member) => member.user.id),
  );
  const [managerSelection, setManagerSelection] = useState<string[]>(() => managerIds);
  const [pmPayrollSelection, setPmPayrollSelection] = useState<PmPayrollSelection>(() => {
    const managerIdSet = new Set(managerIds);
    const initialSelection = members.reduce<PmPayrollSelection>((acc, member) => {
      const userId = member.user.id;
      acc[userId] =
        managerIdSet.has(userId) &&
        Boolean(member.is_pm_payroll_enabled ?? member.is_pm ?? true);
      return acc;
    }, {});

    for (const userId of managerIds) {
      initialSelection[userId] = initialSelection[userId] ?? true;
    }

    return initialSelection;
  });
  const [selectedManagerPaymentMethod, setSelectedManagerPaymentMethod] =
    useState(managerPaymentMethod);

  const employeeOptions = useMemo<Option[]>(() => {
    const memberUsers = members.map((member) => member.user);
    const seen = new Set<string>();
    const merged: User[] = [];

    for (const user of [...allActiveEmployees, ...memberUsers]) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      merged.push(user);
    }

    return merged.map((user) => ({ value: user.id, label: formatName(user) }));
  }, [allActiveEmployees, members]);

  const handleMemberIdsChange = (nextMemberIds: string[]) => {
    setMemberIds(nextMemberIds);
  };

  const handleManagerSelectionChange = (nextManagerIds: string[]) => {
    const previousManagerSet = new Set(managerSelection);
    const nextManagerSet = new Set(nextManagerIds);

    setManagerSelection(nextManagerIds);
    setPmPayrollSelection((prev) => {
      const next: PmPayrollSelection = {};

      for (const userId of nextManagerIds) {
        next[userId] = previousManagerSet.has(userId) ? Boolean(prev[userId]) : true;
      }

      for (const userId of Object.keys(prev)) {
        if (!nextManagerSet.has(userId)) {
          next[userId] = false;
        }
      }

      return next;
    });
  };

  const handlePmPayrollChange = (userId: string, enabled: boolean) => {
    if (!managerSelection.includes(userId)) return;
    setPmPayrollSelection((prev) => ({ ...prev, [userId]: enabled }));
  };

  const handleSave = () => {
    onSave(memberIds, managerSelection, pmPayrollSelection, selectedManagerPaymentMethod);
  };

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-1000 grid place-items-center bg-slate-900/40 p-2 sm:p-4'
      onMouseDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onMouseUp={(event) => {
        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;
        shouldCloseOnBackdropClickRef.current = false;

        if (shouldClose && !isSaving) {
          onClose();
        }
      }}
    >
      <div
        className='max-h-[calc(100dvh-1rem)] w-full max-w-[691px] overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/20 sm:max-h-[90vh] sm:rounded-2xl sm:p-5 md:overflow-auto'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='mb-4 flex items-center justify-between gap-3'>
          <h2 className='text-lg leading-tight font-semibold text-slate-900 sm:text-xl'>
            Редактирование команды проекта
          </h2>
          {onDetails ? (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-8 shrink-0 px-3 text-xs'
              disabled={isSaving}
              onClick={onDetails}
            >
              Подробнее
            </Button>
          ) : null}
        </div>

        <div className='grid gap-4'>
          <div className='grid gap-1.5'>
            <span className='text-[13px] leading-tight font-medium text-slate-700'>
              Команда проекта (мультивыбор)
            </span>
            <ChipsMultiSelect
              values={memberIds}
              onChange={handleMemberIdsChange}
              options={employeeOptions}
              placeholder='Выберите сотрудников'
              emptyText='Все сотрудники добавлены'
            />
          </div>

          <div className='grid gap-1.5'>
            <span className='text-[13px] leading-tight font-medium text-slate-700'>
              Выберите руководителя проекта (мультивыбор)
            </span>
            <ChipsMultiSelect
              values={managerSelection}
              onChange={handleManagerSelectionChange}
              options={employeeOptions}
              placeholder='Выберите руководителя'
              emptyText='Все сотрудники добавлены'
            />
          </div>

          <div className='grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3'>
            <div className='flex items-center justify-between gap-3'>
              <span className='text-[13px] leading-tight font-medium text-slate-700'>
                Участвует в начислении PM-оплаты
              </span>
              <span
                tabIndex={0}
                aria-label={PM_PAYROLL_HINT}
                className='group relative inline-grid size-5 shrink-0 select-none place-items-center rounded-full border border-slate-300 bg-white text-xs font-semibold text-slate-500 outline-none transition-colors hover:border-blue-300 hover:text-blue-600 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100'
              >
                <span aria-hidden='true' className='select-none'>
                  ?
                </span>
                <span className='pointer-events-none absolute right-0 bottom-full z-20 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 font-medium text-slate-600 opacity-0 shadow-lg shadow-slate-900/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:w-74'>
                  {PM_PAYROLL_HINT}
                  <span className='absolute right-2 -bottom-1 size-2 rotate-45 border-r border-b border-slate-200 bg-white' />
                </span>
              </span>
            </div>

            {managerSelection.length === 0 ? (
              <div className='text-sm text-slate-500'>
                Сначала выберите руководителя проекта.
              </div>
            ) : (
              <div className='grid gap-2'>
                {managerSelection.map((userId) => {
                  const option = employeeOptions.find((item) => item.value === userId);

                  return (
                    <label
                      key={userId}
                      className='flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700'
                    >
                      <span>{option?.label ?? userId}</span>
                      <input
                        type='checkbox'
                        className='mt-0.5'
                        checked={Boolean(pmPayrollSelection[userId])}
                        disabled={isSaving}
                        onChange={(event) =>
                          handlePmPayrollChange(userId, event.target.checked)
                        }
                      />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <Field label='Метод оплаты руководителя проекта'>
            <Select
              value={selectedManagerPaymentMethod}
              disabled={!canEditManagerPaymentMethod || isSaving}
              onChange={(event) => setSelectedManagerPaymentMethod(event.target.value)}
            >
              <option value='ACCRUE_ALL'>Начислять всем</option>
              <option value='DO_NOT_ACCRUE'>Не начислять</option>
              <option value='ACCRUE_PROPORTIONALLY'>Начислять пропорционально</option>
            </Select>
          </Field>
        </div>

        <div className='mt-6 grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3'>
          <Button
            type='button'
            variant='secondary'
            className='w-full sm:w-auto'
            onClick={onClose}
            disabled={isSaving}
          >
            Отмена
          </Button>
          <Button
            type='button'
            onClick={handleSave}
            disabled={isSaving}
            variant={isSaving ? 'secondary' : 'primary'}
            className='w-full sm:w-auto'
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
}
