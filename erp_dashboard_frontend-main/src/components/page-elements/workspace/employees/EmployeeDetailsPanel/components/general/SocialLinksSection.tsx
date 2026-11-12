import { Field, PhoneInput } from '../../../../../../ui/FormField';
import type { EmployeeProfileForm } from '../../../../../../../types/app';

import DetailInput from './DetailInput';

type Props = {
  employeeId: string;
  profileForm: EmployeeProfileForm;
  canEditProfile: boolean;
  onProfileFormChange: (_next: EmployeeProfileForm) => void;
};

export default function SocialLinksSection({
  employeeId,
  profileForm,
  canEditProfile,
  onProfileFormChange,
}: Props) {
  return (
    <section className='grid gap-3 rounded-xl border border-[#e3e9f3] bg-[#fbfcff] p-3 sm:p-4'>
      <h3 className='text-[18px] leading-tight font-semibold text-[#10275a] sm:text-[20px] sm:leading-none'>
        Контакты
      </h3>
      <div className='grid gap-3'>
        <DetailInput
          label='Доп. почта'
          type='email'
          value={profileForm.socials.additional_email ?? ''}
          placeholder='email@example.com'
          readOnly={!canEditProfile}
          onChange={(value) =>
            onProfileFormChange({
              ...profileForm,
              employeeId,
              socials: { ...profileForm.socials, additional_email: value },
            })
          }
        />
        <Field label='Доп. телефон' className='text-[#1f3565]'>
          <PhoneInput
            value={profileForm.socials.additional_phone ?? ''}
            placeholder='+7 (XXX) XXX-XX-XX'
            readOnly={!canEditProfile}
            className='text-base sm:text-[14px]'
            onValueChange={(value) =>
              onProfileFormChange({
                ...profileForm,
                employeeId,
                socials: { ...profileForm.socials, additional_phone: value },
              })
            }
          />
        </Field>
      </div>
      <DetailInput
        label='Макс'
        value={profileForm.socials.max_url ?? ''}
        placeholder='https://max.example.com/profile'
        readOnly={!canEditProfile}
        onChange={(value) =>
          onProfileFormChange({
            ...profileForm,
            employeeId,
            socials: { ...profileForm.socials, max_url: value },
          })
        }
      />
      <DetailInput
        label='Вконтакте'
        value={profileForm.socials.vk_url ?? ''}
        placeholder='https://vk.com/id'
        readOnly={!canEditProfile}
        onChange={(value) =>
          onProfileFormChange({
            ...profileForm,
            employeeId,
            socials: { ...profileForm.socials, vk_url: value },
          })
        }
      />
      <DetailInput
        label='Телеграм'
        value={profileForm.socials.telegram_url ?? ''}
        placeholder='https://t.me/username'
        readOnly={!canEditProfile}
        onChange={(value) =>
          onProfileFormChange({
            ...profileForm,
            employeeId,
            socials: { ...profileForm.socials, telegram_url: value },
          })
        }
      />
    </section>
  );
}
