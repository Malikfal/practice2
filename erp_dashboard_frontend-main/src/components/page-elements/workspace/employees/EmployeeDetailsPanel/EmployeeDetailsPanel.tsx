import { useMemo, useState } from 'react';

import Button from '../../../../ui/Button';
import { SearchableSelect } from '../../../../ui/FormField';
import {
  formatEmployeeArchiveLabel,
  formatName,
  isEmployeeBlocked,
} from '../../../../../utils/formatters';
import type {
  EmployeeProfileForm,
  PasswordForm,
  Project,
  ProjectMember,
  RoleOption,
  User,
} from '../../../../../types/app';

import AbsencesTab from './components/absences/AbsencesTab';
import DayTimelineTab from './components/day/DayTimelineTab';
import DocumentsTab from './components/documents/DocumentsTab';
import GeneralDataTab from './components/general/GeneralDataTab';
import SettingsTab from './components/settings/SettingsTab';
import type { EmployeeTab } from './types';
import PayrollTab from './components/payroll/PayrollTab';
import { useAppControllerContext } from '../../../../../context/AppControllerContext';
import { useTariffAccess } from '../../../../../hooks/useTariffAccess';
import ProBadge from '../../../../tariff/ProBadge';
import ProFeatureLock from '../../../../tariff/ProFeatureLock';
import AssignmentHistoryTab from '../../assignments/AssignmentHistoryTab';

type Props = {
  selectedEmployee: User | null;
  profileForm: EmployeeProfileForm;
  roleOptions: RoleOption[];
  projects: Project[];
  isUpdating: boolean;
  homePageMode?: boolean;
  initialTab?: EmployeeTab;
  // Дата для вкладки «День сотрудника» (YYYY-MM-DD), например по ссылке из уведомления.
  initialDayDate?: string;
  canEditProfile?: boolean;
  passwordForm?: PasswordForm;
  isUpdatingPassword?: boolean;
  positionSuggestions?: string[];
  onPasswordFormChange?: (_next: PasswordForm) => void;
  onChangePassword?: () => void;
  showCloseButton?: boolean;
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
  onUpdateEmployee: () => void;
  onRequestPasswordReset: (_employee: User) => void;
  onCloseEmployee: () => void;
};

const tabs: EmployeeTab[] = [
  'День сотрудника',
  'Общие данные',
  'Настройки',
  'Назначения',
  'Документы',
  'Рабочий календарь',
  'Оплата труда',
];

const TAB_PERMISSIONS: Record<EmployeeTab, string> = {
  'День сотрудника': 'employees.tabs.day.view',
  'Общие данные': 'employees.tabs.general.view',
  Настройки: 'employees.tabs.settings.view',
  Назначения: 'project.assignment_histories.view',
  Документы: 'employees.tabs.documents.view',
  'Рабочий календарь': 'employees.tabs.absences.view',
  'Оплата труда': 'employees.tabs.salary.view',
};

function employeeProjectStats(employee: User, projects: Project[]) {
  const employeeProjects = projects.filter((project) =>
    project.members.some((member: ProjectMember) => member.user.id === employee.id),
  );
  const activeProjects = employeeProjects.filter(
    (project) => String(project.status || '').toUpperCase() !== 'ARCHIVED',
  );

  return {
    total: employeeProjects.length,
    active: activeProjects.length,
  };
}

function getRoleLabel(employee: User, roleOptions: RoleOption[]) {
  return (
    employee.role_label ||
    roleOptions.find(
      (role) => role.role_value === employee.role || role.value === employee.role,
    )?.label ||
    employee.role ||
    'Не указано'
  );
}

function getInitials(employee: User) {
  const firstName = employee.first_name?.trim();
  const lastName = employee.last_name?.trim();
  const fromNames = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.trim();

  if (fromNames) return fromNames.toUpperCase();

  return (employee.email || employee.name || 'С').slice(0, 2).toUpperCase();
}

