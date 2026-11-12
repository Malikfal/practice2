import Button from '../../../../../../ui/Button';
import type { EmployeeProfileForm } from '../../../../../../../types/app';

import DetailInput from './DetailInput';

type Props = {
  profileForm: EmployeeProfileForm;
  canEditProfile: boolean;
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
};

export default function AdditionalFieldsSection({
  profileForm,
  canEditProfile,
  onProfileFormChange,
}: Props) {
  const fields = profileForm.payload_fields ?? [];

  const updateField = (
    index: number,
    key: keyof (typeof fields)[number],
    value: string,
  ) => {
    onProfileFormChange({
      ...profileForm,
      payload_fields: fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, [key]: value } : field,
      ),
    });
  };

  return (
    <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h3 className='text-[18px] font-semibold text-[#10275a]'>Дополнительные поля</h3>
        {canEditProfile ? (
          <Button
            type='button'
            size='sm'
            variant='secondary'
            className='min-h-10 w-full rounded-xl border-[#e3e9f3] px-3 text-[12px] font-semibold text-[#1f3565] hover:bg-[#f3f7ff] sm:h-8 sm:min-h-0 sm:w-auto'
            onClick={() =>
              onProfileFormChange({
                ...profileForm,
                payload_fields: [...fields, { key: '', value: '' }],
              })
            }
          >
            + Добавить поле
          </Button>
        ) : null}
      </div>

      {fields.length ? (
        <div className='grid gap-2'>
          {fields.map((field, index) => (
            <div
              key={index}
              className='grid gap-2 rounded-xl border border-[#e3e9f3] bg-white p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end'
            >
              <DetailInput
                label='Название поля'
                value={field.key}
                placeholder='Например, Telegram'
                readOnly={!canEditProfile}
                onChange={(value) => updateField(index, 'key', value)}
              />
              <DetailInput
                label='Значение'
                value={field.value}
                placeholder='Например, @user'
                readOnly={!canEditProfile}
                onChange={(value) => updateField(index, 'value', value)}
              />
              {canEditProfile ? (
                <button
                  type='button'
                  className='grid h-10 w-full place-items-center rounded-xl border border-[#e3e9f3] text-[#7e8fb4] transition-colors hover:bg-[#f3f7ff] hover:text-[#c83f52] sm:w-10'
                  title='Удалить поле'
                  onClick={() =>
                    onProfileFormChange({
                      ...profileForm,
                      payload_fields: fields.filter(
                        (_, fieldIndex) => fieldIndex !== index,
                      ),
                    })
                  }
                >
                  x
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className='rounded-xl border border-dashed border-[#d7e1f2] bg-white px-3 py-4 text-[13px] text-[#7e8fb4]'>
          Дополнительные поля не заполнены.
        </div>
      )}
    </section>
  );
}
