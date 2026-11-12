import {
  Field,
  PhoneInput,
  SearchableSelect,
  Select,
} from '../../../../../../ui/FormField';
import type {
  EmployeeProfileForm,
  RoleOption,
  User,
} from '../../../../../../../types/app';
import {
  formatDateLocal,
  formatDurationHms,
  formatTimeLocal,
} from '../../../../../../../utils/formatters';

import DetailInput from './DetailInput';

type Props = {
  employee: User;
  profileForm: EmployeeProfileForm;
  roleOptions: RoleOption[];
  projectStats: {
    total: number;
    active: number;
  };
  canEditProfile: boolean;
  canEditPosition?: boolean;
  canEditRole?: boolean;
  showPositionField?: boolean;
  showRoleField?: boolean;
  showWorkMetaFields?: boolean;
  positionSuggestions?: string[];
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
};

function formatDisplayDate(value: string | number | null | undefined) {
  if (!value) return '';

  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return formatDateLocal(value);
}

function formatDisplayDateTime(value: string | number | null | undefined) {
  if (!value) return 'Не указано';

  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  if (Number.isNaN(date.getTime())) return 'Не указано';

  return `${formatDateLocal(date)} в ${formatTimeLocal(date)}`;
}

function formatWeekDuration(seconds: number | null | undefined) {
  if (seconds == null) return '—';
  return formatDurationHms(seconds);
}

export default function GeneralInfoSection({
  employee,
  profileForm,
  roleOptions,
  projectStats,
  canEditProfile,
  canEditPosition = canEditProfile,
  canEditRole = canEditProfile,
  showPositionField = true,
  showRoleField = true,
  showWorkMetaFields = true,
  positionSuggestions,
  onProfileFormChange,
}: Props) {
  return (
    <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4'>
      <h3 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[22px] sm:leading-none'>
        Общие данные
      </h3>
      <div className='grid gap-3 md:grid-cols-2'>
        <DetailInput
          label='Фамилия'
          value={profileForm.last_name}
          readOnly={!canEditProfile}
          onChange={(value) =>
            onProfileFormChange({
              ...profileForm,
              employeeId: employee.id,
              last_name: value,
            })
          }
        />
        <DetailInput
          label='Имя'
          value={profileForm.first_name}
          readOnly={!canEditProfile}
          onChange={(value) =>
            onProfileFormChange({
              ...profileForm,
              employeeId: employee.id,
              first_name: value,
            })
          }
        />
      </div>

      <div className='grid gap-3 md:grid-cols-2'>
        <DetailInput
          label='Дата рождения'
          value={profileForm.birthday}
          placeholder='ДД.ММ.ГГГГ'
          type='date'
          readOnly={!canEditProfile}
          onChange={(value) =>
            onProfileFormChange({
              ...profileForm,
              employeeId: employee.id,
              birthday: value,
            })
          }
        />
        <Field label='Номер телефона' className='text-[#1f3565]'>
          <PhoneInput
            value={profileForm.phone}
            placeholder='+7 (XXX) XXX-XX-XX'
            readOnly={!canEditProfile}
            className='text-base sm:text-[14px]'
            onValueChange={(value) =>
              onProfileFormChange({
                ...profileForm,
                employeeId: employee.id,
                phone: value,
              })
            }
          />
        </Field>
      </div>

      {showWorkMetaFields ? (
        <div className='grid gap-3 md:grid-cols-2'>
          <Field label='Статус' className='text-[#1f3565]'>
            <Select
              value={profileForm.status}
              disabled={!canEditProfile}
              onChange={(event) => {
                const status = event.target.value as EmployeeProfileForm['status'];
                onProfileFormChange({
                  ...profileForm,
                  employeeId: employee.id,
                  status,
                  archived_at: status === 'ACTIVE' ? '' : profileForm.archived_at,
                });
              }}
              className='h-10 rounded-xl border-[#c9d8f8] bg-white text-[14px] text-[#1f3565] disabled:bg-[#edf1f7]'
            >
              <option value='ACTIVE'>Активный</option>
              <option value='BLOCKED'>Архив</option>
            </Select>
          </Field>
          {profileForm.status === 'BLOCKED' ? (
            <DetailInput
              label='Дата архивирования'
              type='date'
              value={profileForm.archived_at}
              readOnly={!canEditProfile}
              onChange={(value) =>
                onProfileFormChange({
                  ...profileForm,
                  employeeId: employee.id,
                  archived_at: value,
                })
              }
            />
          ) : null}
        </div>
      ) : null}

      <div className='grid gap-3 md:grid-cols-3'>
        <DetailInput
          label='Адрес эл.почты'
          value={employee.email || ''}
          placeholder='email@example.com'
        />
        {showPositionField ? (
          <DetailInput
            label='Должность'
            value={profileForm.position}
            placeholder='Не указано'
            readOnly={!canEditPosition}
            suggestions={positionSuggestions}
            onChange={(value) =>
              onProfileFormChange({
                ...profileForm,
                employeeId: employee.id,
                position: value,
              })
            }
          />
        ) : null}
        {showRoleField ? (
          <Field label='Роль' className='text-[#1f3565]'>
            <SearchableSelect
              value={profileForm.role}
              disabled={!canEditRole}
              searchable={false}
              options={
                roleOptions.length
                  ? roleOptions.map((role) => ({
                      value: role.role_id || role.value,
                      label: role.label,
                    }))
                  : [{ value: profileForm.role, label: profileForm.role }]
              }
              onValueChange={(value) =>
                onProfileFormChange({
                  ...profileForm,
                  employeeId: employee.id,
                  role: value,
                })
              }
              className='h-10 rounded-xl border-[#c9d8f8] bg-white text-[14px] text-[#1f3565] hover:border-[#aebfe6] focus:border-[#2d6ff7] focus:ring-[#edf3ff] disabled:bg-[#edf1f7]'
            />
          </Field>
        ) : null}
      </div>

      {showWorkMetaFields ? (
        <div className='grid gap-3 md:grid-cols-3'>
          <DetailInput
            label='Дата добавления'
            value={formatDisplayDate(employee.created_at)}
          />
          <DetailInput
            label='Дата последней активности'
            value={formatDisplayDateTime(employee.last_date_activity)}
          />
          <DetailInput
            label='Проекты'
            value={`${projectStats.total}/${projectStats.active}`}
          />
          <DetailInput
            label='Время за неделю'
            value={formatWeekDuration(employee.total_seconds_for_week)}
          />
          <DetailInput
            label='Недельный план, ч'
            inputMode='decimal'
            value={profileForm.weekly_plan_hours ?? ''}
            placeholder={canEditProfile ? 'Например, 40' : 'Не задан'}
            readOnly={!canEditProfile}
            onChange={(value) =>
              onProfileFormChange({
                ...profileForm,
                employeeId: employee.id,
                weekly_plan_hours: value,
              })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