export default function EmployeeDetailsPanel({
  selectedEmployee,
  profileForm,
  roleOptions,
  projects,
  isUpdating,
  homePageMode = false,
  initialTab = 'Общие данные',
  initialDayDate,
  canEditProfile = true,
  passwordForm,
  isUpdatingPassword = false,
  positionSuggestions,
  onPasswordFormChange,
  onChangePassword,
  showCloseButton = true,
  onProfileFormChange,
  onUpdateEmployee,
  onRequestPasswordReset,
  onCloseEmployee,
}: Props) {
  const { user } = useAppControllerContext();
  const userPermissions = user?.permissions ?? [];
  // На ФРИ расчёт зарплаты закрыт: вкладка «Оплата труда» остаётся с меткой «ПРО».
  const isPayrollLocked = useTariffAccess().isFeatureLocked('payroll');
  const [activeTabState, setActiveTabState] = useState<{
    employeeId: string;
    tab: EmployeeTab;
  }>({
    employeeId: '',
    tab: 'Общие данные',
  });
  const projectStats = useMemo(() => {
    if (!selectedEmployee) return { total: 0, active: 0 };
    return employeeProjectStats(selectedEmployee, projects);
  }, [projects, selectedEmployee]);
  if (!selectedEmployee) {
    return (
      <div className='grid h-full min-h-0 place-items-center rounded-xl border border-[#e3e9f3] bg-white p-6 text-center text-[#1f3565]'>
        <div>
          <p className='text-[18px] font-semibold'>Выберите сотрудника</p>
          <p className='mt-2 text-[14px] text-[#7e8fb4]'>
            Карточка сотрудника появится здесь.
          </p>
        </div>
      </div>
    );
  }

  const blocked = isEmployeeBlocked(selectedEmployee.status);
  const canResetPassword = userPermissions.includes('employees.password.reset');
  const isCurrentUserProfile = user?.id === selectedEmployee.id;
  const canViewAbsences = userPermissions.includes('employees.tabs.absences.view');
  const canManageAbsences = userPermissions.includes('employees.absences.manage');
  const canManageAssignments = userPermissions.includes(
    'project.assignment_histories.manage',
  );

  const hasTabPermission = (tab: EmployeeTab): boolean =>
    tab === 'Назначения'
      ? userPermissions.includes(TAB_PERMISSIONS[tab])
      : tab === 'Рабочий календарь'
        ? canViewAbsences || isCurrentUserProfile
        : tab === 'Оплата труда' && isPayrollLocked
          ? homePageMode ||
            Boolean(user?.tariff_locked_permissions?.includes(TAB_PERMISSIONS[tab]))
          : homePageMode || userPermissions.includes(TAB_PERMISSIONS[tab]);
  const isTabProLocked = (tab: EmployeeTab) => tab === 'Оплата труда' && isPayrollLocked;
  const availableTabs = tabs.filter((tab) => {
    return hasTabPermission(tab);
  });
  const requestedTab =
    activeTabState.employeeId === selectedEmployee.id ? activeTabState.tab : initialTab;
  const activeTab = availableTabs.includes(requestedTab)
    ? requestedTab
    : (availableTabs[0] ?? null);
  const position = profileForm.position || 'Не указано';
  const archiveLabel = formatEmployeeArchiveLabel(selectedEmployee);

  return (
    <>
      <section className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#e3e9f3] bg-white text-[#1f3565]'>
        <div className='relative flex flex-wrap items-start justify-between gap-3 border-b border-[#e3e9f3] p-3 pr-14 sm:p-4 sm:pr-16'>
          <div className='flex min-w-0 items-start gap-2.5 sm:gap-3'>
            <span className='grid size-10 shrink-0 place-items-center rounded-full border border-[#c9d8f8] bg-[#edf3ff] text-[16px] font-semibold text-[#2d6ff7] sm:size-12 sm:text-[18px]'>
              {getInitials(selectedEmployee)}
            </span>
            <div className='min-w-0'>
              <h2 className='truncate text-[20px] leading-snug font-semibold text-[#10275a] sm:text-[26px]'>
                {formatName(selectedEmployee)}
              </h2>
              <div className='mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[#7e8fb4]'>
                <span>{getRoleLabel(selectedEmployee, roleOptions)}</span>
                <span className='hidden sm:inline' aria-hidden='true'>
                  -
                </span>
                <span>{position}</span>
                <span
                  className={`rounded-lg px-2 py-1 text-[11px] leading-none font-semibold ${
                    blocked
                      ? 'bg-[#edf1f7] text-[#7e8fb4]'
                      : 'bg-[#e8f6eb] text-[#3e8d59]'
                  }`}
                >
                  {blocked ? 'Архив' : 'Активный'}
                </span>
                {archiveLabel ? <span>{archiveLabel}</span> : null}
              </div>
            </div>
          </div>

          <div className='hidden items-center gap-2 lg:flex'>
            {!homePageMode && canResetPassword ? (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='h-9 rounded-xl border-[#e3e9f3] bg-white px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff]'
                onClick={() => onRequestPasswordReset(selectedEmployee)}
              >
                Сброс пароля
              </Button>
            ) : null}
          </div>
          {showCloseButton ? (
            <button
              type='button'
              className='absolute top-3 right-3 grid size-9 place-items-center rounded-xl border border-[#e3e9f3] bg-white text-[18px] leading-none text-[#1f3565] transition-colors hover:bg-[#f3f7ff] hover:text-[#2d6ff7] sm:top-4 sm:right-4'
              onClick={onCloseEmployee}
              aria-label='Закрыть карточку сотрудника'
              title='Вернуться к таблице'
            >
              x
            </button>
          ) : null}
        </div>

        <div className='border-b border-[#e3e9f3] p-2 md:hidden'>
          <SearchableSelect
            value={activeTab ?? ''}
            options={availableTabs.map((tab) => ({
              value: tab,
              label: isTabProLocked(tab) ? `${tab} · ПРО` : tab,
            }))}
            searchable={false}
            className='h-11 rounded-xl border-[#c9d8f8] bg-[#edf3ff] pr-11 text-sm font-semibold text-[#1f3565]'
            onValueChange={(value) => {
              if (!value || !availableTabs.includes(value as EmployeeTab)) return;
              setActiveTabState({
                employeeId: selectedEmployee.id,
                tab: value as EmployeeTab,
              });
            }}
          />
        </div>

        <div className='hidden border-b border-[#e3e9f3] text-[13px] font-semibold md:grid md:grid-cols-7'>
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type='button'
              className={`min-h-11 min-w-max shrink-0 border-r border-[#e3e9f3] px-4 py-2 text-center transition-colors last:border-r-0 md:min-w-0 md:px-3 ${
                activeTab === tab
                  ? 'bg-[#edf3ff] text-[#2d6ff7]'
                  : 'bg-white text-[#1f3565] hover:bg-[#f3f7ff]'
              }`}
              onClick={() =>
                setActiveTabState({
                  employeeId: selectedEmployee.id,
                  tab,
                })
              }
            >
              {tab}
              {isTabProLocked(tab) ? <ProBadge className='ml-1.5 align-middle' /> : null}
            </button>
          ))}
        </div>

        <div className='min-h-0 min-w-0 flex-1 overflow-auto p-2 sm:p-4'>
          {activeTab === null ? (
            <div className='grid min-h-80 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-6 text-center'>
              <div>
                <p className='text-[20px] font-semibold text-[#1f3565]'>Нет доступа</p>
                <p className='mt-2 text-[14px] text-[#7e8fb4]'>
                  У вас нет прав на вкладки карточки сотрудника.
                </p>
              </div>
            </div>
          ) : activeTab === 'День сотрудника' ? (
            <DayTimelineTab
              key={`${selectedEmployee.id}:${initialDayDate ?? ''}`}
              employee={selectedEmployee}
              initialDate={initialDayDate}
            />
          ) : activeTab === 'Общие данные' ? (
            <GeneralDataTab
              employee={selectedEmployee}
              profileForm={profileForm}
              roleOptions={roleOptions}
              projectStats={projectStats}
              isUpdating={isUpdating}
              canEditProfile={canEditProfile}
              canEditPosition={!homePageMode && canEditProfile}
              canEditRole={!homePageMode && canEditProfile}
              showPositionField={!homePageMode}
              showRoleField={!homePageMode}
              showWorkMetaFields={!homePageMode}
              positionSuggestions={positionSuggestions}
              onProfileFormChange={onProfileFormChange}
              onUpdateEmployee={onUpdateEmployee}
            />
          ) : activeTab === 'Настройки' ? (
            <SettingsTab
              employee={selectedEmployee}
              mode={homePageMode ? 'self' : 'employee'}
              canResetPassword={!homePageMode && canResetPassword}
              passwordForm={passwordForm}
              isUpdatingPassword={isUpdatingPassword}
              onPasswordFormChange={onPasswordFormChange}
              onChangePassword={onChangePassword}
              onRequestPasswordReset={onRequestPasswordReset}
            />
          ) : activeTab === 'Документы' ? (
            <DocumentsTab employee={selectedEmployee} canUploadDocument={!homePageMode} />
          ) : activeTab === 'Рабочий календарь' ? (
            <AbsencesTab
              employee={selectedEmployee}
              canManageAbsences={canManageAbsences}
              canChangePast={
                canManageAbsences &&
                (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
              }
              canRecalculatePayroll={
                userPermissions.includes('finance.manage') &&
                userPermissions.includes('employees.tabs.salary.view')
              }
            />
          ) : activeTab === 'Оплата труда' && isPayrollLocked ? (
            <ProFeatureLock
              feature='payroll'
              screen='employee_payroll'
              variant='inline'
            />
          ) : activeTab === 'Оплата труда' ? (
            <PayrollTab
              employee={selectedEmployee}
              canChangeRate={!homePageMode}
              canEditBankDetails={!homePageMode}
            />
          ) : activeTab === 'Назначения' ? (
            <AssignmentHistoryTab
              scope={{ kind: 'employee', employee: selectedEmployee }}
              employees={[selectedEmployee]}
              projects={projects}
              canManage={canManageAssignments}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}
