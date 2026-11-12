import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../../../api/api';
import { extractApiFieldError } from '../../../../api/core/error';
import type { CompanyRequisites } from '../../../../types/app';
import { formatHoursCompact, parseHoursInput } from '../../../../utils/formatters';
import { StyledSelect } from '../employees/EmployeeDetailsPanel/components/absences/AbsenceSharedUi';
import { joinClassNames } from './settingsUtils';

const TIMEZONE_OPTIONS = [
  { value: '', label: 'Выберите часовой пояс' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kirov', label: 'Киров (UTC+3)' },
  { value: 'Europe/Volgograd', label: 'Волгоград (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Europe/Astrakhan', label: 'Астрахань (UTC+4)' },
  { value: 'Europe/Ulyanovsk', label: 'Ульяновск (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Novosibirsk', label: 'Новосибирск (UTC+7)' },
  { value: 'Asia/Barnaul', label: 'Барнаул (UTC+7)' },
  { value: 'Asia/Tomsk', label: 'Томск (UTC+7)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Novokuznetsk', label: 'Новокузнецк (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Chita', label: 'Чита (UTC+9)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Khandyga', label: 'Хандыга (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Ust-Nera', label: 'Усть-Нера (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Sakhalin', label: 'Сахалин (UTC+11)' },
  { value: 'Asia/Srednekolymsk', label: 'Среднеколымск (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'Asia/Anadyr', label: 'Анадырь (UTC+12)' },
];

const MAX_UNESTIMATED_LIMIT_HOURS = 1000;

function secondsToHours(seconds: number | null | undefined): string {
  return formatHoursCompact(seconds ?? 0);
}

type FormErrors = {
  legal_name?: string;
  address?: string;
  inn?: string;
  kpp?: string;
  phone?: string;
  contact_email?: string;
  ogrn?: string;
  mail_address?: string;
};

export default function CompanySettings({ embedded = false }: { embedded?: boolean }) {
  // Во вкладке рабочего пространства рамку и заголовок даёт родительский раздел.
  const frameClasses = embedded
    ? 'flex min-h-0 flex-col'
    : 'flex h-full min-h-0 flex-col overflow-auto rounded-2xl border border-[#e3e9f3] bg-white p-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] md:p-5';

  const [formData, setFormData] = useState<CompanyRequisites>({
    legal_name: '',
    address: '',
    inn: '',
    kpp: '',
    phone: '',
    contact_email: '',
    ogrn: '',
    mail_address: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [timezoneError, setTimezoneError] = useState<string>();
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [unestimatedLimitHours, setUnestimatedLimitHours] = useState('');
  const [unestimatedLimitError, setUnestimatedLimitError] = useState<string>();
  const [isSavingUnestimatedLimit, setIsSavingUnestimatedLimit] = useState(false);

  useEffect(() => {
    const fetchRequisites = async () => {
      try {
        setIsLoading(true);
        const company = await api.workspace.settings.getCompany();
        const req = company.requisites;
        setTimezone(company.timezone || '');
        setUnestimatedLimitHours(secondsToHours(company.unestimated_task_limit_seconds));
        if (req) {
          setFormData({
            legal_name: req.legal_name || '',
            address: req.address || '',
            inn: req.inn || '',
            kpp: req.kpp || '',
            phone: req.phone || '',
            contact_email: req.contact_email || '',
            ogrn: req.ogrn || '',
            mail_address: req.mail_address || '',
          });
        }
      } catch {
        toast.error('Ошибка при загрузке реквизитов компании');
      } finally {
        setIsLoading(false);
      }
    };
    void fetchRequisites();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    let isValid = true;

    if (!formData.legal_name) {
      newErrors.legal_name = 'Обязательное поле';
      isValid = false;
    }

    if (!formData.address) {
      newErrors.address = 'Обязательное поле';
      isValid = false;
    }

    if (!formData.inn) {
      newErrors.inn = 'Обязательное поле';
      isValid = false;
    } else {
      const innRegex = /^(\d{10}|\d{12})$/;
      if (!innRegex.test(formData.inn)) {
        newErrors.inn = 'ИНН должен состоять из 10 или 12 цифр';
        isValid = false;
      }
    }

    if (formData.kpp) {
      const kppRegex = /^\d{9}$/;
      if (!kppRegex.test(formData.kpp)) {
        newErrors.kpp = 'КПП должен состоять из 9 цифр';
        isValid = false;
      }
    }

    if (!formData.phone) {
      newErrors.phone = 'Обязательное поле';
      isValid = false;
    } else {
      const digitsOnly = formData.phone.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        newErrors.phone = 'Номер телефона должен содержать минимум 10 цифр';
        isValid = false;
      } else if (!/^\+?[0-9\-\s()]+$/.test(formData.phone)) {
        newErrors.phone = 'Неверный формат номера телефона';
        isValid = false;
      }
    }

    if (formData.contact_email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(formData.contact_email)) {
        newErrors.contact_email = 'Неверный формат почты';
        isValid = false;
      }
    }

    if (formData.ogrn) {
      const ogrnRegex = /^(\d{13}|\d{15})$/;
      if (!ogrnRegex.test(formData.ogrn)) {
        newErrors.ogrn = 'ОГРН должен состоять из 13 или 15 цифр';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setIsSaving(true);
      const updated = await api.workspace.settings.updateCompanyRequisites(formData);
      if (updated) {
        setFormData({
          legal_name: updated.legal_name || '',
          address: updated.address || '',
          inn: updated.inn || '',
          kpp: updated.kpp || '',
          phone: updated.phone || '',
          contact_email: updated.contact_email || '',
          ogrn: updated.ogrn || '',
          mail_address: updated.mail_address || '',
        });
      }
      toast.success('Реквизиты компании сохранены');
    } catch {
      toast.error('Ошибка при сохранении реквизитов компании');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleTimezoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!timezone) {
      setTimezoneError('Выберите часовой пояс');
      return;
    }

    try {
      setIsSavingTimezone(true);
      setTimezoneError(undefined);
      const updated = await api.workspace.settings.updateCompanyTimezone(timezone);
      setTimezone(updated.timezone);
      toast.success('Часовой пояс сохранён');
    } catch (error) {
      const fieldError = extractApiFieldError(error, 'timezone');
      if (fieldError) {
        setTimezoneError(fieldError);
      } else {
        toast.error('Ошибка при сохранении часового пояса');
      }
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const handleUnestimatedLimitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const seconds = parseHoursInput(unestimatedLimitHours, MAX_UNESTIMATED_LIMIT_HOURS);
    if (seconds === null) {
      setUnestimatedLimitError('Укажите количество часов');
      return;
    }
    if (seconds === undefined) {
      setUnestimatedLimitError(
        `Укажите число от 0 до ${MAX_UNESTIMATED_LIMIT_HOURS}, например 2,5`,
      );
      return;
    }

    try {
      setIsSavingUnestimatedLimit(true);
      setUnestimatedLimitError(undefined);
      const updated =
        await api.workspace.settings.updateCompanyUnestimatedTaskLimit(seconds);
      setUnestimatedLimitHours(secondsToHours(updated.unestimated_task_limit_seconds));
      toast.success('Допустимое время сохранено');
    } catch (error) {
      const fieldError = extractApiFieldError(error, 'unestimated_task_limit_seconds');
      if (fieldError) {
        setUnestimatedLimitError(fieldError);
      } else {
        toast.error('Ошибка при сохранении допустимого времени');
      }
    } finally {
      setIsSavingUnestimatedLimit(false);
    }
  };

  if (isLoading) {
    return (
      <div className={frameClasses}>
        <div
          className={
            embedded
              ? 'grid min-h-60 place-items-center rounded-xl border border-[#e3e9f3] bg-[#fbfcff]'
              : 'flex flex-1 items-center justify-center'
          }
        >
          <div className='h-7 w-7 animate-spin rounded-full border-2 border-[#c9d8f8] border-t-[#2d6ff7]' />
        </div>
      </div>
    );
  }

  return (
    <div className={frameClasses}>
      <div className='mb-4 md:mb-6'>
        {!embedded ? (
          <h2 className='text-lg font-semibold tracking-tight text-[#10275a] md:text-xl'>
            Настройки компании
          </h2>
        ) : null}
        <p className='mt-1 text-sm text-[#5f73a3]'>
          Укажите часовой пояс, допустимое время для задач без оценки и реквизиты, которые
          будут использоваться в счетах для оплаты и продления подписок.
        </p>
      </div>

      <form
        onSubmit={handleTimezoneSubmit}
        className='mb-6 max-w-2xl border-b border-[#e3e9f3] pb-6'
      >
        <label
          htmlFor='timezone'
          className='mb-1.5 block text-sm font-medium text-[#1f3565]'
        >
          Часовой пояс
        </label>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
          <div className='w-full sm:max-w-md'>
            <StyledSelect
              value={timezone}
              options={TIMEZONE_OPTIONS}
              ariaLabel='Часовой пояс'
              buttonClassName={joinClassNames(
                'min-h-11 text-base md:text-sm',
                timezoneError ? '!border-red-500 !ring-red-500' : '',
              )}
              onChange={(value) => {
                setTimezone(String(value));
                setTimezoneError(undefined);
              }}
            />
            {timezoneError && (
              <p className='mt-1.5 text-xs text-red-500'>{timezoneError}</p>
            )}
          </div>
          <button
            type='submit'
            disabled={isSavingTimezone}
            className='min-h-11 w-full rounded-xl bg-[#2d6ff7] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8] disabled:opacity-70 sm:w-auto'
          >
            {isSavingTimezone ? 'Сохранение...' : 'Сохранить часовой пояс'}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleUnestimatedLimitSubmit}
        className='mb-6 max-w-2xl border-b border-[#e3e9f3] pb-6'
      >
        <label
          htmlFor='unestimated_task_limit_hours'
          className='mb-1.5 block text-sm font-medium text-[#1f3565]'
        >
          Допустимое время для задач без оценки
        </label>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start'>
          <div className='w-full sm:max-w-md'>
            <div className='relative'>
              <input
                type='text'
                id='unestimated_task_limit_hours'
                inputMode='decimal'
                autoComplete='off'
                aria-invalid={Boolean(unestimatedLimitError)}
                aria-describedby='unestimated_task_limit_hint'
                value={unestimatedLimitHours}
                onChange={(e) => {
                  setUnestimatedLimitHours(e.target.value);
                  setUnestimatedLimitError(undefined);
                }}
                className={joinClassNames(
                  'min-h-11 w-full rounded-xl border bg-white py-2.5 pr-10 pl-4 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
                  unestimatedLimitError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
                )}
              />
              <span className='pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-[#5f73a3]'>
                ч
              </span>
            </div>
            {unestimatedLimitError ? (
              <p id='unestimated_task_limit_hint' className='mt-1.5 text-xs text-red-500'>
                {unestimatedLimitError}
              </p>
            ) : (
              <p
                id='unestimated_task_limit_hint'
                className='mt-1.5 text-xs text-[#5f73a3]'
              >
                Задача без оценки попадает в отчёт по перерасходу, если по ней затрачено
                больше этого времени. 0 — показывать все задачи без оценки.
              </p>
            )}
          </div>
          <button
            type='submit'
            disabled={isSavingUnestimatedLimit}
            className='min-h-11 w-full rounded-xl bg-[#2d6ff7] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8] disabled:opacity-70 sm:w-auto'
          >
            {isSavingUnestimatedLimit ? 'Сохранение...' : 'Сохранить лимит'}
          </button>
        </div>
      </form>

      <form onSubmit={handleSubmit} className='max-w-2xl space-y-4 md:space-y-6'>
        <div>
          <label
            htmlFor='legal_name'
            className='mb-1.5 block text-sm font-medium text-[#1f3565]'
          >
            Юридическое наименование<span className='text-[#5f73a3]'>*</span>
          </label>
          <input
            type='text'
            id='legal_name'
            name='legal_name'
            value={formData.legal_name}
            onChange={handleChange}
            placeholder='ИП "Иванов Иван"'
            className={joinClassNames(
              'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
              errors.legal_name
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
            )}
          />
          {errors.legal_name && (
            <p className='mt-1.5 text-xs text-red-500'>{errors.legal_name}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='address'
            className='mb-1.5 block text-sm font-medium text-[#1f3565]'
          >
            Юридический адрес<span className='text-[#5f73a3]'>*</span>
          </label>
          <textarea
            id='address'
            name='address'
            rows={3}
            value={formData.address}
            onChange={handleChange}
            placeholder='610000, г. Киров, ул. Московская, д. 4...'
            className={joinClassNames(
              'w-full resize-y rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
              errors.address
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
            )}
          />
          {errors.address && (
            <p className='mt-1.5 text-xs text-red-500'>{errors.address}</p>
          )}
        </div>

        <div>
          <label
            htmlFor='mail_address'
            className='mb-1.5 block text-sm font-medium text-[#1f3565]'
          >
            Почтовый адрес
          </label>
          <textarea
            id='mail_address'
            name='mail_address'
            rows={3}
            value={formData.mail_address}
            onChange={handleChange}
            placeholder='610012, г. Киров, ул. Уральская, д. 15...'
            className='w-full resize-y rounded-xl border border-[#e3e9f3] bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:border-[#2d6ff7] focus:outline-none focus:ring-1 focus:ring-[#2d6ff7] md:text-sm'
          />
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6'>
          <div>
            <label
              htmlFor='inn'
              className='mb-1.5 block text-sm font-medium text-[#1f3565]'
            >
              ИНН<span className='text-[#5f73a3]'>*</span>
            </label>
            <input
              type='text'
              id='inn'
              name='inn'
              value={formData.inn}
              onChange={handleChange}
              placeholder='123456789012'
              className={joinClassNames(
                'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
                errors.inn
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
              )}
            />
            {errors.inn && <p className='mt-1.5 text-xs text-red-500'>{errors.inn}</p>}
          </div>

          <div>
            <label
              htmlFor='kpp'
              className='mb-1.5 block text-sm font-medium text-[#1f3565]'
            >
              КПП
            </label>
            <input
              type='text'
              id='kpp'
              name='kpp'
              value={formData.kpp}
              onChange={handleChange}
              placeholder='123456789'
              className={joinClassNames(
                'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
                errors.kpp
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
              )}
            />
            {errors.kpp && <p className='mt-1.5 text-xs text-red-500'>{errors.kpp}</p>}
          </div>
        </div>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6'>
          <div>
            <label
              htmlFor='phone'
              className='mb-1.5 block text-sm font-medium text-[#1f3565]'
            >
              Контактный телефон<span className='text-[#5f73a3]'>*</span>
            </label>
            <input
              type='text'
              id='phone'
              name='phone'
              value={formData.phone}
              onChange={handleChange}
              placeholder='+7 (900) 123-45-67'
              className={joinClassNames(
                'min-h-11 w-full max-w-none rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:max-w-sm md:text-sm',
                errors.phone
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
              )}
            />
            {errors.phone && (
              <p className='mt-1.5 text-xs text-red-500'>{errors.phone}</p>
            )}
          </div>

          <div>
            <label
              htmlFor='contact_email'
              className='mb-1.5 block text-sm font-medium text-[#1f3565]'
            >
              Контактная почта
            </label>
            <input
              type='text'
              id='contact_email'
              name='contact_email'
              value={formData.contact_email}
              onChange={handleChange}
              placeholder='company_email@mail.ru'
              className={joinClassNames(
                'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
                errors.contact_email
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
              )}
            />
            {errors.contact_email && (
              <p className='mt-1.5 text-xs text-red-500'>{errors.contact_email}</p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor='ogrn'
            className='mb-1.5 block text-sm font-medium text-[#1f3565]'
          >
            Основной государственный регистрационный номер
          </label>
          <input
            type='text'
            id='ogrn'
            name='ogrn'
            value={formData.ogrn}
            onChange={handleChange}
            placeholder='1234567890123'
            className={joinClassNames(
              'min-h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-base text-[#1f3565] transition-colors focus:outline-none focus:ring-1 md:text-sm',
              errors.ogrn
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                : 'border-[#e3e9f3] focus:border-[#2d6ff7] focus:ring-[#2d6ff7]',
            )}
          />
          {errors.ogrn && <p className='mt-1.5 text-xs text-red-500'>{errors.ogrn}</p>}
        </div>

        <div className='mb-2'>
          <p className='mt-1 text-sm text-[#5f73a3]'>
            * - поля обязательные для заполнения
          </p>
        </div>

        <div className='pt-4'>
          <button
            type='submit'
            disabled={isSaving}
            className='min-h-11 w-full rounded-xl bg-[#2d6ff7] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#245fd8] disabled:opacity-70 sm:w-auto'
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
